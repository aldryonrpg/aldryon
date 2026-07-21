"use client";

import { useEffect, useState } from "react";

export const DEFAULT_TIME_OF_DAY_UPDATE_INTERVAL_MS = 15_000;

export interface TimeOfDay {
  now: Date;
  /** Fraction of the current local day elapsed: 0 at local midnight, 0.5 at
   * local noon, approaching 1 just before the next midnight. */
  dayFraction: number;
}

/**
 * The player's current local time, re-read on an interval — shared by
 * DayNightTimeline, MapImage, and the sunlight glow so they all derive from
 * one clock instead of each polling independently. Returns null until
 * mounted: the initializer
 * deliberately isn't `new Date()` on first render, because the server and
 * the browser would evaluate "now" at different instants, and any
 * time-derived value rendered from that would mismatch between SSR and
 * hydration. The real clock only starts once this effect runs, which is
 * guaranteed to be client-only, post-hydration.
 */
export function useTimeOfDay(
  updateIntervalMs = DEFAULT_TIME_OF_DAY_UPDATE_INTERVAL_MS,
): TimeOfDay | null {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), updateIntervalMs);
    return () => clearInterval(id);
  }, [updateIntervalMs]);

  if (!now) return null;

  const secondsIntoDay = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
  return { now, dayFraction: secondsIntoDay / 86400 };
}
