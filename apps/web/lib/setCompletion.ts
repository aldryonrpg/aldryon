import type { EquipmentPositionDto, EquippedItemsDto } from "@aldryon/dtos";
import { formatDisplayName } from "@/lib/formatDisplayName";

/** The 6 non-weapon slots a set piece can occupy — mirrors the backend's
 * REQUIRED_SET_SLOTS (domain/player/equipmentSetBonus.ts). Weapons are
 * never bound to a set. */
const REQUIRED_SET_SLOTS: EquipmentPositionDto[] = [
  "helmet",
  "body",
  "boots",
  "gloves",
  "necklace",
  "bracelet",
];

const SLOT_LABELS: Record<string, string> = {
  helmet: "Helmet",
  body: "Armor",
  boots: "Boots",
  gloves: "Gloves",
  necklace: "Necklace",
  bracelet: "Bracelet",
};

export interface SetCompletionStatus {
  /** All 6 required slots share the same set. */
  complete: boolean;
  /** Exactly one required slot away from completing a set — the only other
   * state worth surfacing to the player. */
  almostComplete: boolean;
  /** The set name closest to completion, if any. */
  setName: string | null;
  /** Human-readable label of the single missing slot (only set when
   * almostComplete is true). */
  missingSlotLabel: string | null;
}

/**
 * Looks at the 6 equipped non-weapon slots and reports whether they form a
 * complete set, or are exactly one piece away from one — the two states
 * worth nudging the player about. Anything further from complete (0-4
 * matching pieces, or no set pieces at all) reports neither flag.
 */
export function computeSetCompletion(equipped: EquippedItemsDto): SetCompletionStatus {
  const bySlot = REQUIRED_SET_SLOTS.map((slot) => ({
    slot,
    setName: equipped[slot]?.setName ?? null,
  }));

  const counts = new Map<string, number>();
  for (const { setName } of bySlot) {
    if (setName) counts.set(setName, (counts.get(setName) ?? 0) + 1);
  }

  let candidate: string | null = null;
  let bestCount = 0;
  for (const { setName } of bySlot) {
    if (!setName) continue;
    const count = counts.get(setName) ?? 0;
    if (count > bestCount) {
      bestCount = count;
      candidate = setName;
    }
  }

  if (candidate === null) {
    return { complete: false, almostComplete: false, setName: null, missingSlotLabel: null };
  }

  const missing = bySlot.filter(({ setName }) => setName !== candidate);
  if (missing.length === 0) {
    return { complete: true, almostComplete: false, setName: candidate, missingSlotLabel: null };
  }
  if (missing.length === 1) {
    return {
      complete: false,
      almostComplete: true,
      setName: candidate,
      missingSlotLabel: SLOT_LABELS[missing[0]?.slot ?? ""] ?? formatDisplayName(candidate),
    };
  }
  return { complete: false, almostComplete: false, setName: candidate, missingSlotLabel: null };
}
