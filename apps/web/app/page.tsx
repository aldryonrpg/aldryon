import { BattleEntryButtons } from "@/components/BattleEntryButtons";
import { DayNightTimeline } from "@/components/DayNightTimeline";
import { DungeonSlayerRanking } from "@/components/DungeonSlayerRanking";
import { MapImage } from "@/components/MapImage";
import { MapRegionHotspots } from "@/components/MapRegionHotspots";
import { PageSunlightOverlay } from "@/components/PageSunlightOverlay";
import { PlayerStatusCorner } from "@/components/PlayerStatusCorner";

export default function MainPage() {
  return (
    <>
      <DayNightTimeline />
      <PageSunlightOverlay />
      <main className="flex min-h-screen flex-col items-center justify-center gap-8 bg-black p-8">
        <div className="relative w-full max-w-[922px]">
          <MapImage />
          <MapRegionHotspots />
        </div>
        <BattleEntryButtons />
        <PlayerStatusCorner />
        <DungeonSlayerRanking />
      </main>
    </>
  );
}
