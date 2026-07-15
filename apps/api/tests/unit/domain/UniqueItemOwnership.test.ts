import { describe, expect, it } from "bun:test";
import { appendOwnerHistory } from "@/domain/item/UniqueItemOwnership";

describe("appendOwnerHistory", () => {
  it("appends to an empty history", () => {
    const result = appendOwnerHistory([], {
      playerId: "p1",
      timestampOfLastOwnership: "2026-01-01T00:00:00.000Z",
    });
    expect(result).toEqual([
      { playerId: "p1", timestampOfLastOwnership: "2026-01-01T00:00:00.000Z" },
    ]);
  });

  it("keeps only the last 5 entries, dropping the oldest", () => {
    const history = [1, 2, 3, 4, 5].map((n) => ({
      playerId: `p${n}`,
      timestampOfLastOwnership: `2026-01-0${n}T00:00:00.000Z`,
    }));
    const result = appendOwnerHistory(history, {
      playerId: "p6",
      timestampOfLastOwnership: "2026-01-06T00:00:00.000Z",
    });
    expect(result).toHaveLength(5);
    expect(result.map((e) => e.playerId)).toEqual(["p2", "p3", "p4", "p5", "p6"]);
  });
});
