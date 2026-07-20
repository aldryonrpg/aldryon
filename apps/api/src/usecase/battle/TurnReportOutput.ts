import type { BattleOutcome } from "@/domain/battle/Battle";
import type { BattleEffectView } from "@/domain/battle/BattleEffect";
import type { AttributeValues } from "@/domain/shared/Attributes";

export interface BattleStatusOutput {
  currentHp: number;
  maxHp: number;
  currentStamina: number;
  maxStamina: number;
}

/** The monster's own Stamina is never sent to the client — only HP. */
export interface MonsterStatusOutput {
  currentHp: number;
  maxHp: number;
}

export interface AttackResultOutput {
  attackName: string;
  hit: boolean;
  damage: number;
  effectApplied: string | null;
}

/**
 * The turn report DTO shape from plan2 §5a step 7: hit/miss per side,
 * damage numbers, effect procs/ticks, both statuses, and outcome. Shared by
 * attack/run/bag/rest use cases since every action consumes the turn the
 * same way.
 */
export interface TurnReportOutput {
  playerAttack: AttackResultOutput | null;
  monsterAttack: AttackResultOutput | null;
  messages: string[];
  playerStatus: BattleStatusOutput;
  monsterStatus: MonsterStatusOutput;
  /** Only revealed keys are present — REVEAL SPELL/Knowledge Potion grow
   * this over the course of a battle; everything else stays omitted. */
  monsterAttributes: Partial<AttributeValues>;
  outcome: BattleOutcome;
  lootOffer: string[] | null;
  /** The player's active effects after this turn's ticks — bleed/poison/burn
   * stack unlimited (see BattleEffect.ts), so the client groups by kind. */
  playerEffects: BattleEffectView[];
  /** Effects the player has inflicted on the monster (today, only BURN
   * SPELL's burn — monsters have no defensive stat-debuff/stun to receive). */
  monsterEffects: BattleEffectView[];
  /** Item/set-bonus attributes before any Fear/Magic Aura Blast debuff. */
  attributesBeforeDebuff: AttributeValues;
  /** Same, with any active stat-decay debuff applied — equal to
   * attributesBeforeDebuff whenever nothing is debuffed. */
  attributesAfterDebuff: AttributeValues;
  /** Combined damage every stacked bleed/poison/burn instance on the player
   * dealt this turn's tick, summed across all of them — 0 when nothing is
   * active. Already folded into playerStatus.currentHp; surfaced
   * separately so the client can narrate it instead of it disappearing
   * into the HP delta. */
  playerEffectDamage: number;
  /** Same, for effects active on the monster (today, only burn). */
  monsterEffectDamage: number;
  /** True only on the turn that kills a dungeon run's boss — see
   * TurnReportSchema's doc comment in apps/shared/dtos for why the client
   * needs this instead of re-deriving it from player.dungeonRun (already
   * cleared by the time this same kill's profile refresh lands). False on
   * every other outcome. */
  dungeonRunEnded: boolean;
}
