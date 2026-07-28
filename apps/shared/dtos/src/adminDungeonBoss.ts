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
