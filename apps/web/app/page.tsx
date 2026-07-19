import Image from "next/image";
import { BattleEntryButtons } from "@/components/BattleEntryButtons";
import { DayNightTimeline } from "@/components/DayNightTimeline";
import { DungeonSlayerRanking } from "@/components/DungeonSlayerRanking";
import { MapNightOverlay } from "@/components/MapNightOverlay";
import { PlayerStatusCorner } from "@/components/PlayerStatusCorner";

export default function MainPage() {
  return (
    <>
      <DayNightTimeline />
      <main className="flex min-h-screen flex-col items-center justify-center gap-8 bg-black p-8">
        <div className="relative w-full max-w-[922px]">
          <Image
            src="/mapa.png"
            alt=""
            width={1024}
            height={479}
            priority
            className="h-auto w-full"
          />
          <MapNightOverlay />
        </div>
        <BattleEntryButtons />
        <PlayerStatusCorner />
        <DungeonSlayerRanking />
      </main>
    </>
  );
}
