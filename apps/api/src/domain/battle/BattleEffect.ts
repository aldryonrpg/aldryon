import type { BattleEffectKind } from "@/domain/monster/MonsterAttack";
import type { AttributeKey } from "@/domain/shared/Attributes";

/**
 * Damage-over-time effect (plan2 §6a): bleed/poison/burn. damagePerRound is
 * computed once and snapshotted when the effect is applied — it never
 * changes afterward, even if the inflictor/victim's level changes later.
 * No fixed duration: lasts until cured (counterItemId consumed via
 * /battle/bag) or the battle ends. counterItemId is null only for the
 * player's `burn` on a monster (monsters carry no bag).
 */
export interface DotEffect {
  type: "dot";
  kind: BattleEffectKind;
  damagePerRound: number;
  counterItemId: string | null;
}

/** Temporarily lowers one stat for N rounds, decrementing each round. */
export interface DebuffEffect {
  type: "debuff";
  stat: AttributeKey;
  amount: number;
  roundsLeft: number;
}

export type BattleEffect = DotEffect | DebuffEffect;

export function isDot(effect: BattleEffect): effect is DotEffect {
  return effect.type === "dot";
}

export function isDebuff(effect: BattleEffect): effect is DebuffEffect {
  return effect.type === "debuff";
}

/** (inflictor_level + 2) - victim_level, clamped at a minimum of 1 (plan2 §6a). */
export function computeDotMagnitude(inflictorLevel: number, victimLevel: number): number {
  return Math.max(1, inflictorLevel + 2 - victimLevel);
}

/** Ticks all DoT effects, returning total damage and effects still active (debuffs decremented, expired ones dropped). */
export function tickEffects(effects: BattleEffect[]): {
  totalDamage: number;
  remaining: BattleEffect[];
} {
  let totalDamage = 0;
  const remaining: BattleEffect[] = [];

  for (const effect of effects) {
    if (isDot(effect)) {
      totalDamage += effect.damagePerRound;
      remaining.push(effect);
      continue;
    }
    const roundsLeft = effect.roundsLeft - 1;
    if (roundsLeft > 0) {
      remaining.push({ ...effect, roundsLeft });
    }
  }

  return { totalDamage, remaining };
}

/** Removes every DoT effect of the given kind (a bandage/antidote cure, plan2 §5c). */
export function removeDotByCounterItem(
  effects: BattleEffect[],
  counterItemId: string,
): BattleEffect[] {
  return effects.filter((effect) => !(isDot(effect) && effect.counterItemId === counterItemId));
}
