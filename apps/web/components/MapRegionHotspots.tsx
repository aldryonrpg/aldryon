"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { MAP_LOCATIONS, type MapLocation } from "@/lib/mapLocations";
import { useBattleEntry } from "@/lib/useBattleEntry";

/**
 * One clickable overlay per illustrated map location (mountain/ruins/
 * castle/forest/village/cave — see mapLocations.ts), each triggering its
 * mapped battle region, the dungeon, or the store. Shares useBattleEntry
 * with BattleEntryButtons, so the "already in progress" resume behavior and
 * the loading state are consistent between both entry points.
 */
export function MapRegionHotspots() {
  const router = useRouter();
  const { loading, error, startBattleAndEnter, startDungeonAndEnter } = useBattleEntry();
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  function handleClick(location: MapLocation) {
    if (loading !== null) return;
    switch (location.action.kind) {
      case "battle":
        startBattleAndEnter(location.action.region);
        return;
      case "dungeon":
        startDungeonAndEnter();
        return;
      case "store":
        router.push("/store");
    }
  }

  return (
    <div className="absolute inset-0">
      {MAP_LOCATIONS.map((location) => (
        <button
          key={location.id}
          type="button"
          onClick={() => handleClick(location)}
          onMouseEnter={() => setHoveredId(location.id)}
          onMouseLeave={() => setHoveredId((prev) => (prev === location.id ? null : prev))}
          disabled={loading !== null}
          className="absolute cursor-pointer rounded-full transition hover:bg-white/10 disabled:cursor-not-allowed"
          style={{
            left: `${location.xPercent}%`,
            top: `${location.yPercent}%`,
            width: `${location.widthPercent}%`,
            height: `${location.heightPercent}%`,
          }}
        >
          {hoveredId === location.id && (
            <span className="-translate-x-1/2 pointer-events-none absolute -top-6 left-1/2 z-10 whitespace-nowrap rounded bg-black/80 px-2 py-1 text-stone-100 text-xs">
              {location.label}
            </span>
          )}
        </button>
      ))}
      {error && (
        <p className="-translate-x-1/2 pointer-events-none absolute bottom-1 left-1/2 rounded bg-black/80 px-3 py-1 text-center text-red-400 text-xs">
          {error}
        </p>
      )}
    </div>
  );
}
