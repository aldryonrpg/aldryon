import type { AttributeValues } from "@/domain/shared/Attributes";

/** Math.ceil(base * multiplier) — the shared "never round in the defender's
 * favor" convention (plan3 §2c) used by every tier-based stat scale
 * (the materialized boss, and a dungeon step's live-scaled monster). */
export function scaleByTier(base: number, multiplier: number): number {
  return Math.ceil(base * multiplier);
}

export function scaleAttributesByTier(
  attributes: AttributeValues,
  multiplier: number,
): AttributeValues {
  return {
    force: scaleByTier(attributes.force, multiplier),
    dexterity: scaleByTier(attributes.dexterity, multiplier),
    agility: scaleByTier(attributes.agility, multiplier),
    intelligence: scaleByTier(attributes.intelligence, multiplier),
    vitality: scaleByTier(attributes.vitality, multiplier),
    luck: scaleByTier(attributes.luck, multiplier),
  };
}
