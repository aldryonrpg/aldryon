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

export const BattleOutcomeSchema = z.enum(["ongoing", "won", "lost", "fled"]);
export type BattleOutcomeDto = z.infer<typeof BattleOutcomeSchema>;

export const AttackScalingSchema = z.enum(["force", "intelligence"]);
export type AttackScalingDto = z.infer<typeof AttackScalingSchema>;

export const AvailableAttackSchema = z.object({
  name: z.string(),
  staminaCost: z.number(),
  scalingAttribute: AttackScalingSchema,
  meetsRequirements: z.boolean(),
});
export type AvailableAttackDto = z.infer<typeof AvailableAttackSchema>;

export const BattleMonsterSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  monsterImage: z.string(),
  hp: z.number(),
  attributes: AttributeValuesSchema,
});
export type BattleMonsterDto = z.infer<typeof BattleMonsterSchema>;

// --- POST /battle/start ---

export const StartBattleRequestSchema = z.object({ region: MonsterRegionSchema });
export type StartBattleRequest = z.infer<typeof StartBattleRequestSchema>;

export const StartBattleResponseSchema = z.object({
  monster: BattleMonsterSchema.nullable(),
  message: z.string().nullable(),
  playerStatus: BattleStatusSchema.nullable(),
  monsterStatus: BattleStatusSchema.nullable(),
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
  monsterStatus: BattleStatusSchema,
  outcome: BattleOutcomeSchema,
  lootOffer: z.array(z.string()).nullable(),
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
    monsterStatus: BattleStatusSchema,
    availableAttacks: z.array(AvailableAttackSchema),
  })
  .nullable();
export type ActiveBattleResponse = z.infer<typeof ActiveBattleResponseSchema>;
