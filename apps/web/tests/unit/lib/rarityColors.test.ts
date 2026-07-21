import { describe, expect, it } from "bun:test";
import { getRarityColor } from "@/lib/rarityColors";

describe("getRarityColor", () => {
  it("falls back to white before loadRarityColors() has ever resolved", () => {
    // Deliberately never calls loadRarityColors() here — this test is only
    // about the synchronous fallback path (server-side colors not loaded
    // yet, or the request still in flight), not the fetch itself.
    expect(getRarityColor("legendary")).toBe("white");
  });

  it("falls back to white for a rarity string the map doesn't recognize", () => {
    expect(getRarityColor("not-a-real-rarity")).toBe("white");
  });
});
