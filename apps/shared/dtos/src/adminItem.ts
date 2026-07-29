import { z } from "zod";
import { AttributeValuesSchema, ItemAttributeBonusesSchema } from "./attributes";
import { ItemRaritySchema, ItemSlotSchema } from "./item";

export const ItemAdminSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  value: z.number().int().min(0),
  rarity: ItemRaritySchema,
  slot: ItemSlotSchema.nullable(),
  attributeBonuses: AttributeValuesSchema,
  hpRestore: z.number().int().positive().nullable(),
  revealsAllMonsterAttributes: z.boolean(),
  setName: z.string().nullable(),
  storePurchasable: z.boolean(),
  itemImage: z.string().nullable(),
  isPermanent: z.boolean(),
});
export type ItemAdminDto = z.infer<typeof ItemAdminSchema>;

// --- GET /admin/items ---

export const ListItemsAdminResponseSchema = z.object({
  items: z.array(ItemAdminSchema),
});
export type ListItemsAdminResponse = z.infer<typeof ListItemsAdminResponseSchema>;

// --- POST /admin/items, PATCH /admin/items/:id ---

const ItemAdminMutableFieldsSchema = z.object({
  name: z.string().min(1),
  description: z.string().min(1),
  value: z.number().int().min(0),
  rarity: ItemRaritySchema,
  slot: ItemSlotSchema.nullable(),
  attributeBonuses: ItemAttributeBonusesSchema,
  hpRestore: z.number().int().positive().nullable(),
  revealsAllMonsterAttributes: z.boolean(),
  setName: z.string().nullable(),
  storePurchasable: z.boolean(),
  itemImage: z.string().nullable(),
  isPermanent: z.boolean(),
});

export const CreateItemRequestSchema = ItemAdminMutableFieldsSchema;
export type CreateItemRequest = z.infer<typeof CreateItemRequestSchema>;

export const CreateItemResponseSchema = z.object({ item: ItemAdminSchema });
export type CreateItemResponse = z.infer<typeof CreateItemResponseSchema>;

export const PatchItemRequestSchema = ItemAdminMutableFieldsSchema.partial();
export type PatchItemRequest = z.infer<typeof PatchItemRequestSchema>;

export const PatchItemResponseSchema = z.object({ item: ItemAdminSchema });
export type PatchItemResponse = z.infer<typeof PatchItemResponseSchema>;
