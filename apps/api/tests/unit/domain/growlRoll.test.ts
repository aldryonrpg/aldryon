import { describe, expect, it } from "bun:test";
import { rollGrowlBreakPercent } from "@/domain/dungeon/growlRoll";
import { FakeRng } from "../support/FakeRng";

describe("rollGrowlBreakPercent", () => {
  it("returns whatever the roll lands on, within 0-50", () => {
    expect(rollGrowlBreakPercent(new FakeRng([0]))).toBe(0);
    expect(rollGrowlBreakPercent(new FakeRng([25]))).toBe(25);
    expect(rollGrowlBreakPercent(new FakeRng([50]))).toBe(50);
  });
});
