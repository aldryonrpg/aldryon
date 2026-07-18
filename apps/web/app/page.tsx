import Image from "next/image";
import { BattleEntryButtons } from "@/components/BattleEntryButtons";
import { DayNightTimeline } from "@/components/DayNightTimeline";
import { DungeonSlayerRanking } from "@/components/DungeonSlayerRanking";
import { PlayerStatusCorner } from "@/components/PlayerStatusCorner";

export default function MainPage() {
  return (
    <>
      <DayNightTimeline />
      <main className="flex min-h-screen flex-col items-center justify-center gap-8 bg-black p-8">
        <Image
          src="/mapa.png"
          alt=""
          width={1024}
          height={479}
          priority
          className="h-auto w-full max-w-3xl"
        />
        <BattleEntryButtons />
        <PlayerStatusCorner />
        <DungeonSlayerRanking />
      </main>
    </>
  );
}
