import { z } from "zod";
import { AttributeValuesSchema } from "./attributes";
import { ItemRaritySchema, ItemSlotSchema } from "./item";

const EquippedItemSchema = z.object({
  playerItemId: z.string(),
  itemId: z.string(),
  name: z.string(),
  rarity: ItemRaritySchema,
  setName: z.string().nullable(),
  attributeBonuses: AttributeValuesSchema,
});

export const EquippedItemsSchema = z.object({
  helmet: EquippedItemSchema.nullable(),
  body: EquippedItemSchema.nullable(),
  boots: EquippedItemSchema.nullable(),
  gloves: EquippedItemSchema.nullable(),
  necklace: EquippedItemSchema.nullable(),
  bracelet: EquippedItemSchema.nullable(),
  weapon_1: EquippedItemSchema.nullable(),
  weapon_2: EquippedItemSchema.nullable(),
});
export type EquippedItemsDto = z.infer<typeof EquippedItemsSchema>;

export const BagItemSchema = z.object({
  id: z.string(),
  itemId: z.string(),
  name: z.string(),
  quantity: z.number(),
  slot: ItemSlotSchema.nullable(),
  rarity: ItemRaritySchema,
  setName: z.string().nullable(),
  attributeBonuses: AttributeValuesSchema,
  /** The catalog's per-unit value — doubles as both the store's buy price
   * and (Store-only) sell price. */
  value: z.number(),
});
export type BagItemDto = z.infer<typeof BagItemSchema>;

// A dungeon run awaiting a Continue/Exit decision (loot-system follow-up) —
// null once there's no run in progress (never started, or the last one
// ended in a boss kill, a death, or an explicit Exit).
export const DungeonRunStatusSchema = z
  .object({
    tier: z.union([z.literal(1), z.literal(2), z.literal(3)]),
    step: z.number(),
    totalSteps: z.number(),
  })
  .nullable();
export type DungeonRunStatusDto = z.infer<typeof DungeonRunStatusSchema>;

// --- GET /player ---

export const PlayerProfileResponseSchema = z.object({
  playerName: z.string().nullable(),
  gold: z.number(),
  level: z.number(),
  xp: z.number(),
  lastDeathAt: z.string().nullable(),
  attributePoints: z.number(),
  attributes: AttributeValuesSchema,
  /** Combined equipped-item + full-set-completion bonus per attribute —
   * always present, 0 where nothing applies. */
  attributeBonuses: AttributeValuesSchema,
  dungeonSlayerKills: z.number(),
  dungeonSlayerLastKillAt: z.string().nullable(),
  dungeonRun: DungeonRunStatusSchema,
  equipped: EquippedItemsSchema,
  bag: z.array(BagItemSchema),
});
export type PlayerProfileResponse = z.infer<typeof PlayerProfileResponseSchema>;
