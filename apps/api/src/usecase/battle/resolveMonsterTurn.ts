import type { Attack } from "@/domain/attack/Attack";
import type { BattleEffect } from "@/domain/battle/BattleEffect";
import { buildBattleEffect, effectAppliedMessage } from "@/domain/battle/BattleEffect";
import { BATTLE_CONFIG, CHARGE_WARNING_FLAVOR } from "@/domain/battle/battleConfig";
import { computeDamage } from "@/domain/battle/services/DamageCalculator";
import { rollEffectProc } from "@/domain/battle/services/EffectResolver";
import { rollHit } from "@/domain/battle/services/HitCheck";
import {
  bumpAttackWeights,
  selectByWeightedDamage,
} from "@/domain/battle/services/MonsterAttackAi";
import type { Monster } from "@/domain/monster/Monster";
import type { BattleEffectKind, MonsterAttack } from "@/domain/monster/MonsterAttack";
import type { Attributes } from "@/domain/shared/Attributes";
import type { Rng } from "@/domain/shared/Rng";
import { defaultPlayerAttack } from "@/usecase/battle/combatStance";
import { resolveCounterItemId } from "@/usecase/battle/resolveCounterItem";
import type { AttackResultOutput } from "@/usecase/battle/TurnReportOutput";
import type { ItemRepository } from "@/usecase/item/ItemRepository";

export interface MonsterTurnState {
  playerCurrentHp: number;
  monsterCurrentStamina: number;
  playerEffects: BattleEffect[];
  monsterChargingAttackId: string | null;
  chargeRoundsLeft: number;
  monsterAttackWeights: Record<string, number>;
  stunCooldownRoundsLeft: number;
}

export interface MonsterTurnResult extends MonsterTurnState {
  monsterAttack: AttackResultOutput | null;
  messages: string[];
}

function pick<T>(items: readonly T[], rng: Rng): T {
  const item = items[rng.int(0, items.length - 1)];
  if (item === undefined) throw new Error("Cannot pick from an empty list");
  return item;
}

/**
 * Resolves the monster's reply for a turn where the player's own action
 * never damages the monster (plan2 §5 step 4) — shared by
 * UseBagItemUseCase and RestUseCase. AttackUseCase inlines an equivalent
 * flow because it also has to interleave the player's own strike.
 */
export async function resolveMonsterTurn(params: {
  state: MonsterTurnState;
  monster: Monster;
  moveset: MonsterAttack[];
  playerAttacks: Attack[];
  playerLevel: number;
  effectiveAttributes: Attributes;
  rng: Rng;
  itemRepository: ItemRepository;
  /** Rounds a Stun-applying special stays excluded from selection after it
   * unleashes (env-configurable, plan2 §6a extension — "Stun must never
   * chain"). */
  stunCooldownRounds: number;
}): Promise<MonsterTurnResult> {
  const {
    monster,
    moveset,
    playerAttacks,
    playerLevel,
    effectiveAttributes,
    rng,
    itemRepository,
    stunCooldownRounds,
  } = params;
  const monsterAttributes = monster.getAttributes();
  const messages: string[] = [];
  let {
    playerCurrentHp,
    monsterCurrentStamina,
    playerEffects,
    monsterChargingAttackId,
    chargeRoundsLeft,
    monsterAttackWeights,
    stunCooldownRoundsLeft,
  } = params.state;
  let monsterAttack: AttackResultOutput | null = null;
  let monsterStaminaRegen: number = BATTLE_CONFIG.passiveStaminaRegen;
  let pickedNormalAttackId: string | null = null;

  if (chargeRoundsLeft > 0 && monsterChargingAttackId) {
    chargeRoundsLeft -= 1;
    if (chargeRoundsLeft > 0) {
      monsterStaminaRegen = BATTLE_CONFIG.restStaminaRegen;
      messages.push(pick(CHARGE_WARNING_FLAVOR, rng));
    } else {
      const special = moveset.find((a) => a.id === monsterChargingAttackId);
      if (!special) throw new Error("Charging monster attack no longer exists in its moveset");

      const playerStance = defaultPlayerAttack(playerAttacks);
      const damage = computeDamage({
        attackMultiplier: special.multiplier,
        attackerScalingValue: monsterAttributes.get(special.scalingAttribute),
        staminaCost: special.staminaCost,
        defenderLevel: playerLevel,
        defenderScalingValue: effectiveAttributes.get(playerStance.scalingAttribute),
      });
      playerCurrentHp = Math.max(0, playerCurrentHp - damage);
      monsterCurrentStamina = Math.max(0, monsterCurrentStamina - special.staminaCost);

      const innateKind = monster.innateEffectKind;
      const innateCounter = await resolveCounterItemId(innateKind, itemRepository);
      playerEffects = [
        ...playerEffects,
        buildBattleEffect(innateKind, {
          inflictorLevel: monster.level,
          victimLevel: playerLevel,
          counterItemId: innateCounter,
        }),
      ];

      if (special.appliesEffect && special.appliesEffect !== innateKind) {
        playerEffects = [
          ...playerEffects,
          buildBattleEffect(special.appliesEffect, {
            inflictorLevel: monster.level,
            victimLevel: playerLevel,
            counterItemId: special.counterItemId,
          }),
        ];
        const message = effectAppliedMessage(special.appliesEffect);
        if (message) messages.push(message);

        // Stun must never chain: this special can't be selected again until
        // the cooldown expires (plan2 §6a extension).
        if (special.appliesEffect === "stun") {
          stunCooldownRoundsLeft = stunCooldownRounds;
        }
      }

      monsterAttack = { attackName: special.name, hit: true, damage, effectApplied: innateKind };
      monsterChargingAttackId = null;
      chargeRoundsLeft = 0;
    }
  } else {
    const affordable = moveset.filter(
      (a) =>
        a.staminaCost <= monsterCurrentStamina &&
        // Stun must never chain — excluded from selection entirely while on
        // cooldown, not just de-prioritized (plan2 §6a extension).
        !(a.appliesEffect === "stun" && stunCooldownRoundsLeft > 0),
    );
    const affordableSpecials = affordable.filter((a) => a.isSpecial);
    const affordableNormals = affordable.filter((a) => !a.isSpecial);

    if (affordableSpecials.length > 0) {
      // The AI always prefers starting a special over any normal attack
      // whenever one is affordable — a charged special guarantees a hit and
      // a 100% effect proc on unleash, so it's always the stronger play
      // (plan2 §6a). Ties among several simultaneously-affordable specials
      // are broken randomly (rare with today's seed data, at most one
      // special per moveset).
      const picked =
        affordableSpecials.length === 1
          ? (affordableSpecials[0] as MonsterAttack)
          : pick(affordableSpecials, rng);
      monsterStaminaRegen = BATTLE_CONFIG.restStaminaRegen;
      monsterChargingAttackId = picked.id;
      chargeRoundsLeft = picked.chargeTurns;
      messages.push(pick(CHARGE_WARNING_FLAVOR, rng));
    } else if (affordableNormals.length === 0) {
      monsterStaminaRegen = BATTLE_CONFIG.restStaminaRegen;
    } else {
      const playerStance = defaultPlayerAttack(playerAttacks);
      const candidates = affordableNormals.map((a) => ({
        attack: a,
        // Damage this attack would deal if it hits — used only to score and
        // pick among candidates. The hit roll itself doesn't depend on which
        // attack is chosen (dexterity/luck are the monster's, not the
        // attack's), so this doubles as the real damage once picked.
        damage: computeDamage({
          attackMultiplier: a.multiplier,
          attackerScalingValue: monsterAttributes.get(a.scalingAttribute),
          staminaCost: a.staminaCost,
          defenderLevel: playerLevel,
          defenderScalingValue: effectiveAttributes.get(playerStance.scalingAttribute),
        }),
      }));
      const picked = selectByWeightedDamage(candidates, monsterAttackWeights);
      pickedNormalAttackId = picked.id;

      const hit = rollHit(
        {
          attackerDexterity: monsterAttributes.dexterity,
          defenderDexterity: effectiveAttributes.dexterity,
          attackerLuck: monsterAttributes.luck,
        },
        rng,
      );
      let damage = 0;
      let effectApplied: string | null = null;

      if (hit) {
        damage = candidates.find((c) => c.attack.id === picked.id)?.damage ?? 0;
        playerCurrentHp = Math.max(0, playerCurrentHp - damage);
        monsterCurrentStamina = Math.max(0, monsterCurrentStamina - picked.staminaCost);

        const proced = rollEffectProc(
          { attackerLuck: monsterAttributes.luck, defenderLuck: effectiveAttributes.luck },
          rng,
        );
        if (proced) {
          const kind: BattleEffectKind = picked.appliesEffect ?? monster.innateEffectKind;
          const counterItemId = picked.appliesEffect
            ? picked.counterItemId
            : await resolveCounterItemId(kind, itemRepository);
          playerEffects = [
            ...playerEffects,
            buildBattleEffect(kind, {
              inflictorLevel: monster.level,
              victimLevel: playerLevel,
              counterItemId,
            }),
          ];
          effectApplied = kind;
          const message = effectAppliedMessage(kind);
          if (message) messages.push(message);
        }
      } else {
        monsterCurrentStamina = Math.max(0, monsterCurrentStamina - picked.staminaCost);
      }

      monsterAttack = { attackName: picked.name, hit, damage, effectApplied };
    }
  }

  monsterCurrentStamina = Math.min(monster.maxStamina, monsterCurrentStamina + monsterStaminaRegen);
  monsterAttackWeights = bumpAttackWeights(monsterAttackWeights, moveset, pickedNormalAttackId);
  stunCooldownRoundsLeft = Math.max(0, stunCooldownRoundsLeft - 1);

  return {
    playerCurrentHp,
    monsterCurrentStamina,
    playerEffects,
    monsterChargingAttackId,
    chargeRoundsLeft,
    monsterAttackWeights,
    stunCooldownRoundsLeft,
    monsterAttack,
    messages,
  };
}
