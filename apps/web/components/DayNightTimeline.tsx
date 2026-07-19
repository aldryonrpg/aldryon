"use client";

import { DEFAULT_TIME_OF_DAY_UPDATE_INTERVAL_MS, useTimeOfDay } from "@/lib/useTimeOfDay";

// A simple fixed day/night split (no geolocation, no real sunrise/sunset
// math) — good enough for a decorative clock, not meant to be astronomically
// accurate.
const DAY_START_HOUR = 6;
const DAY_END_HOUR = 18;

// A shallow arc (a flattened rainbow, not a full semicircle) — the icon
// rises from one edge, peaks at the midpoint, and settles at the other
// edge, rather than sliding along a hard horizontal line. These are an
// internal SVG coordinate space, not real pixels — the container is sized
// with CSS (width: 90%, aspect-ratio), and the SVG's viewBox scales this
// arc to fit whatever width that resolves to.
const ARC_VIEWBOX_WIDTH = 1000;
const ARC_BASELINE_Y = 80;
const ARC_PEAK_RISE = 50;

/** Point at t (0-1) along the quadratic Bezier baseline->peak->baseline, as
 * a fraction (0-1) of the viewBox's width/height — used for both the drawn
 * track (which takes raw viewBox units) and the icon (which is a plain HTML
 * element positioned by percentage, so it scales with the container). */
function pointOnArc(t: number): { xPercent: number; yPercent: number } {
  const controlX = ARC_VIEWBOX_WIDTH / 2;
  const controlY = ARC_BASELINE_Y - ARC_PEAK_RISE;
  const x = (1 - t) ** 2 * 0 + 2 * (1 - t) * t * controlX + t ** 2 * ARC_VIEWBOX_WIDTH;
  const y = (1 - t) ** 2 * ARC_BASELINE_Y + 2 * (1 - t) * t * controlY + t ** 2 * ARC_BASELINE_Y;
  return { xPercent: (x / ARC_VIEWBOX_WIDTH) * 100, yPercent: (y / ARC_BASELINE_Y) * 100 };
}

function SunIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-full w-full" aria-hidden="true">
      <circle cx="12" cy="12" r="5" fill="#facc15" />
      <g stroke="#facc15" strokeWidth="1.5" strokeLinecap="round">
        <line x1="12" y1="1" x2="12" y2="4" />
        <line x1="12" y1="20" x2="12" y2="23" />
        <line x1="1" y1="12" x2="4" y2="12" />
        <line x1="20" y1="12" x2="23" y2="12" />
        <line x1="4.2" y1="4.2" x2="6.3" y2="6.3" />
        <line x1="17.7" y1="17.7" x2="19.8" y2="19.8" />
        <line x1="4.2" y1="19.8" x2="6.3" y2="17.7" />
        <line x1="17.7" y1="6.3" x2="19.8" y2="4.2" />
      </g>
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-full w-full" aria-hidden="true">
      <path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z" fill="#cbd5e1" />
    </svg>
  );
}

/**
 * A thin 24-hour timeline showing the player's own local time of day — a
 * Sun/Moon icon slides left to right across it and snaps back to the left
 * edge at local midnight. Self-contained (reads the browser clock directly,
 * no props), so any page can drop it in as a fixed overlay layer; currently
 * rendered on the main page and the player sheet.
 */
export function DayNightTimeline() {
  const timeOfDay = useTimeOfDay();

  // The outer layer is `fixed`, not `relative` — it's pinned to the
  // viewport and pulled out of normal document flow entirely, so it can
  // never push page content around or reflow oddly at narrower breakpoints
  // (mobile/tablet). Flexbox centers the 90%-wide arc within that full-width
  // fixed strip. `relative` still appears one level down, on the arc box
  // itself — that's a different, required use of it: an anchor for its own
  // absolutely-positioned children (the SVG track and the icon), not for
  // placing the component on the page.
  const arcStyle = { aspectRatio: `${ARC_VIEWBOX_WIDTH} / ${ARC_BASELINE_Y}` };

  if (!timeOfDay) {
    return (
      <div className="pointer-events-none fixed inset-x-0 top-0 z-20 flex justify-center">
        <div className="relative w-[90%]" style={arcStyle} />
      </div>
    );
  }

  const { now, dayFraction } = timeOfDay;
  const isDaytime = now.getHours() >= DAY_START_HOUR && now.getHours() < DAY_END_HOUR;
  const iconPos = pointOnArc(dayFraction);
  const controlX = ARC_VIEWBOX_WIDTH / 2;
  const controlY = ARC_BASELINE_Y - ARC_PEAK_RISE;

  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-20 flex justify-center">
      <div className="relative w-[90%]" style={arcStyle}>
        <svg
          viewBox={`0 0 ${ARC_VIEWBOX_WIDTH} ${ARC_BASELINE_Y}`}
          className="absolute inset-0 h-full w-full"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <path
            d={`M 0 ${ARC_BASELINE_Y} Q ${controlX} ${controlY} ${ARC_VIEWBOX_WIDTH} ${ARC_BASELINE_Y}`}
            fill="none"
            stroke="rgba(255,255,255,0.25)"
            strokeWidth={1}
            strokeDasharray="4 8"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
        <div
          className="pointer-events-auto absolute h-5 w-5"
          style={{
            left: `${iconPos.xPercent}%`,
            top: `${iconPos.yPercent}%`,
            transform: "translate(-50%, -50%)",
            transitionProperty: "left, top",
            transitionDuration: `${DEFAULT_TIME_OF_DAY_UPDATE_INTERVAL_MS}ms`,
            transitionTimingFunction: "linear",
          }}
          title={now.toLocaleTimeString()}
        >
          {isDaytime ? <SunIcon /> : <MoonIcon />}
        </div>
      </div>
    </div>
  );
}
