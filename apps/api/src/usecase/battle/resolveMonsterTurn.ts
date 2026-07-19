import type { Attack } from "@/domain/attack/Attack";
import type { BattleEffect } from "@/domain/battle/BattleEffect";
import {
  addBattleEffect,
  effectAppliedMessage,
  STATUS_EFFECT_KINDS,
} from "@/domain/battle/BattleEffect";
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
import type { EffectCounterRepository } from "@/usecase/battle/EffectCounterRepository";
import { resolveCounterItemId } from "@/usecase/battle/resolveCounterItem";
import type { AttackResultOutput } from "@/usecase/battle/TurnReportOutput";

export interface MonsterTurnState {
  playerCurrentHp: number;
  monsterCurrentStamina: number;
  playerEffects: BattleEffect[];
  monsterChargingAttackId: string | null;
  chargeRoundsLeft: number;
  monsterAttackWeights: Record<string, number>;
  /** Rounds left before a Stun/Fear/Magic-Aura-Blast-applying special can be
   * selected again — 0 means usable. One shared field for all three status-
   * effect kinds: set to the configured cooldown whenever any of them
   * unleashes, decrements by 1 every round regardless of what the monster
   * does (plan2 §6a, extended to the stat-decay debuffs too — re-landing
   * the same one back-to-back barely matters since addBattleEffect
   * refreshes rather than stacks it). */
  statusCooldownRoundsLeft: number;
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
  effectCounterRepository: EffectCounterRepository;
  /** Rounds a Stun/Fear/Magic-Aura-Blast-applying special stays excluded
   * from selection after it unleashes (env-configurable, plan2 §6a
   * extension — "Stun must never chain", extended to cover the stat-decay
   * debuffs since they don't stack either). */
  statusCooldownRounds: number;
}): Promise<MonsterTurnResult> {
  const {
    monster,
    moveset,
    playerAttacks,
    playerLevel,
    effectiveAttributes,
    rng,
    effectCounterRepository,
    statusCooldownRounds,
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
    statusCooldownRoundsLeft,
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
      const innateCounter = await resolveCounterItemId(innateKind, effectCounterRepository);
      playerEffects = addBattleEffect(playerEffects, innateKind, {
        inflictorLevel: monster.level,
        victimLevel: playerLevel,
        counterItemId: innateCounter,
      });

      if (special.appliesEffect && special.appliesEffect !== innateKind) {
        playerEffects = addBattleEffect(playerEffects, special.appliesEffect, {
          inflictorLevel: monster.level,
          victimLevel: playerLevel,
          counterItemId: await resolveCounterItemId(special.appliesEffect, effectCounterRepository),
        });
        const message = effectAppliedMessage(special.appliesEffect);
        if (message) messages.push(message);

        // None of Stun/Fear/Magic Aura Blast should chain: this special
        // can't be selected again until the shared cooldown expires (plan2
        // §6a extension — Fear/Magic Aura Blast don't stack anyway, so
        // re-landing the same one back-to-back would barely matter). A
        // damage-dealing special's own DoT (if any) isn't gated — bleed/
        // poison/burn stack fine and don't need this protection.
        if (STATUS_EFFECT_KINDS.has(special.appliesEffect)) {
          statusCooldownRoundsLeft = statusCooldownRounds;
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
        // None of Stun/Fear/Magic Aura Blast must chain — excluded from
        // selection entirely while the shared cooldown is running, not just
        // de-prioritized (plan2 §6a extension).
        !(
          a.appliesEffect &&
          STATUS_EFFECT_KINDS.has(a.appliesEffect) &&
          statusCooldownRoundsLeft > 0
        ),
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
          defenderAgility: effectiveAttributes.agility,
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
          const counterItemId = await resolveCounterItemId(kind, effectCounterRepository);
          playerEffects = addBattleEffect(playerEffects, kind, {
            inflictorLevel: monster.level,
            victimLevel: playerLevel,
            counterItemId,
          });
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
  monsterAttackWeights = bumpAttackWeights(
    monsterAttackWeights,
    moveset,
    pickedNormalAttackId,
    monster.level,
  );
  statusCooldownRoundsLeft = Math.max(0, statusCooldownRoundsLeft - 1);

  return {
    playerCurrentHp,
    monsterCurrentStamina,
    playerEffects,
    monsterChargingAttackId,
    chargeRoundsLeft,
    monsterAttackWeights,
    statusCooldownRoundsLeft,
    monsterAttack,
    messages,
  };
}
