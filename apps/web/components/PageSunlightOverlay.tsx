"use client";

import { useSunlightGlowStyle } from "@/lib/useSunlightGlow";

/**
 * The Sun Cone glow, fixed over the whole viewport background — works on
 * any route regardless of whether it has an illustrated map frame like the
 * Main Page's, since it isn't scoped to a single container.
 */
export function PageSunlightOverlay() {
  const style = useSunlightGlowStyle();
  if (!style) return null;

  return <div className="pointer-events-none fixed inset-0" style={style} />;
}
