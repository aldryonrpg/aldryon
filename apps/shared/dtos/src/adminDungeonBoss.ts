import { z } from "zod";
import { DropTupleSchema, MonsterTypeSchema } from "./admin";
import { AttributeValuesSchema } from "./attributes";

export const DungeonBossAdminSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  monsterImage: z.string(),
  monsterType: MonsterTypeSchema,
  baseHp: z.number().int().min(1),
  baseXpGain: z.number().int().min(0),
  baseMaxStamina: z.number().int().min(1),
  baseAttributes: AttributeValuesSchema,
  drops: z.array(DropTupleSchema),
  exclusiveDrops: z.array(DropTupleSchema),
  legendaryDrops: z.array(DropTupleSchema),
});
export type DungeonBossAdminDto = z.infer<typeof DungeonBossAdminSchema>;

// --- GET /admin/dungeon-bosses ---

export const ListDungeonBossesAdminResponseSchema = z.object({
  dungeonBosses: z.array(DungeonBossAdminSchema),
});
export type ListDungeonBossesAdminResponse = z.infer<typeof ListDungeonBossesAdminResponseSchema>;

// --- POST /admin/dungeon-bosses, PATCH /admin/dungeon-bosses/:id ---

const DungeonBossAdminMutableFieldsSchema = z.object({
  name: z.string().min(1),
  description: z.string().min(1),
  monsterImage: z.string().min(1),
  monsterType: MonsterTypeSchema,
  baseHp: z.number().int().min(1),
  baseXpGain: z.number().int().min(0),
  baseMaxStamina: z.number().int().min(1),
  baseAttributes: AttributeValuesSchema,
  drops: z.array(DropTupleSchema),
  exclusiveDrops: z.array(DropTupleSchema),
  legendaryDrops: z.array(DropTupleSchema),
});

export const CreateDungeonBossRequestSchema = DungeonBossAdminMutableFieldsSchema;
export type CreateDungeonBossRequest = z.infer<typeof CreateDungeonBossRequestSchema>;

export const CreateDungeonBossResponseSchema = z.object({ dungeonBoss: DungeonBossAdminSchema });
export type CreateDungeonBossResponse = z.infer<typeof CreateDungeonBossResponseSchema>;

export const PatchDungeonBossRequestSchema = DungeonBossAdminMutableFieldsSchema.partial();
export type PatchDungeonBossRequest = z.infer<typeof PatchDungeonBossRequestSchema>;

export const PatchDungeonBossResponseSchema = z.object({ dungeonBoss: DungeonBossAdminSchema });
export type PatchDungeonBossResponse = z.infer<typeof PatchDungeonBossResponseSchema>;

// --- GET/PUT /admin/dungeon-bosses/:id/special-attacks ---

/** A boss's *special* attacks only (0-2) — separate from the boss's own
 * create/patch flow above since it's a distinct concern (moveset linking,
 * not the boss's own stat row) with its own endpoint pair. Regular
 * (non-special) moveset entries stay migration-only, same as today —
 * see apps/api's SetDungeonBossSpecialAttacksUseCase. */
export const DungeonBossSpecialAttacksSchema = z.object({
  specialAttackIds: z.array(z.string()).max(2),
});
export type DungeonBossSpecialAttacksDto = z.infer<typeof DungeonBossSpecialAttacksSchema>;

export const GetDungeonBossSpecialAttacksResponseSchema = DungeonBossSpecialAttacksSchema;
export type GetDungeonBossSpecialAttacksResponse = z.infer<
  typeof GetDungeonBossSpecialAttacksResponseSchema
>;

export const SetDungeonBossSpecialAttacksRequestSchema = z
  .object({
    attackIds: z.array(z.string()).max(2),
  })
  .refine((data) => new Set(data.attackIds).size === data.attackIds.length, {
    message: "attackIds must not contain duplicates",
    path: ["attackIds"],
  });
export type SetDungeonBossSpecialAttacksRequest = z.infer<
  typeof SetDungeonBossSpecialAttacksRequestSchema
>;

export const SetDungeonBossSpecialAttacksResponseSchema = DungeonBossSpecialAttacksSchema;
export type SetDungeonBossSpecialAttacksResponse = z.infer<
  typeof SetDungeonBossSpecialAttacksResponseSchema
>;

// --- GET/PUT /admin/dungeon-bosses/:id/normal-attacks ---

/** A boss's *normal* (non-special) attacks — no count cap, unlike the
 * special-attacks picker above. See
 * apps/api's SetDungeonBossNormalAttacksUseCase, which rejects any id whose
 * isSpecial is true (those go through the special-attacks endpoint
 * instead). */
export const DungeonBossNormalAttacksSchema = z.object({
  normalAttackIds: z.array(z.string()),
});
export type DungeonBossNormalAttacksDto = z.infer<typeof DungeonBossNormalAttacksSchema>;

export const GetDungeonBossNormalAttacksResponseSchema = DungeonBossNormalAttacksSchema;
export type GetDungeonBossNormalAttacksResponse = z.infer<
  typeof GetDungeonBossNormalAttacksResponseSchema
>;

export const SetDungeonBossNormalAttacksRequestSchema = z
  .object({
    attackIds: z.array(z.string()),
  })
  .refine((data) => new Set(data.attackIds).size === data.attackIds.length, {
    message: "attackIds must not contain duplicates",
    path: ["attackIds"],
  });
export type SetDungeonBossNormalAttacksRequest = z.infer<
  typeof SetDungeonBossNormalAttacksRequestSchema
>;

export const SetDungeonBossNormalAttacksResponseSchema = DungeonBossNormalAttacksSchema;
export type SetDungeonBossNormalAttacksResponse = z.infer<
  typeof SetDungeonBossNormalAttacksResponseSchema
>;
