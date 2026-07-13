import { z } from "zod";
import { AttributeValuesSchema } from "./attributes";
import { ItemSlotSchema } from "./item";

const EquippedItemSchema = z.object({
  playerItemId: z.string(),
  itemId: z.string(),
  name: z.string(),
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
});
export type BagItemDto = z.infer<typeof BagItemSchema>;

// --- GET /player ---

export const PlayerProfileResponseSchema = z.object({
  playerName: z.string().nullable(),
  gold: z.number(),
  level: z.number(),
  xp: z.number(),
  attributePoints: z.number(),
  attributes: AttributeValuesSchema,
  dungeonSlayerKills: z.number(),
  dungeonSlayerLastKillAt: z.string().nullable(),
  equipped: EquippedItemsSchema,
  bag: z.array(BagItemSchema),
});
export type PlayerProfileResponse = z.infer<typeof PlayerProfileResponseSchema>;
