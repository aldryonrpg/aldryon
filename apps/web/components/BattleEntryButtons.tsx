"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useBattleEntry } from "@/lib/useBattleEntry";

/**
 * Starting a Battle/Dungeon or visiting the Store now only happens via the
 * map's own clickable regions (MapRegionHotspots) — this only ever needs to
 * offer resuming an already-in-progress fight plus the always-available
 * Player Sheet link, not duplicate the map's own entry points.
 */
export function BattleEntryButtons() {
  const router = useRouter();
  const { hasActiveBattle } = useBattleEntry();

  return (
    <div className="flex gap-4">
      {hasActiveBattle && (
        <button
          type="button"
          onClick={() => router.push("/battle")}
          className="wood-gold-button rounded-md px-6 py-3 font-medium"
        >
          Resume Battle
        </button>
      )}
      <Link href="/player" className="wood-gold-button rounded-md px-6 py-3 font-medium">
        Player Sheet
      </Link>
    </div>
  );
}
