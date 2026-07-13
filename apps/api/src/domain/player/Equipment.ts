import type { EquipmentSlot } from "@/domain/item/Item";
import type { EquipmentPosition } from "@/domain/player/PlayerItem";

export interface EquippedItemSnapshot {
  position: EquipmentPosition;
  isTwoHanded: boolean;
}

export type EquipResult =
  | { ok: true; positionsToVacate: EquipmentPosition[]; targetPosition: EquipmentPosition }
  | { ok: false; reason: string };

const DIRECT_SLOT_TO_POSITION: Partial<Record<EquipmentSlot, EquipmentPosition>> = {
  helmet: "helmet",
  body: "body",
  boots: "boots",
  gloves: "gloves",
  necklace: "necklace",
  // Bracelet and Ring share the same physical position (plan3 §3) — a single
  // fixed slot, no left/right choice like weapons.
  bracelet: "bracelet",
};

/**
 * The single place the equip slot/two-handed rules live (plan2 §3d/§7).
 * Two-handed weapons occupy weapon_1 and require BOTH hands empty; nothing
 * can equip into weapon_2 while one is held. Max one equipped item per
 * position is enforced here (matching the DB's partial unique index).
 */
export function resolveEquip(
  currentlyEquipped: EquippedItemSnapshot[],
  itemSlot: EquipmentSlot,
  preferredWeaponPosition?: "weapon_1" | "weapon_2",
): EquipResult {
  if (itemSlot === "two_handed_weapon") {
    const bothHandsEmpty = !currentlyEquipped.some(
      (e) => e.position === "weapon_1" || e.position === "weapon_2",
    );
    if (!bothHandsEmpty) {
      return { ok: false, reason: "Two-handed weapons require both hands to be empty" };
    }
    return { ok: true, positionsToVacate: [], targetPosition: "weapon_1" };
  }

  if (itemSlot === "weapon") {
    const weapon1 = currentlyEquipped.find((e) => e.position === "weapon_1");
    if (weapon1?.isTwoHanded) {
      return { ok: false, reason: "Cannot equip a weapon while a two-handed weapon is held" };
    }
    const weapon2 = currentlyEquipped.find((e) => e.position === "weapon_2");
    const target = preferredWeaponPosition ?? (weapon1 ? "weapon_2" : "weapon_1");
    const occupant = target === "weapon_1" ? weapon1 : weapon2;
    return {
      ok: true,
      positionsToVacate: occupant ? [occupant.position] : [],
      targetPosition: target,
    };
  }

  const target = DIRECT_SLOT_TO_POSITION[itemSlot];
  if (!target) {
    return { ok: false, reason: `Item slot "${itemSlot}" is not equippable` };
  }
  const occupant = currentlyEquipped.find((e) => e.position === target);
  return {
    ok: true,
    positionsToVacate: occupant ? [occupant.position] : [],
    targetPosition: target,
  };
}
