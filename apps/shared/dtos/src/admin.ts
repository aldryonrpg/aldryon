import { z } from "zod";
import { AttributeValuesSchema } from "./attributes";
import { MonsterRegionSchema } from "./battle";

/** Every region a real monster row can carry, including "dungeon" — reserved
 * for materialized dungeon-boss rows (see domain/monster/Monster.ts) and
 * excluded from `MonsterRegionSchema` (battle.ts) on purpose, since a player
 * can never pick it as a wild-battle region. The admin list still needs to
 * render those rows, so its response schema is a superset of the mutable
 * request schema below, which stays restricted to the 5 wild regions. */
export const MonsterRegionAdminSchema = z.enum([
  "mountain",
  "forest",
  "bandit",
  "sewage",
  "ruins",
  "dungeon",
]);
export type MonsterRegionAdminDto = z.infer<typeof MonsterRegionAdminSchema>;

export const MonsterTypeSchema = z.enum(["normal", "poisonous"]);
export type MonsterTypeDto = z.infer<typeof MonsterTypeSchema>;

/** dropRate is per-mille (out of 1000), not a percent — 1000 is a
 * guaranteed drop, 100 is a 10% chance, 1 is the smallest possible chance
 * (0.1%). Same scale for drops/exclusiveDrops/legendaryDrops alike. */
export const DropTupleSchema = z.object({
  itemId: z.string(),
  dropRate: z.number().int().min(1).max(1000),
});
export type DropTupleDto = z.infer<typeof DropTupleSchema>;

/** One drop pool (drops/exclusiveDrops/legendaryDrops) — exported on its
 * own so the admin UI can validate a pasted JSON array against the exact
 * same rules the backend enforces, before ever sending it. */
export const DropPoolSchema = z.array(DropTupleSchema);
export type DropPoolDto = z.infer<typeof DropPoolSchema>;

export const MonsterAdminSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  region: MonsterRegionAdminSchema,
  monsterImage: z.string(),
  hp: z.number().int().min(1),
  xpGain: z.number().int().min(0),
  level: z.number().int().min(1),
  maxStamina: z.number().int().min(1),
  attributes: AttributeValuesSchema,
  monsterType: MonsterTypeSchema,
  drops: z.array(DropTupleSchema),
  exclusiveDrops: z.array(DropTupleSchema),
  legendaryDrops: z.array(DropTupleSchema),
  ambushChance: z.number().int().min(0).max(100),
});
export type MonsterAdminDto = z.infer<typeof MonsterAdminSchema>;

// --- GET /admin/monsters ---

export const ListMonstersAdminResponseSchema = z.object({
  monsters: z.array(MonsterAdminSchema),
});
export type ListMonstersAdminResponse = z.infer<typeof ListMonstersAdminResponseSchema>;

// --- POST /admin/monsters, PATCH /admin/monsters/:id ---

/** Every field a create/patch request can carry, minus `id` (server-
 * generated) — `region` deliberately reuses the wild-only enum, not
 * `MonsterRegionAdminSchema`, since there's no legitimate reason for this
 * screen to hand-author a "dungeon" region row. */
const MonsterAdminMutableFieldsSchema = z.object({
  name: z.string().min(1),
  description: z.string().min(1),
  region: MonsterRegionSchema,
  monsterImage: z.string().min(1),
  hp: z.number().int().min(1),
  xpGain: z.number().int().min(0),
  level: z.number().int().min(1),
  maxStamina: z.number().int().min(1),
  attributes: AttributeValuesSchema,
  monsterType: MonsterTypeSchema,
  drops: z.array(DropTupleSchema),
  exclusiveDrops: z.array(DropTupleSchema),
  legendaryDrops: z.array(DropTupleSchema),
  ambushChance: z.number().int().min(0).max(100),
});

export const CreateMonsterRequestSchema = MonsterAdminMutableFieldsSchema;
export type CreateMonsterRequest = z.infer<typeof CreateMonsterRequestSchema>;

export const CreateMonsterResponseSchema = z.object({ monster: MonsterAdminSchema });
export type CreateMonsterResponse = z.infer<typeof CreateMonsterResponseSchema>;

export const PatchMonsterRequestSchema = MonsterAdminMutableFieldsSchema.partial();
export type PatchMonsterRequest = z.infer<typeof PatchMonsterRequestSchema>;

export const PatchMonsterResponseSchema = z.object({ monster: MonsterAdminSchema });
export type PatchMonsterResponse = z.infer<typeof PatchMonsterResponseSchema>;
