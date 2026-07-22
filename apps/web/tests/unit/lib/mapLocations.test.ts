import { describe, expect, it } from "bun:test";
import { MAP_LOCATIONS } from "@/lib/mapLocations";

describe("MAP_LOCATIONS", () => {
  it("has exactly 6 locations, one per map hotspot", () => {
    expect(MAP_LOCATIONS.length).toBe(6);
  });

  it("has a unique id per location", () => {
    const ids = MAP_LOCATIONS.map((location) => location.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("keeps every hotspot's box fully inside the map image (0-100%)", () => {
    for (const location of MAP_LOCATIONS) {
      expect(location.xPercent).toBeGreaterThanOrEqual(0);
      expect(location.yPercent).toBeGreaterThanOrEqual(0);
      expect(location.xPercent + location.widthPercent).toBeLessThanOrEqual(100);
      expect(location.yPercent + location.heightPercent).toBeLessThanOrEqual(100);
    }
  });

  it("gives every hotspot a positive, clickable size", () => {
    for (const location of MAP_LOCATIONS) {
      expect(location.widthPercent).toBeGreaterThan(0);
      expect(location.heightPercent).toBeGreaterThan(0);
    }
  });

  it("maps the dungeon location to the dungeon action, not a battle region", () => {
    const cave = MAP_LOCATIONS.find((location) => location.id === "cave");
    expect(cave?.action).toEqual({ kind: "dungeon" });
  });

  it("maps the castle location to the store action", () => {
    const castle = MAP_LOCATIONS.find((location) => location.id === "castle");
    expect(castle?.action).toEqual({ kind: "store" });
  });
});
