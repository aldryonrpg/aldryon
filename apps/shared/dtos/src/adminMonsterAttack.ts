import { z } from "zod";
import { BattleEffectKindSchema } from "./adminAttack";
import { AttackScalingSchema } from "./battle";

export const MonsterAttackAdminSchema = z.object({
  id: z.string(),
  name: z.string(),
  staminaCost: z.number().int().min(0),
  multiplier: z.number(),
  scalingAttribute: AttackScalingSchema,
  appliesEffect: BattleEffectKindSchema.nullable(),
  isSpecial: z.boolean(),
  /** DB check: charge_turns >= 1 or not is_special — specials need at least
   * one turn to charge, non-specials default to 0. Mirrored below on the
   * write schema so a bad pairing gets a clean 400, not a raw domain-thrown
   * 500 (MonsterAttack.create()'s own check is the defense-in-depth half). */
  chargeTurns: z.number().int().min(0),
});
export type MonsterAttackAdminDto = z.infer<typeof MonsterAttackAdminSchema>;

// --- GET /admin/monster-attacks ---

export const ListMonsterAttacksAdminResponseSchema = z.object({
  monsterAttacks: z.array(MonsterAttackAdminSchema),
});
export type ListMonsterAttacksAdminResponse = z.infer<typeof ListMonsterAttacksAdminResponseSchema>;

// --- POST /admin/monster-attacks, PATCH /admin/monster-attacks/:id ---

const MonsterAttackAdminMutableFieldsSchema = z
  .object({
    name: z.string().min(1),
    staminaCost: z.number().int().min(0),
    multiplier: z.number(),
    scalingAttribute: AttackScalingSchema,
    appliesEffect: BattleEffectKindSchema.nullable(),
    isSpecial: z.boolean(),
    chargeTurns: z.number().int().min(0),
  })
  .refine((fields) => !fields.isSpecial || fields.chargeTurns >= 1, {
    message: "chargeTurns must be >= 1 when isSpecial is true",
    path: ["chargeTurns"],
  });

export const CreateMonsterAttackRequestSchema = MonsterAttackAdminMutableFieldsSchema;
export type CreateMonsterAttackRequest = z.infer<typeof CreateMonsterAttackRequestSchema>;

export const CreateMonsterAttackResponseSchema = z.object({
  monsterAttack: MonsterAttackAdminSchema,
});
export type CreateMonsterAttackResponse = z.infer<typeof CreateMonsterAttackResponseSchema>;

/** Can't reuse .partial() on a refined schema (ZodEffects has no .partial())
 * — rebuilt as a plain partial object instead, with the same refine
 * re-applied only when both fields are actually present in the patch
 * (a patch touching just one of the two shouldn't force the other in). */
export const PatchMonsterAttackRequestSchema = z
  .object({
    name: z.string().min(1),
    staminaCost: z.number().int().min(0),
    multiplier: z.number(),
    scalingAttribute: AttackScalingSchema,
    appliesEffect: BattleEffectKindSchema.nullable(),
    isSpecial: z.boolean(),
    chargeTurns: z.number().int().min(0),
  })
  .partial()
  .refine(
    (fields) =>
      fields.isSpecial === undefined ||
      fields.chargeTurns === undefined ||
      !fields.isSpecial ||
      fields.chargeTurns >= 1,
    { message: "chargeTurns must be >= 1 when isSpecial is true", path: ["chargeTurns"] },
  );
export type PatchMonsterAttackRequest = z.infer<typeof PatchMonsterAttackRequestSchema>;

export const PatchMonsterAttackResponseSchema = z.object({
  monsterAttack: MonsterAttackAdminSchema,
});
export type PatchMonsterAttackResponse = z.infer<typeof PatchMonsterAttackResponseSchema>;
