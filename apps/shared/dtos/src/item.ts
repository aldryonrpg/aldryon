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
  rarityColor: z.string(),
});
export type ItemCatalogEntryDto = z.infer<typeof ItemCatalogEntrySchema>;

export const ItemCatalogResponseSchema = z.array(ItemCatalogEntrySchema);
export type ItemCatalogResponse = z.infer<typeof ItemCatalogResponseSchema>;
