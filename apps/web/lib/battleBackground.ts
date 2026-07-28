import type { MonsterRegionDto } from "@aldryon/dtos";

// Sewage has no dedicated art yet — fall back to the forest background
// until it exists, rather than a plain black screen.
const REGION_BACKGROUNDS: Record<MonsterRegionDto, string> = {
  mountain: "/backgrounds/background_mountain.png",
  forest: "/backgrounds/background_forest.png",
  bandit: "/backgrounds/background_bandit.png",
  sewage: "/backgrounds/background_forest.png",
  ruins: "/backgrounds/background_ruins.png",
};

const DUNGEON_BACKGROUND = "/backgrounds/background_dungeon.png";

export function getBattleBackgroundImage(isDungeon: boolean, wildRegion: MonsterRegionDto): string {
  return isDungeon ? DUNGEON_BACKGROUND : REGION_BACKGROUNDS[wildRegion];
}
