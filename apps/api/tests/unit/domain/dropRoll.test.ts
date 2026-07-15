import { describe, expect, it } from "bun:test";
import { rollDropPool, rollLegendaryDropPool } from "@/domain/monster/dropRoll";
import { FakeRng } from "../support/FakeRng";

describe("rollDropPool", () => {
  it("returns null when no tuple procs", () => {
    const result = rollDropPool([{ itemId: "sword", dropRate: 10 }], new FakeRng([11]));
    expect(result).toBeNull();
  });

  it("returns the single winning itemId when only one tuple procs", () => {
    const result = rollDropPool(
      [
        { itemId: "sword", dropRate: 10 },
        { itemId: "shield", dropRate: 5 },
      ],
      // sword's roll succeeds (10 <= 10), shield's fails (99 > 5), then the
      // single-winner index roll (0) picks the only success.
      new FakeRng([10, 99, 0]),
    );
    expect(result).toBe("sword");
  });

  it("picks a random winner among several successful tuples", () => {
    const result = rollDropPool(
      [
        { itemId: "sword", dropRate: 100 },
        { itemId: "shield", dropRate: 100 },
      ],
      // both drop-rate rolls succeed (values <= 100), then the winner-index roll picks index 1
      new FakeRng([1, 1, 1]),
    );
    expect(result).not.toBeNull();
    expect(["sword", "shield"]).toContain(result as string);
  });

  it("returns null for an empty pool", () => {
    expect(rollDropPool([], new FakeRng([1]))).toBeNull();
  });
});

describe("rollLegendaryDropPool", () => {
  it("succeeds at exactly the per-mille boundary (dropRate=1 -> 1-in-1000)", () => {
    const pool = [{ itemId: "dragon-blade", dropRate: 1 }];
    expect(rollLegendaryDropPool(pool, new FakeRng([100, 0]))).toBe("dragon-blade");
    expect(rollLegendaryDropPool(pool, new FakeRng([101]))).toBeNull();
  });

  it("resolves down to 1-in-100000 for a fractional dropRate", () => {
    const pool = [{ itemId: "dragon-blade", dropRate: 0.01 }];
    expect(rollLegendaryDropPool(pool, new FakeRng([1, 0]))).toBe("dragon-blade");
    expect(rollLegendaryDropPool(pool, new FakeRng([2]))).toBeNull();
  });

  it("guarantees a drop at dropRate=1000 (100%)", () => {
    const pool = [{ itemId: "dragon-blade", dropRate: 1000 }];
    expect(rollLegendaryDropPool(pool, new FakeRng([100_000, 0]))).toBe("dragon-blade");
  });

  it("returns null for an empty pool", () => {
    expect(rollLegendaryDropPool([], new FakeRng([1]))).toBeNull();
  });
});
