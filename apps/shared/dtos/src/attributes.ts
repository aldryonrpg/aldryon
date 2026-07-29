import { z } from "zod";

export const AttributeValuesSchema = z.object({
  strength: z.number().int(),
  dexterity: z.number().int(),
  agility: z.number().int(),
  intelligence: z.number().int(),
  vitality: z.number().int(),
  luck: z.number().int(),
});
export type AttributeValuesDto = z.infer<typeof AttributeValuesSchema>;

/** Item attribute bonuses only — tighter than AttributeValuesSchema (which
 * also covers monster/player/boss attributes, unbounded) since an item's
 * per-attribute bonus is capped at -5..+5, integer only. Mirrors
 * Item.create()'s domain-level check in apps/api (apps/api/src/domain/item/
 * Item.ts) — this is the request-validation half, that's the defense-in-
 * depth half. */
const itemAttributeBonusField = z.number().int().min(-5).max(5);
export const ItemAttributeBonusesSchema = z.object({
  strength: itemAttributeBonusField,
  dexterity: itemAttributeBonusField,
  agility: itemAttributeBonusField,
  intelligence: itemAttributeBonusField,
  vitality: itemAttributeBonusField,
  luck: itemAttributeBonusField,
});
export type ItemAttributeBonusesDto = z.infer<typeof ItemAttributeBonusesSchema>;

export const AttributeKeySchema = z.enum([
  "strength",
  "dexterity",
  "agility",
  "intelligence",
  "vitality",
  "luck",
]);
export type AttributeKeyDto = z.infer<typeof AttributeKeySchema>;
