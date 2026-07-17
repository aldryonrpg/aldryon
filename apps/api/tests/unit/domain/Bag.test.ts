import { describe, expect, it } from "bun:test";
import {
  normalBagCapacity,
  planAddNormalItem,
  planAddPotItem,
  planAddSpecialItem,
  planGrowlPotBreak,
  potLimitForLevel,
} from "@/domain/player/Bag";

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

describe("planAddPotItem", () => {
  it("fits under the combined POT cap", () => {
    expect(planAddPotItem(4, 5).fits).toBe(true);
  });

  it("rejects once the combined total across all 3 POT types reaches the cap", () => {
    const plan = planAddPotItem(5, 5);
    expect(plan.fits).toBe(false);
    expect(plan.reason).toContain("5");
  });

  it("respects a non-default POT_LIMIT", () => {
    expect(planAddPotItem(2, 3).fits).toBe(true);
    expect(planAddPotItem(3, 3).fits).toBe(false);
  });
});

describe("planGrowlPotBreak", () => {
  it("breaks nothing at 0%", () => {
    const stacks = [{ playerItemId: "pi-1", itemName: "small pot", quantity: 5 }];
    expect(planGrowlPotBreak(stacks, 0)).toEqual([]);
  });

  it("breaks nothing when the player carries no POTs", () => {
    expect(planGrowlPotBreak([], 50)).toEqual([]);
  });

  it("rounds a fractional break up, never down", () => {
    // total=3, 34% -> 1.02 -> ceil to 2
    const stacks = [{ playerItemId: "pi-1", itemName: "small pot", quantity: 3 }];
    const result = planGrowlPotBreak(stacks, 34);
    expect(result).toEqual([{ playerItemId: "pi-1", newQuantity: 1 }]);
  });

  it("breaks the smallest pot type first, spilling into the next once drained", () => {
    const stacks = [
      { playerItemId: "big-id", itemName: "big pot", quantity: 2 },
      { playerItemId: "small-id", itemName: "small pot", quantity: 2 },
      { playerItemId: "medium-id", itemName: "medium pot", quantity: 2 },
    ];
    // total=6, 50% -> ceil(3) = 3 broken: drains "small" (2) then 1 from "medium".
    const result = planGrowlPotBreak(stacks, 50);
    expect(result).toEqual([
      { playerItemId: "small-id", newQuantity: 0 },
      { playerItemId: "medium-id", newQuantity: 1 },
    ]);
  });

  it("breaks every remaining POT at 50% when the total is odd (rounds up to all of it)", () => {
    const stacks = [{ playerItemId: "pi-1", itemName: "small pot", quantity: 1 }];
    // total=1, 50% -> ceil(0.5) = 1 -> the only pot breaks.
    expect(planGrowlPotBreak(stacks, 50)).toEqual([{ playerItemId: "pi-1", newQuantity: 0 }]);
  });
});

describe("potLimitForLevel", () => {
  it("is 5 for levels 1-4", () => {
    expect(potLimitForLevel(1)).toBe(5);
    expect(potLimitForLevel(4)).toBe(5);
  });

  it("is 6 for levels 5-9", () => {
    expect(potLimitForLevel(5)).toBe(6);
    expect(potLimitForLevel(9)).toBe(6);
  });

  it("is 7 for levels 10-14", () => {
    expect(potLimitForLevel(10)).toBe(7);
    expect(potLimitForLevel(14)).toBe(7);
  });

  it("is 8 for levels 15-20", () => {
    expect(potLimitForLevel(15)).toBe(8);
    expect(potLimitForLevel(20)).toBe(8);
  });
});
