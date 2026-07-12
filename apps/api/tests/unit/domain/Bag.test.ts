import { describe, expect, it } from "bun:test";
import { normalBagCapacity, planAddNormalItem, planAddSpecialItem } from "@/domain/player/Bag";

describe("normalBagCapacity", () => {
  it("is 20 for a normal player and 25 for VIP", () => {
    expect(normalBagCapacity(false)).toBe(20);
    expect(normalBagCapacity(true)).toBe(25);
  });
});

describe("planAddNormalItem", () => {
  it("tops up an existing stack with room", () => {
    const plan = planAddNormalItem(
      { slots: [{ playerItemId: "pi-1", itemId: "pot", quantity: 2 }], isVip: false },
      "pot",
    );
    expect(plan).toEqual({ fits: true, targetPlayerItemId: "pi-1" });
  });

  it("opens a new slot when the existing stack of that item is full", () => {
    const plan = planAddNormalItem(
      { slots: [{ playerItemId: "pi-1", itemId: "pot", quantity: 5 }], isVip: false },
      "pot",
    );
    expect(plan.fits).toBe(true);
    expect(plan.targetPlayerItemId).toBeNull();
  });

  it("rejects a new slot once the bag is at capacity (20 for non-VIP)", () => {
    const slots = Array.from({ length: 20 }, (_, i) => ({
      playerItemId: `pi-${i}`,
      itemId: `item-${i}`,
      quantity: 1,
    }));
    const plan = planAddNormalItem({ slots, isVip: false }, "new-item");
    expect(plan.fits).toBe(false);
  });

  it("allows a 21st slot for a VIP player", () => {
    const slots = Array.from({ length: 20 }, (_, i) => ({
      playerItemId: `pi-${i}`,
      itemId: `item-${i}`,
      quantity: 1,
    }));
    const plan = planAddNormalItem({ slots, isVip: true }, "new-item");
    expect(plan.fits).toBe(true);
  });
});

describe("planAddSpecialItem", () => {
  it("fits under the special-slot cap of 5", () => {
    expect(planAddSpecialItem(4).fits).toBe(true);
  });

  it("rejects once a special slot has 5", () => {
    expect(planAddSpecialItem(5).fits).toBe(false);
  });
});
