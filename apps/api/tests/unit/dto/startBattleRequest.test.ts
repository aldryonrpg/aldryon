import { describe, expect, it } from "bun:test";
import { StartBattleRequestSchema } from "@aldryon/dtos";

describe("StartBattleRequestSchema", () => {
  it("accepts every real region", () => {
    for (const region of ["mountain", "forest", "bandit", "sewage", "ruins"]) {
      expect(StartBattleRequestSchema.safeParse({ region }).success).toBe(true);
    }
  });

  it("rejects region: 'dungeon' — the dungeon is not a monster_region (plan3 §2a)", () => {
    const result = StartBattleRequestSchema.safeParse({ region: "dungeon" });
    expect(result.success).toBe(false);
  });
});
