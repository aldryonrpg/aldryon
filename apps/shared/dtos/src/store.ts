import { z } from "zod";
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
