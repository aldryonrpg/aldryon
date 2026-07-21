import { describe, expect, it } from "bun:test";
import { formatDisplayName } from "@/lib/formatDisplayName";

describe("formatDisplayName", () => {
  it("title-cases an all-lowercase name", () => {
    expect(formatDisplayName("big pot")).toBe("Big Pot");
  });

  it("title-cases an all-uppercase name", () => {
    expect(formatDisplayName("SNAKE")).toBe("Snake");
  });

  it("leaves an already Title Case name unchanged", () => {
    expect(formatDisplayName("Basic Armor")).toBe("Basic Armor");
  });

  it("leaves a mixed-case word untouched (intentional stylization)", () => {
    expect(formatDisplayName("2-Hand")).toBe("2-Hand");
  });

  it("handles a single word", () => {
    expect(formatDisplayName("sword")).toBe("Sword");
  });
});
