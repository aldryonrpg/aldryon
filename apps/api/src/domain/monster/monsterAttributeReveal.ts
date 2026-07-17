import {
  ATTRIBUTE_KEYS,
  type AttributeKey,
  type AttributeValues,
} from "@/domain/shared/Attributes";
import type { Rng } from "@/domain/shared/Rng";

/**
 * Picks one of the monster's attributes the player hasn't already revealed
 * this battle (REVEAL SPELL), or null once every attribute is already known.
 */
export function pickUnrevealedAttribute(
  revealed: readonly AttributeKey[],
  rng: Rng,
): AttributeKey | null {
  const remaining = ATTRIBUTE_KEYS.filter((key) => !revealed.includes(key));
  if (remaining.length === 0) return null;
  return remaining[rng.int(0, remaining.length - 1)] ?? null;
}

/**
 * The partial view of a monster's attributes the client is allowed to see —
 * only revealed keys carry a value; every other key is omitted entirely
 * (never sent as null either) so a hidden attribute can never leak over the
 * wire regardless of how the client renders it.
 */
export function buildRevealedAttributesView(
  attributes: AttributeValues,
  revealed: readonly AttributeKey[],
): Partial<AttributeValues> {
  const view: Partial<AttributeValues> = {};
  for (const key of revealed) {
    view[key] = attributes[key];
  }
  return view;
}
