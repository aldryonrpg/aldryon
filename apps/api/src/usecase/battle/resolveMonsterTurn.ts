import type { Attack } from "@/domain/attack/Attack";
import type { BattleEffect } from "@/domain/battle/BattleEffect";
import { computeDotMagnitude } from "@/domain/battle/BattleEffect";
import { BATTLE_CONFIG, CHARGE_WARNING_FLAVOR, maxStamina } from "@/domain/battle/battleConfig";
import { computeDamage } from "@/domain/battle/services/DamageCalculator";
import { rollEffectProc } from "@/domain/battle/services/EffectResolver";
import { rollHit } from "@/domain/battle/services/HitCheck";
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
}): Promise<MonsterTurnResult> {
  const { monster, moveset, playerAttacks, playerLevel, effectiveAttributes, rng, itemRepository } =
    params;
  const monsterAttributes = monster.getAttributes();
  const messages: string[] = [];
  let {
    playerCurrentHp,
    monsterCurrentStamina,
    playerEffects,
    monsterChargingAttackId,
    chargeRoundsLeft,
  } = params.state;
  let monsterAttack: AttackResultOutput | null = null;
  let monsterStaminaRegen: number = BATTLE_CONFIG.passiveStaminaRegen;

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
        {
          type: "dot",
          kind: innateKind,
          damagePerRound: computeDotMagnitude(monster.level, playerLevel),
          counterItemId: innateCounter,
        },
      ];

      if (special.appliesEffect && special.appliesEffect !== innateKind) {
        playerEffects = [
          ...playerEffects,
          {
            type: "dot",
            kind: special.appliesEffect,
            damagePerRound: computeDotMagnitude(monster.level, playerLevel),
            counterItemId: special.counterItemId,
          },
        ];
      }

      monsterAttack = { attackName: special.name, hit: true, damage, effectApplied: innateKind };
      monsterChargingAttackId = null;
      chargeRoundsLeft = 0;
    }
  } else {
    const affordable = moveset.filter((a) => a.staminaCost <= monsterCurrentStamina);
    if (affordable.length === 0) {
      monsterStaminaRegen = BATTLE_CONFIG.restStaminaRegen;
    } else {
      const picked = pick(affordable, rng);
      if (picked.isSpecial) {
        monsterStaminaRegen = BATTLE_CONFIG.restStaminaRegen;
        monsterChargingAttackId = picked.id;
        chargeRoundsLeft = picked.chargeTurns;
        messages.push(pick(CHARGE_WARNING_FLAVOR, rng));
      } else {
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
          const playerStance = defaultPlayerAttack(playerAttacks);
          damage = computeDamage({
            attackMultiplier: picked.multiplier,
            attackerScalingValue: monsterAttributes.get(picked.scalingAttribute),
            staminaCost: picked.staminaCost,
            defenderLevel: playerLevel,
            defenderScalingValue: effectiveAttributes.get(playerStance.scalingAttribute),
          });
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
              {
                type: "dot",
                kind,
                damagePerRound: computeDotMagnitude(monster.level, playerLevel),
                counterItemId,
              },
            ];
            effectApplied = kind;
          }
        } else {
          monsterCurrentStamina = Math.max(0, monsterCurrentStamina - picked.staminaCost);
        }

        monsterAttack = { attackName: picked.name, hit, damage, effectApplied };
      }
    }
  }

  monsterCurrentStamina = Math.min(
    maxStamina(monster.level),
    monsterCurrentStamina + monsterStaminaRegen,
  );

  return {
    playerCurrentHp,
    monsterCurrentStamina,
    playerEffects,
    monsterChargingAttackId,
    chargeRoundsLeft,
    monsterAttack,
    messages,
  };
}
