import { z } from "zod";

export const AttributeValuesSchema = z.object({
  force: z.number().int(),
  dexterity: z.number().int(),
  agility: z.number().int(),
  intelligence: z.number().int(),
  vitality: z.number().int(),
  luck: z.number().int(),
});
export type AttributeValuesDto = z.infer<typeof AttributeValuesSchema>;

export const AttributeKeySchema = z.enum([
  "force",
  "dexterity",
  "agility",
  "intelligence",
  "vitality",
  "luck",
]);
export type AttributeKeyDto = z.infer<typeof AttributeKeySchema>;
