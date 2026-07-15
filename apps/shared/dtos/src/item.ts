import { z } from "zod";

export const ItemRaritySchema = z.enum([
  "basic",
  "common",
  "uncommon",
  "rare",
  "very_rare",
  "legendary",
  "unique",
]);
export type ItemRarityDto = z.infer<typeof ItemRaritySchema>;

export const ItemSlotSchema = z.enum([
  "helmet",
  "body",
  "boots",
  "gloves",
  "necklace",
  "bracelet",
  "weapon",
  "two_handed_weapon",
]);
export type ItemSlotDto = z.infer<typeof ItemSlotSchema>;

// --- GET /items ---

export const ItemCatalogEntrySchema = z.object({
  id: z.string(),
  name: z.string(),
  slot: ItemSlotSchema.nullable(),
  rarity: ItemRaritySchema,
  /** Null for anything not part of an equipment set. Colors are looked up
   * client-side from `rarity` via GET /items/rarity-colors — never sent
   * per-item. */
  setName: z.string().nullable(),
});
export type ItemCatalogEntryDto = z.infer<typeof ItemCatalogEntrySchema>;

export const ItemCatalogResponseSchema = z.array(ItemCatalogEntrySchema);
export type ItemCatalogResponse = z.infer<typeof ItemCatalogResponseSchema>;

// --- GET /items/rarity-colors ---

export const ItemRarityColorsResponseSchema = z.record(ItemRaritySchema, z.string());
export type ItemRarityColorsResponse = z.infer<typeof ItemRarityColorsResponseSchema>;
