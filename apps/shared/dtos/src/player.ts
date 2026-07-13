import { z } from "zod";
import { AttributeKeySchema, AttributeValuesSchema } from "./attributes";

// --- PATCH /player ---

const PLAYER_NAME_PATTERN = /^[A-Za-z0-9]{5,40}$/;

export const PatchPlayerRequestSchema = z.object({
  playerName: z.string().regex(PLAYER_NAME_PATTERN),
});
export type PatchPlayerRequest = z.infer<typeof PatchPlayerRequestSchema>;

export const PatchPlayerResponseSchema = z.object({
  playerName: z.string().nullable(),
});
export type PatchPlayerResponse = z.infer<typeof PatchPlayerResponseSchema>;

// --- POST /player/attributes ---

export const AllocateAttributePointsRequestSchema = z.object({
  allocations: z.record(AttributeKeySchema, z.number().int().min(0)),
});
export type AllocateAttributePointsRequest = z.infer<typeof AllocateAttributePointsRequestSchema>;

export const AllocateAttributePointsResponseSchema = z.object({
  attributes: AttributeValuesSchema,
  attributePoints: z.number(),
});
export type AllocateAttributePointsResponse = z.infer<typeof AllocateAttributePointsResponseSchema>;

// --- POST /player/equip, POST /player/unequip ---

export const EquipmentPositionSchema = z.enum([
  "helmet",
  "body",
  "boots",
  "gloves",
  "necklace",
  "weapon_1",
  "weapon_2",
]);
export type EquipmentPositionDto = z.infer<typeof EquipmentPositionSchema>;

export const EquipItemRequestSchema = z.object({
  playerItemId: z.string().min(1),
  preferredWeaponPosition: z.enum(["weapon_1", "weapon_2"]).optional(),
});
export type EquipItemRequest = z.infer<typeof EquipItemRequestSchema>;

export const UnequipItemRequestSchema = z.object({ playerItemId: z.string().min(1) });
export type UnequipItemRequest = z.infer<typeof UnequipItemRequestSchema>;

export const PlayerItemSummarySchema = z.object({
  id: z.string(),
  itemId: z.string(),
  equippedSlot: EquipmentPositionSchema.nullable(),
  quantity: z.number(),
});
export type PlayerItemSummaryDto = z.infer<typeof PlayerItemSummarySchema>;

export const EquipItemResponseSchema = z.object({ playerItem: PlayerItemSummarySchema });
export type EquipItemResponse = z.infer<typeof EquipItemResponseSchema>;
