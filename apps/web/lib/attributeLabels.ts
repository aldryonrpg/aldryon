import type { AttributeKeyDto } from "@aldryon/dtos";

export const ATTRIBUTE_ORDER: AttributeKeyDto[] = [
  "agility",
  "strength",
  "intelligence",
  "dexterity",
  "luck",
  "vitality",
];

export const ATTRIBUTE_TRIGRAMS: Record<AttributeKeyDto, string> = {
  agility: "Agi",
  strength: "Str",
  intelligence: "Int",
  dexterity: "Dex",
  luck: "Luc",
  vitality: "Vit",
};

export const ATTRIBUTE_FULL_NAMES: Record<AttributeKeyDto, string> = {
  agility: "Agility",
  strength: "Strength",
  intelligence: "Intelligence",
  dexterity: "Dexterity",
  luck: "Luck",
  vitality: "Vitality",
};
