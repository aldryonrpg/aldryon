import type { MonsterRegionDto } from "@aldryon/dtos";

// Bandit/sewage/ruins have no dedicated art yet — fall back to the forest
// background until it exists, rather than a plain black screen.
const REGION_BACKGROUNDS: Record<MonsterRegionDto, string> = {
  mountain: "/backgrounds/background_montain.png",
  forest: "/backgrounds/background_forest.png",
  bandit: "/backgrounds/background_forest.png",
  sewage: "/backgrounds/background_forest.png",
  ruins: "/backgrounds/background_forest.png",
};

const DUNGEON_BACKGROUND = "/backgrounds/background_dungeon.png";

export function getBattleBackgroundImage(isDungeon: boolean, wildRegion: MonsterRegionDto): string {
  return isDungeon ? DUNGEON_BACKGROUND : REGION_BACKGROUNDS[wildRegion];
}
