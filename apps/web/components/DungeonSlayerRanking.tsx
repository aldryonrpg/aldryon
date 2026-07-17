"use client";

import type { DungeonLeaderboardResponse } from "@aldryon/dtos";
import { useEffect, useState } from "react";
import { getDungeonLeaderboard } from "@/lib/api";

/** Top-50 Dungeon Slayer ranking, always-on-screen at the top right — but
 * only once at least one player has a kill on record. An empty leaderboard
 * would just look like a broken/empty box, so it renders nothing instead. */
export function DungeonSlayerRanking() {
  const [entries, setEntries] = useState<DungeonLeaderboardResponse | null>(null);

  useEffect(() => {
    getDungeonLeaderboard()
      .then(setEntries)
      .catch(() => setEntries(null));
  }, []);

  if (!entries || entries.length === 0) return null;

  return (
    <div className="fixed right-3 top-3 max-h-[70vh] w-56 overflow-y-auto border border-white bg-black text-xs text-stone-100">
      <div className="border-b border-white px-2 py-1 text-center font-bold">
        Dungeon Slayers — Top {entries.length}
      </div>
      <ol className="divide-y divide-stone-700">
        {entries.map((entry, index) => (
          <li
            key={`${entry.playerName ?? "unknown"}-${entry.kills}-${entry.lastKillAt}`}
            className="flex items-center justify-between gap-2 px-2 py-1"
          >
            <span className="truncate">
              {index + 1}. {entry.playerName ?? "Unnamed"}
            </span>
            <span className="shrink-0 text-stone-400">{entry.kills}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
