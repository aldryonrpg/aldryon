"use client";

import { useEffect, useState } from "react";
import { getPlayerProfile } from "@/lib/api";

interface CornerStats {
  playerName: string | null;
  level: number;
  xp: number;
  lastDeathAt: string | null;
}

function formatLastDeath(lastDeathAt: string | null): string {
  if (!lastDeathAt) return "Never";
  return new Date(lastDeathAt).toLocaleString();
}

/** Small always-on-screen readout: level, XP, and when the player last died
 * (or "Never") — a quick-glance corner readout, not a full profile panel. */
export function PlayerStatusCorner() {
  const [stats, setStats] = useState<CornerStats | null>(null);

  useEffect(() => {
    getPlayerProfile()
      .then((profile) =>
        setStats({
          playerName: profile.playerName,
          level: profile.level,
          xp: profile.xp,
          lastDeathAt: profile.lastDeathAt,
        }),
      )
      .catch(() => setStats(null));
  }, []);

  if (!stats) return null;

  return (
    <div className="fixed bottom-3 left-3 flex flex-col gap-0.5 text-xs text-stone-400">
      {stats.playerName && <span>{stats.playerName}</span>}
      <span>Level: {stats.level}</span>
      <span>XP: {stats.xp}</span>
      <span>Last Death: {formatLastDeath(stats.lastDeathAt)}</span>
    </div>
  );
}
