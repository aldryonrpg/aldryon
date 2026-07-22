import { describe, expect, it } from "bun:test";
import { getBattleBackgroundImage } from "@/lib/battleBackground";

describe("getBattleBackgroundImage", () => {
  it("returns the dungeon background regardless of wildRegion when isDungeon is true", () => {
    expect(getBattleBackgroundImage(true, "forest")).toBe("/backgrounds/background_dungeon.png");
    expect(getBattleBackgroundImage(true, "mountain")).toBe("/backgrounds/background_dungeon.png");
  });

  it("returns each region's own background when art exists", () => {
    expect(getBattleBackgroundImage(false, "forest")).toBe("/backgrounds/background_forest.png");
    expect(getBattleBackgroundImage(false, "mountain")).toBe("/backgrounds/background_montain.png");
  });

  it("falls back to the forest background for regions with no dedicated art yet", () => {
    expect(getBattleBackgroundImage(false, "bandit")).toBe("/backgrounds/background_forest.png");
    expect(getBattleBackgroundImage(false, "sewage")).toBe("/backgrounds/background_forest.png");
    expect(getBattleBackgroundImage(false, "ruins")).toBe("/backgrounds/background_forest.png");
  });
});
