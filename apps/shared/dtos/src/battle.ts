import { z } from "zod";
import { AttributeValuesSchema } from "./attributes";

export const MonsterRegionSchema = z.enum(["mountain", "forest", "bandit", "sewage", "ruins"]);
export type MonsterRegionDto = z.infer<typeof MonsterRegionSchema>;

export const BattleStatusSchema = z.object({
  currentHp: z.number(),
  maxHp: z.number(),
  currentStamina: z.number(),
  maxStamina: z.number(),
});
export type BattleStatusDto = z.infer<typeof BattleStatusSchema>;

/** The monster's own Stamina is never sent to the client — HP only. */
export const MonsterStatusSchema = z.object({
  currentHp: z.number(),
  maxHp: z.number(),
});
export type MonsterStatusDto = z.infer<typeof MonsterStatusSchema>;

export const BattleOutcomeSchema = z.enum(["ongoing", "won", "lost", "fled"]);
export type BattleOutcomeDto = z.infer<typeof BattleOutcomeSchema>;

export const AttackScalingSchema = z.enum(["strength", "intelligence"]);
export type AttackScalingDto = z.infer<typeof AttackScalingSchema>;

// --- Active battle effects (bleed/poison/burn, Fear/Magic Aura Blast, Stun) ---

export const DotEffectSchema = z.object({
  type: z.literal("dot"),
  kind: z.enum(["bleed", "poison", "burn"]),
  damagePerRound: z.number(),
  counterItemId: z.string().nullable(),
});
export type DotEffectDto = z.infer<typeof DotEffectSchema>;

export const StatDebuffEffectSchema = z.object({
  type: z.literal("debuff"),
  kind: z.enum(["fear", "magic_aura_blast"]),
  stat: z.enum(["strength", "intelligence"]),
  roundsElapsed: z.number(),
  /** Current percent reduction on `stat`, precomputed server-side from
   * roundsElapsed so the client never has to duplicate the decay schedule. */
  percent: z.number(),
});
export type StatDebuffEffectDto = z.infer<typeof StatDebuffEffectSchema>;

export const StunEffectSchema = z.object({
  type: z.literal("stun"),
  roundsLeft: z.number(),
});
export type StunEffectDto = z.infer<typeof StunEffectSchema>;

export const BattleEffectSchema = z.discriminatedUnion("type", [
  DotEffectSchema,
  StatDebuffEffectSchema,
  StunEffectSchema,
]);
export type BattleEffectDto = z.infer<typeof BattleEffectSchema>;

export const AvailableAttackSchema = z.object({
  name: z.string(),
  staminaCost: z.number(),
  multiplier: z.number(),
  scalingAttribute: AttackScalingSchema,
  meetsRequirements: z.boolean(),
  revealsRandomMonsterAttribute: z.boolean(),
});
export type AvailableAttackDto = z.infer<typeof AvailableAttackSchema>;

export const BattleMonsterSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  monsterImage: z.string(),
  hp: z.number(),
  /** Only revealed keys are present (REVEAL SPELL/Knowledge Potion) — an
   * absent key means "??", never a leaked value. */
  attributes: AttributeValuesSchema.partial(),
});
export type BattleMonsterDto = z.infer<typeof BattleMonsterSchema>;

// --- POST /battle/start ---

export const StartBattleRequestSchema = z.object({ region: MonsterRegionSchema });
export type StartBattleRequest = z.infer<typeof StartBattleRequestSchema>;

export const StartBattleResponseSchema = z.object({
  monster: BattleMonsterSchema.nullable(),
  message: z.string().nullable(),
  playerStatus: BattleStatusSchema.nullable(),
  monsterStatus: MonsterStatusSchema.nullable(),
  availableAttacks: z.array(AvailableAttackSchema),
  ambushOccurred: z.boolean(),
  outcome: BattleOutcomeSchema.nullable(),
});
export type StartBattleResponse = z.infer<typeof StartBattleResponseSchema>;

// --- Turn report, shared by attack/run/bag/rest ---

export const AttackResultSchema = z.object({
  attackName: z.string(),
  hit: z.boolean(),
  damage: z.number(),
  effectApplied: z.string().nullable(),
});
export type AttackResultDto = z.infer<typeof AttackResultSchema>;

export const TurnReportSchema = z.object({
  playerAttack: AttackResultSchema.nullable(),
  monsterAttack: AttackResultSchema.nullable(),
  messages: z.array(z.string()),
  playerStatus: BattleStatusSchema,
  monsterStatus: MonsterStatusSchema,
  /** Only revealed keys are present — see `BattleMonsterSchema.attributes`. */
  monsterAttributes: AttributeValuesSchema.partial(),
  outcome: BattleOutcomeSchema,
  lootOffer: z.array(z.string()).nullable(),
  /** The player's active effects after this turn's ticks — bleed/poison/burn
   * stack unlimited, so the client groups by kind (BattleEffect.ts). */
  playerEffects: z.array(BattleEffectSchema),
  /** Effects the player has inflicted on the monster (today, only BURN
   * SPELL's burn). */
  monsterEffects: z.array(BattleEffectSchema),
  /** Item/set-bonus attributes before any Fear/Magic Aura Blast debuff. */
  attributesBeforeDebuff: AttributeValuesSchema,
  /** Same, with any active stat-decay debuff applied — equal to
   * attributesBeforeDebuff whenever nothing is debuffed. */
  attributesAfterDebuff: AttributeValuesSchema,
});
export type TurnReportDto = z.infer<typeof TurnReportSchema>;

// --- POST /battle/attack ---

export const AttackRequestSchema = z.object({ attackName: z.string().min(1) });
export type AttackRequest = z.infer<typeof AttackRequestSchema>;

// --- POST /battle/bag ---

export const UseBagItemRequestSchema = z.object({ playerItemId: z.string().min(1) });
export type UseBagItemRequest = z.infer<typeof UseBagItemRequestSchema>;

// --- POST /battle/loot ---

export const ClaimLootRequestSchema = z.object({ picks: z.array(z.string().min(1)) });
export type ClaimLootRequest = z.infer<typeof ClaimLootRequestSchema>;

export const ClaimLootResponseSchema = z.object({
  claimed: z.array(z.string()),
  rejected: z.array(z.object({ itemId: z.string(), reason: z.string() })),
});
export type ClaimLootResponse = z.infer<typeof ClaimLootResponseSchema>;

// --- GET /battle ---

export const ActiveBattleResponseSchema = z
  .object({
    monster: BattleMonsterSchema,
    playerStatus: BattleStatusSchema,
    monsterStatus: MonsterStatusSchema,
    availableAttacks: z.array(AvailableAttackSchema),
    playerEffects: z.array(BattleEffectSchema),
    monsterEffects: z.array(BattleEffectSchema),
    attributesBeforeDebuff: AttributeValuesSchema,
    attributesAfterDebuff: AttributeValuesSchema,
  })
  .nullable();
export type ActiveBattleResponse = z.infer<typeof ActiveBattleResponseSchema>;
