"use client";

import type { CSSProperties } from "react";
import { DAY_END_HOUR, DAY_START_HOUR, isDaytime, pointOnArc } from "@/components/DayNightTimeline";
import { DEFAULT_TIME_OF_DAY_UPDATE_INTERVAL_MS, useTimeOfDay } from "@/lib/useTimeOfDay";

// Brightest overhead at solar noon, fading to nothing at dawn/dusk — sun
// hours only run dayFraction 0.25-0.75 (6am/6pm, same window as
// DAY_START_HOUR/DAY_END_HOUR), so that's the window this maps onto a
// 0..1..0 hump rather than a full 24h cosine.
const PEAK_INTENSITY = 0.5;
const SUNRISE = DAY_START_HOUR / 24;
const SUNSET = DAY_END_HOUR / 24;

// The beam's shape: a narrow point at the sun (top) widening into a cone by
// the bottom of the container — both are half-widths (percent of the
// container's own box, which is what clip-path polygon() percentages
// resolve against), so the full apex/base width is double each.
const CONE_APEX_HALF_WIDTH_PERCENT = 2;
const CONE_BASE_HALF_WIDTH_PERCENT = 28;

function sunlightIntensity(dayFraction: number): number {
  const t = (dayFraction - SUNRISE) / (SUNSET - SUNRISE);
  return PEAK_INTENSITY * Math.sin(Math.PI * Math.min(1, Math.max(0, t)));
}

/**
 * The directional light-cone ("Sun Cone") style, consumed by
 * PageSunlightOverlay — derives its sun position/intensity from
 * DayNightTimeline's own arc math (`pointOnArc`/`dayFraction`) so the beam
 * always agrees with where the Sun icon itself is drawn. The beam itself is
 * a clip-path trapezoid (a point at the sun, widening downward) filled with
 * a top-to-bottom fade, rather than a plain radial glow, so it reads as a
 * shaft of light falling from that point instead of an ambient wash. Returns
 * null outside sun hours — callers render nothing then, same as the moon
 * casting no light.
 */
export function useSunlightGlowStyle(): CSSProperties | null {
  const timeOfDay = useTimeOfDay();
  if (!timeOfDay) return null;

  const { now, dayFraction } = timeOfDay;
  if (!isDaytime(now)) return null;

  const { xPercent } = pointOnArc(dayFraction);
  const intensity = sunlightIntensity(dayFraction);

  const apexLeft = xPercent - CONE_APEX_HALF_WIDTH_PERCENT;
  const apexRight = xPercent + CONE_APEX_HALF_WIDTH_PERCENT;
  const baseLeft = xPercent - CONE_BASE_HALF_WIDTH_PERCENT;
  const baseRight = xPercent + CONE_BASE_HALF_WIDTH_PERCENT;

  return {
    clipPath: `polygon(${apexLeft}% 0%, ${apexRight}% 0%, ${baseRight}% 100%, ${baseLeft}% 100%)`,
    background: `linear-gradient(to bottom, rgba(255,232,168,${intensity}) 0%, rgba(255,232,168,${intensity * 0.35}) 45%, transparent 100%)`,
    filter: "blur(18px)",
    mixBlendMode: "screen",
    transitionProperty: "clip-path, background",
    transitionDuration: `${DEFAULT_TIME_OF_DAY_UPDATE_INTERVAL_MS}ms`,
    transitionTimingFunction: "linear",
  };
}
