"use client";

import { DAY_END_HOUR, DAY_START_HOUR, isDaytime } from "@/components/DayNightTimeline";
import { useTimeOfDay } from "@/lib/useTimeOfDay";

// How much the map fades by at the dead center of the night — 25% off, so
// 75% opacity at local midnight. A full 100% the moment the Sun Cone is out
// (daytime), easing back down/up at each end of the night rather than
// stepping abruptly at the sunset/sunrise boundary.
const MIDNIGHT_OPACITY_LOSS = 0.25;

const SUNRISE = DAY_START_HOUR / 24;
const SUNSET = DAY_END_HOUR / 24;
const NIGHT_DURATION = 1 - (SUNSET - SUNRISE);

/** How far into the night we are: 0 right at sunset, 1 right at the next
 * sunrise, 0.5 at local midnight. Wraps across the day boundary since night
 * spans it (e.g. 6pm-6am) — only meaningful when it's not daytime. */
function nightProgress(dayFraction: number): number {
  const elapsedSinceSunset =
    dayFraction >= SUNSET ? dayFraction - SUNSET : dayFraction + (1 - SUNSET);
  return elapsedSinceSunset / NIGHT_DURATION;
}

/**
 * The map image's own opacity (not a separate dimming layer) — steady 100%
 * for as long as the Sun Cone is out, only dipping at night: eases down from
 * 100% right after sunset to `1 - MIDNIGHT_OPACITY_LOSS` at local midnight,
 * then back to 100% by sunrise. A cosine hump, not linear, so both ends are
 * smooth rather than kinking at the sunset/sunrise instant.
 */
export function useMapNightOpacity(): number {
  const timeOfDay = useTimeOfDay();
  if (!timeOfDay) return 1;

  const { now, dayFraction } = timeOfDay;
  if (isDaytime(now)) return 1;

  const progress = nightProgress(dayFraction);
  return 1 - (MIDNIGHT_OPACITY_LOSS / 2) * (1 - Math.cos(2 * Math.PI * progress));
}
