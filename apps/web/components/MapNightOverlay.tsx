"use client";

import { DEFAULT_TIME_OF_DAY_UPDATE_INTERVAL_MS, useTimeOfDay } from "@/lib/useTimeOfDay";

// 0% at local noon (dayFraction 0.5), this much at local midnight
// (dayFraction 0 or 1).
const MIDNIGHT_OPACITY = 0.25;

/** Cosine curve between the two: eases in/out smoothly around dawn/dusk
 * instead of dimming linearly, and is symmetric around noon/midnight. */
function nightOpacity(dayFraction: number): number {
  return (MIDNIGHT_OPACITY / 2) * (1 - Math.cos(2 * Math.PI * (dayFraction - 0.5)));
}

/**
 * A gray dimming layer over the main map, matching DayNightTimeline's clock —
 * darkest at local midnight, fully clear at local noon. Fills whatever
 * positioned (`relative`) element the caller wraps around the map image.
 * Not interactive — this is only the lighting effect; clickable region
 * hotspots for choosing a battle area are a separate follow-up.
 */
export function MapNightOverlay() {
  const timeOfDay = useTimeOfDay();

  if (!timeOfDay) return null;

  return (
    <div
      className="pointer-events-none absolute inset-0 bg-black"
      style={{
        opacity: nightOpacity(timeOfDay.dayFraction),
        transitionProperty: "opacity",
        transitionDuration: `${DEFAULT_TIME_OF_DAY_UPDATE_INTERVAL_MS}ms`,
        transitionTimingFunction: "linear",
      }}
    />
  );
}
