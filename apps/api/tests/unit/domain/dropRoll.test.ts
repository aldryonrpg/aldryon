import { describe, expect, it } from "bun:test";
import { rollDropPool } from "@/domain/monster/dropRoll";
import { FakeRng } from "../support/FakeRng";

describe("rollDropPool", () => {
  it("succeeds at exactly the per-mille boundary (dropRate=1 -> 1-in-1000)", () => {
    const pool = [{ itemId: "sword", dropRate: 1 }];
    expect(rollDropPool(pool, new FakeRng([100, 0]))).toBe("sword");
    expect(rollDropPool(pool, new FakeRng([101]))).toBeNull();
  });

  it("resolves down to 1-in-100000 for a fractional dropRate", () => {
    const pool = [{ itemId: "sword", dropRate: 0.01 }];
    expect(rollDropPool(pool, new FakeRng([1, 0]))).toBe("sword");
    expect(rollDropPool(pool, new FakeRng([2]))).toBeNull();
  });

  it("guarantees a drop at dropRate=1000 (100%)", () => {
    const pool = [{ itemId: "sword", dropRate: 1000 }];
    expect(rollDropPool(pool, new FakeRng([100_000, 0]))).toBe("sword");
  });

  it("picks a random winner among several successful tuples", () => {
    const result = rollDropPool(
      [
        { itemId: "sword", dropRate: 1000 },
        { itemId: "shield", dropRate: 1000 },
      ],
      // both drop-rate rolls succeed (values <= 100000), then the winner-index roll picks index 1
      new FakeRng([1, 1, 1]),
    );
    expect(result).not.toBeNull();
    expect(["sword", "shield"]).toContain(result as string);
  });

  it("returns null for an empty pool", () => {
    expect(rollDropPool([], new FakeRng([1]))).toBeNull();
  });
});
