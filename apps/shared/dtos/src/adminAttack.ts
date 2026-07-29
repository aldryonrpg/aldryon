import { z } from "zod";
import { AttributeValuesSchema } from "./attributes";
import { AttackScalingSchema } from "./battle";

/** bleed/poison/burn are damage-over-time; fear/magic_aura_blast are
 * percentage stat-decay debuffs; stun skips turns — mirrors
 * apps/api's BattleEffectKind (domain/monster/MonsterAttack.ts). No shared
 * DTO already covered all six values together (battle.ts's DotEffectSchema/
 * StatDebuffEffectSchema each only cover their own subset). */
export const BattleEffectKindSchema = z.enum([
  "bleed",
  "poison",
  "burn",
  "fear",
  "magic_aura_blast",
  "stun",
]);
export type BattleEffectKindDto = z.infer<typeof BattleEffectKindSchema>;

export const AttackAdminSchema = z.object({
  id: z.string(),
  name: z.string(),
  staminaCost: z.number().int().min(0),
  multiplier: z.number(),
  scalingAttribute: AttackScalingSchema,
  appliesEffect: BattleEffectKindSchema.nullable(),
  minLevel: z.number().int().min(1),
  attributeRequirements: AttributeValuesSchema,
  revealsRandomMonsterAttribute: z.boolean(),
});
export type AttackAdminDto = z.infer<typeof AttackAdminSchema>;

// --- GET /admin/attacks ---

export const ListAttacksAdminResponseSchema = z.object({
  attacks: z.array(AttackAdminSchema),
});
export type ListAttacksAdminResponse = z.infer<typeof ListAttacksAdminResponseSchema>;

// --- POST /admin/attacks, PATCH /admin/attacks/:id ---

/** No `appliesEffect` here on purpose — the only player attack that ever
 * applies one (BURN SPELL's burn) is existing seed data, and admins can't
 * set or change it through this API at all, not just the UI (CreateAttackUseCase
 * always creates new attacks with appliesEffect: null; PATCH can never touch
 * an existing attack's value since it's absent from this schema entirely). */
const AttackAdminMutableFieldsSchema = z.object({
  name: z.string().min(1),
  staminaCost: z.number().int().min(0),
  multiplier: z.number(),
  scalingAttribute: AttackScalingSchema,
  minLevel: z.number().int().min(1),
  attributeRequirements: AttributeValuesSchema,
  revealsRandomMonsterAttribute: z.boolean(),
});

export const CreateAttackRequestSchema = AttackAdminMutableFieldsSchema;
export type CreateAttackRequest = z.infer<typeof CreateAttackRequestSchema>;

export const CreateAttackResponseSchema = z.object({ attack: AttackAdminSchema });
export type CreateAttackResponse = z.infer<typeof CreateAttackResponseSchema>;

export const PatchAttackRequestSchema = AttackAdminMutableFieldsSchema.partial();
export type PatchAttackRequest = z.infer<typeof PatchAttackRequestSchema>;

export const PatchAttackResponseSchema = z.object({ attack: AttackAdminSchema });
export type PatchAttackResponse = z.infer<typeof PatchAttackResponseSchema>;
