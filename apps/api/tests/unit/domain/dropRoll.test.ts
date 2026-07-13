import { describe, expect, it } from "bun:test";
import { rollDropPool } from "@/domain/monster/dropRoll";
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
