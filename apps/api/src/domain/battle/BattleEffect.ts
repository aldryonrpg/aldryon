import type { BattleEffectKind } from "@/domain/monster/MonsterAttack";
import type { Attributes } from "@/domain/shared/Attributes";

/** Stun/Fear/Magic Aura Blast — the three kinds the monster AI's shared
 * cooldown (Battle.statusCooldownRoundsLeft) gates selection on, since none of
 * them should chain: Stun by design, Fear/Magic Aura Blast because they
 * don't stack either (see addBattleEffect below) so reapplying the same one
 * back-to-back barely matters. Bleed/poison/burn are excluded — those stack
 * freely and don't need this protection. */
export const STATUS_EFFECT_KINDS: ReadonlySet<BattleEffectKind> = new Set([
  "stun",
  "fear",
  "magic_aura_blast",
]);

/**
 * Damage-over-time effect (plan2 §6a): bleed/poison/burn. damagePerRound is
 * computed once and snapshotted when the effect is applied — it never
 * changes afterward, even if the inflictor/victim's level changes later.
 * No fixed duration: lasts until cured (counterItemId consumed via
 * /battle/bag) or the battle ends. counterItemId is null only for the
 * player's `burn` on a monster (monsters carry no bag).
 *
 * Re-applying the same kind (another bleed/poison proc, or another special)
 * does NOT replace or refresh an existing instance — it's simply appended
 * as a separate entry, so a target can carry any number of stacked DoTs of
 * the same kind at once, each ticking its own damagePerRound every round.
 * `removeDotByCounterItem` clears every stacked instance of a kind in one
 * use of the counter item (one bandage cures all stacked bleeds), not just
 * one. This is deliberate — see `resolveMonsterTurn.ts`/`AttackUseCase.ts`,
 * which always append and never look for an existing same-kind effect
 * before doing so.
 */
export interface DotEffect {
  type: "dot";
  kind: "bleed" | "poison" | "burn";
  damagePerRound: number;
  counterItemId: string | null;
}

/**
 * A percentage stat-decay debuff (Fear -> strength, Magic Aura Blast ->
 * intelligence): held at -50% for 2 rounds, then recovers 10 points a round
 * until back to normal. `roundsElapsed` indexes into
 * `STAT_DEBUFF_SCHEDULE_PERCENT` and advances once per round via
 * `tickEffects`. Delivered only by special attacks; never cured by an item.
 */
export interface StatDebuffEffect {
  type: "debuff";
  kind: "fear" | "magic_aura_blast";
  stat: "strength" | "intelligence";
  roundsElapsed: number;
}

/**
 * Voids the player's next `roundsLeft` turns (attack/bag/rest/run all
 * become no-ops — only the passive Stamina regen happens) while the
 * monster keeps acting normally. Decremented once per *consumed* stunned
 * turn (see `consumeStunTurn`), not by the generic per-round `tickEffects`.
 */
export interface StunEffect {
  type: "stun";
  roundsLeft: number;
}

export type BattleEffect = DotEffect | StatDebuffEffect | StunEffect;

export function isDot(effect: BattleEffect): effect is DotEffect {
  return effect.type === "dot";
}

export function isStatDebuff(effect: BattleEffect): effect is StatDebuffEffect {
  return effect.type === "debuff";
}

export function isStun(effect: BattleEffect): effect is StunEffect {
  return effect.type === "stun";
}

/** (inflictor_level + 2) - victim_level, clamped at a minimum of 1 (plan2 §6a). */
export function computeDotMagnitude(inflictorLevel: number, victimLevel: number): number {
  return Math.max(1, inflictorLevel + 2 - victimLevel);
}

/**
 * Round-by-round percent reduction for a stat-decay debuff: 2 rounds at
 * 50%, then 40/30/20/10, then back to normal. Index by `roundsElapsed`;
 * out-of-range means the debuff has fully worn off.
 */
export const STAT_DEBUFF_SCHEDULE_PERCENT: readonly number[] = [50, 50, 40, 30, 20, 10];

export function statDebuffPercent(roundsElapsed: number): number {
  return STAT_DEBUFF_SCHEDULE_PERCENT[roundsElapsed] ?? 0;
}

/** A StatDebuffEffect plus its current percent reduction, so the client can
 * display it without duplicating STAT_DEBUFF_SCHEDULE_PERCENT itself. */
export type StatDebuffEffectView = StatDebuffEffect & { percent: number };

export type BattleEffectView = DotEffect | StatDebuffEffectView | StunEffect;

/** Maps a stored effect to its client-facing view — every type passes
 * through unchanged except a stat-debuff, which gets its current percent
 * computed from roundsElapsed (see EffectsPanel.tsx on the frontend). */
export function toBattleEffectView(effect: BattleEffect): BattleEffectView {
  if (isStatDebuff(effect)) {
    return { ...effect, percent: statDebuffPercent(effect.roundsElapsed) };
  }
  return effect;
}

const STAT_DEBUFF_STAT: Record<"fear" | "magic_aura_blast", "strength" | "intelligence"> = {
  fear: "strength",
  magic_aura_blast: "intelligence",
};

export const STUN_TURNS = 2;

/**
 * Builds the right effect shape for a proc'd or specials-guaranteed kind
 * (plan2 §6a plus the Fear/Magic Aura Blast/Stun specials) — the single
 * place that decides DoT vs stat-debuff vs stun from a `BattleEffectKind`.
 */
export function buildBattleEffect(
  kind: BattleEffectKind,
  params: { inflictorLevel: number; victimLevel: number; counterItemId: string | null },
): BattleEffect {
  if (kind === "fear" || kind === "magic_aura_blast") {
    return { type: "debuff", kind, stat: STAT_DEBUFF_STAT[kind], roundsElapsed: 0 };
  }
  if (kind === "stun") {
    return { type: "stun", roundsLeft: STUN_TURNS };
  }
  return {
    type: "dot",
    kind,
    damagePerRound: computeDotMagnitude(params.inflictorLevel, params.victimLevel),
    counterItemId: params.counterItemId,
  };
}

/**
 * Adds a freshly-landed effect to an existing list, honoring each type's own
 * stacking rule. DoTs (bleed/poison/burn) stack unlimited — always append a
 * new instance (BattleEffect.ts top-of-file doc). Fear/Magic Aura Blast do
 * NOT stack — landing the same kind again while one is already active just
 * refreshes its schedule back to round 0 in place, instead of adding a
 * second simultaneous instance (which would double the stat.withBonuses
 * reduction in applyStatDebuffs). Stun always appends — the monster AI's own
 * cooldown (see MonsterTurnState.statusCooldownRoundsLeft) is what prevents it
 * chaining, not de-duplication here.
 */
export function addBattleEffect(
  effects: BattleEffect[],
  kind: BattleEffectKind,
  params: { inflictorLevel: number; victimLevel: number; counterItemId: string | null },
): BattleEffect[] {
  if (kind === "fear" || kind === "magic_aura_blast") {
    const alreadyActive = effects.some((effect) => isStatDebuff(effect) && effect.kind === kind);
    if (alreadyActive) {
      return effects.map((effect) =>
        isStatDebuff(effect) && effect.kind === kind ? { ...effect, roundsElapsed: 0 } : effect,
      );
    }
  }
  return [...effects, buildBattleEffect(kind, params)];
}

/**
 * Ticks DoT and stat-debuff effects once per round (DoT damage summed,
 * stat-debuffs advance their schedule and expire when exhausted). Stun
 * passes through unchanged — it's only consumed by an actual stunned turn,
 * see `consumeStunTurn`, so it isn't touched by the generic per-round tick.
 */
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
    if (isStun(effect)) {
      remaining.push(effect);
      continue;
    }
    const roundsElapsed = effect.roundsElapsed + 1;
    if (roundsElapsed < STAT_DEBUFF_SCHEDULE_PERCENT.length) {
      remaining.push({ ...effect, roundsElapsed });
    }
  }

  return { totalDamage, remaining };
}

/** Whether the player currently has an active stun (all actions blocked). */
export function isStunned(effects: BattleEffect[]): boolean {
  return effects.some((effect) => isStun(effect) && effect.roundsLeft > 0);
}

/**
 * Consumes one of the player's stunned turns — called exactly once per
 * blocked action attempt, not once per round, so "lose the next two turns"
 * means exactly two voided actions regardless of how much real time passes
 * between them.
 */
export function consumeStunTurn(effects: BattleEffect[]): BattleEffect[] {
  return effects
    .map((effect) => (isStun(effect) ? { ...effect, roundsLeft: effect.roundsLeft - 1 } : effect))
    .filter((effect) => !(isStun(effect) && effect.roundsLeft <= 0));
}

/** Removes every DoT effect of the given kind (a bandage/antidote cure, plan2 §5c). */
export function removeDotByCounterItem(
  effects: BattleEffect[],
  counterItemId: string,
): BattleEffect[] {
  return effects.filter((effect) => !(isDot(effect) && effect.counterItemId === counterItemId));
}

/** A flavor line for the turn report when a non-DoT effect lands (plan2 §6a extension). */
export function effectAppliedMessage(kind: BattleEffectKind): string | null {
  switch (kind) {
    case "fear":
      return "The monster's Fear grips you, sapping your Strength!";
    case "magic_aura_blast":
      return "The monster's Magic Aura Blast disrupts your mind, sapping your Intelligence!";
    case "stun":
      return "You are stunned and lose your next turns!";
    default:
      return null;
  }
}

/**
 * Applies any active Fear/Magic Aura Blast reduction on top of already-
 * computed effective attributes (base + item bonuses). Reduction floors
 * (rounds in the victim's disfavor, matching the rest of combat math
 * rounding in the attacker's favor) and the fighter >=1 floor still holds.
 */
export function applyStatDebuffs(attributes: Attributes, effects: BattleEffect[]): Attributes {
  let result = attributes;
  for (const effect of effects) {
    if (!isStatDebuff(effect)) continue;
    const percent = statDebuffPercent(effect.roundsElapsed);
    if (percent <= 0) continue;
    const current = result.get(effect.stat);
    const reduced = Math.max(1, Math.floor(current * (1 - percent / 100)));
    result = result.withBonuses({ [effect.stat]: reduced - current });
  }
  return result;
}
