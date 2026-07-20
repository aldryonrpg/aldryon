import {
  ATTRIBUTE_KEYS,
  type AttributeKey,
  type AttributeValues,
} from "@/domain/shared/Attributes";
import type { Rng } from "@/domain/shared/Rng";

/**
 * How many attributes a REVEAL SPELL cast uncovers — scales with the
 * caster's own effective Intelligence via a d100 roll. Higher Intelligence
 * unlocks a higher cap, but still needs the roll to land in that cap's
 * range; a low roll always falls back to 1, same as a player who just barely
 * meets the spell's own 30-Intelligence requirement:
 *  - Intelligence >= 100: roll >= 90 -> 3, roll >= 60 -> 2, else 1
 *  - Intelligence >= 50: roll >= 60 -> 2, else 1
 *  - Otherwise: always 1
 */
export function rollRevealCount(intelligence: number, rng: Rng): number {
  const roll = rng.int(1, 100);
  if (intelligence >= 100 && roll >= 90) return 3;
  if (intelligence >= 50 && roll >= 60) return 2;
  return 1;
}

/**
 * Picks up to `count` distinct attributes the player hasn't already revealed
 * this battle (REVEAL SPELL) — fewer than `count` (down to none) if that's
 * all that's left unrevealed.
 */
export function pickUnrevealedAttributes(
  revealed: readonly AttributeKey[],
  rng: Rng,
  count: number,
): AttributeKey[] {
  const pool = ATTRIBUTE_KEYS.filter((key) => !revealed.includes(key));
  const picked: AttributeKey[] = [];
  for (let i = 0; i < count && pool.length > 0; i++) {
    const [key] = pool.splice(rng.int(0, pool.length - 1), 1);
    if (key) picked.push(key);
  }
  return picked;
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
