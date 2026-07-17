import { z } from "zod";
import { AttributeValuesSchema } from "./attributes";
import { ItemRaritySchema, ItemSlotSchema } from "./item";
import { PlayerItemSummarySchema } from "./player";

// --- GET /store ---

export const StoreItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  price: z.number(),
  slot: ItemSlotSchema.nullable(),
  rarity: ItemRaritySchema,
  hpRestore: z.number().nullable(),
  category: z.enum(["consumable", "gear"]),
  /** Null for anything not part of an equipment set. */
  setName: z.string().nullable(),
  /** Null until item artwork exists — the client falls back to a
   * placeholder SVG circle. */
  itemImage: z.string().nullable(),
  /** Per-item flat bonuses (0 where an item grants nothing in that
   * attribute). */
  attributeBonuses: AttributeValuesSchema,
});
export type StoreItemDto = z.infer<typeof StoreItemSchema>;

export const StoreListResponseSchema = z.array(StoreItemSchema);
export type StoreListResponse = z.infer<typeof StoreListResponseSchema>;

// --- POST /store/purchase ---

export const PurchaseItemRequestSchema = z.object({ itemId: z.string().min(1) });
export type PurchaseItemRequest = z.infer<typeof PurchaseItemRequestSchema>;

export const PurchaseItemResponseSchema = z.object({
  gold: z.number(),
  playerItem: PlayerItemSummarySchema,
});
export type PurchaseItemResponse = z.infer<typeof PurchaseItemResponseSchema>;

// --- POST /store/sell ---

export const SellItemRequestSchema = z.object({ playerItemId: z.string().min(1) });
export type SellItemRequest = z.infer<typeof SellItemRequestSchema>;

export const SellItemResponseSchema = z.object({ gold: z.number() });
export type SellItemResponse = z.infer<typeof SellItemResponseSchema>;
