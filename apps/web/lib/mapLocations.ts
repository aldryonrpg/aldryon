import type { MonsterRegionDto } from "@aldryon/dtos";

export type MapLocationId = "mountain" | "ruins" | "castle" | "forest" | "village" | "cave";

export type MapLocationAction =
  | { kind: "battle"; region: MonsterRegionDto }
  | { kind: "dungeon" }
  | { kind: "store" };

export interface MapLocation {
  id: MapLocationId;
  label: string;
  action: MapLocationAction;
  /** Percentages of the map image's own box — same percentage-of-container
   * approach as DayNightTimeline/MapNightOverlay, so it scales with the
   * image regardless of rendered size. Eyeballed from mapa.png, not
   * pixel-measured — expect to nudge these once seen rendered. */
  xPercent: number;
  yPercent: number;
  widthPercent: number;
  heightPercent: number;
}

export const MAP_LOCATIONS: MapLocation[] = [
  {
    id: "mountain",
    label: "Mountain Pass",
    action: { kind: "battle", region: "mountain" },
    // ~10% bigger than the original 19x20 box, grown from its own center.
    xPercent: 13,
    yPercent: 9,
    widthPercent: 21,
    heightPercent: 22,
  },
  {
    id: "ruins",
    label: "Ancient Ruins",
    action: { kind: "battle", region: "ruins" },
    // Shifted down 20 points, then back up 10 (net yPercent 8 -> 18).
    xPercent: 70,
    yPercent: 18,
    widthPercent: 20,
    heightPercent: 22,
  },
  {
    id: "castle",
    label: "Store",
    action: { kind: "store" },
    // Shifted down ~30% earlier (yPercent 22 -> 30); ~10% smaller than that
    // 16x28 box, shrunk toward its own center; nudged 2 points right.
    xPercent: 45,
    yPercent: 31,
    widthPercent: 14,
    heightPercent: 25,
  },
  {
    id: "forest",
    label: "Forest",
    action: { kind: "battle", region: "forest" },
    xPercent: 16,
    yPercent: 58,
    widthPercent: 17,
    heightPercent: 27,
  },
  {
    id: "village",
    label: "Bandit Camp",
    action: { kind: "battle", region: "bandit" },
    // ~10% smaller than the original 18x26 box, shrunk toward its own
    // center — shrinking it (rather than moving castle further) is what
    // keeps it from crowding the now-lower castle/Store hotspot.
    xPercent: 42,
    yPercent: 63,
    widthPercent: 16,
    heightPercent: 23,
  },
  {
    id: "cave",
    label: "Dungeon",
    action: { kind: "dungeon" },
    // Net position after several rounds of nudging: shifted right, pulled
    // back, shrunk ~10% twice over, shifted left 3 more points.
    xPercent: 71,
    yPercent: 64,
    widthPercent: 17,
    heightPercent: 23,
  },
];
