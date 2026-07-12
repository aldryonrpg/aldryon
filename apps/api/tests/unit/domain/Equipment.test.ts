import { describe, expect, it } from "bun:test";
import type { EquippedItemSnapshot } from "@/domain/player/Equipment";
import { resolveEquip } from "@/domain/player/Equipment";

describe("resolveEquip", () => {
  it("equips a helmet into the helmet position when empty", () => {
    const result = resolveEquip([], "helmet");
    expect(result).toEqual({ ok: true, positionsToVacate: [], targetPosition: "helmet" });
  });

  it("vacates the existing item when re-equipping the same direct slot", () => {
    const current: EquippedItemSnapshot[] = [{ position: "helmet", isTwoHanded: false }];
    const result = resolveEquip(current, "helmet");
    expect(result).toEqual({ ok: true, positionsToVacate: ["helmet"], targetPosition: "helmet" });
  });

  it("equips a one-handed weapon into weapon_1 first, then weapon_2", () => {
    const first = resolveEquip([], "weapon");
    expect(first.ok && first.targetPosition).toBe("weapon_1");

    const withWeapon1: EquippedItemSnapshot[] = [{ position: "weapon_1", isTwoHanded: false }];
    const second = resolveEquip(withWeapon1, "weapon");
    expect(second.ok && second.targetPosition).toBe("weapon_2");
  });

  it("equips a two-handed weapon into weapon_1 when both hands are empty", () => {
    const result = resolveEquip([], "two_handed_weapon");
    expect(result).toEqual({ ok: true, positionsToVacate: [], targetPosition: "weapon_1" });
  });

  it("rejects a two-handed weapon when either hand is occupied", () => {
    const current: EquippedItemSnapshot[] = [{ position: "weapon_2", isTwoHanded: false }];
    const result = resolveEquip(current, "two_handed_weapon");
    expect(result.ok).toBe(false);
  });

  it("rejects a one-handed weapon while a two-handed weapon is held", () => {
    const current: EquippedItemSnapshot[] = [{ position: "weapon_1", isTwoHanded: true }];
    const result = resolveEquip(current, "weapon");
    expect(result.ok).toBe(false);
  });

  it("respects an explicit preferred weapon position", () => {
    const current: EquippedItemSnapshot[] = [
      { position: "weapon_1", isTwoHanded: false },
      { position: "weapon_2", isTwoHanded: false },
    ];
    const result = resolveEquip(current, "weapon", "weapon_1");
    expect(result).toEqual({
      ok: true,
      positionsToVacate: ["weapon_1"],
      targetPosition: "weapon_1",
    });
  });
});
