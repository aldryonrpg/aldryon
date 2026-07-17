import type { AttributeKeyDto, AttributeValuesDto } from "@aldryon/dtos";

const ABBREVIATIONS: { key: AttributeKeyDto; label: string }[] = [
  { key: "agility", label: "Agi" },
  { key: "strength", label: "Str" },
  { key: "intelligence", label: "Int" },
  { key: "dexterity", label: "Dex" },
  { key: "luck", label: "Sor" },
  { key: "vitality", label: "Vit" },
];

/** Compact "Str +1 Vit -1" summary of an item's nonzero attribute bonuses,
 * in the game's standard Agi/Str/Int/Dex/Sor/Vit order. Empty string when
 * every bonus is 0 (e.g. a plain consumable). */
export function formatAttributeBonuses(bonuses: AttributeValuesDto): string {
  return ABBREVIATIONS.filter(({ key }) => bonuses[key] !== 0)
    .map(({ key, label }) => `${label} ${bonuses[key] > 0 ? "+" : ""}${bonuses[key]}`)
    .join(" ");
}
