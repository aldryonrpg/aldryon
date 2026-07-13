import { describe, expect, it } from "bun:test";
import { rollGrowl } from "@/domain/dungeon/growlRoll";
import { FakeRng } from "../support/FakeRng";

describe("rollGrowl", () => {
  it("succeeds when the roll is <= 50", () => {
    expect(rollGrowl(new FakeRng([1]))).toBe(true);
    expect(rollGrowl(new FakeRng([50]))).toBe(true);
  });

  it("fails when the roll is > 50", () => {
    expect(rollGrowl(new FakeRng([51]))).toBe(false);
    expect(rollGrowl(new FakeRng([100]))).toBe(false);
  });
});
