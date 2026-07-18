"use client";

import { useEffect, useState } from "react";

// Recomputed on every tick — matches the CSS transition duration below so
// the icon glides continuously between ticks instead of visibly jumping.
const UPDATE_INTERVAL_MS = 15_000;

// A simple fixed day/night split (no geolocation, no real sunrise/sunset
// math) — good enough for a decorative clock, not meant to be astronomically
// accurate.
const DAY_START_HOUR = 6;
const DAY_END_HOUR = 18;

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
 * no props), so any page can drop it in; currently only rendered on the
 * main page.
 */
export function DayNightTimeline() {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), UPDATE_INTERVAL_MS);
    return () => clearInterval(id);
  }, []);

  const secondsIntoDay = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
  const percentOfDay = (secondsIntoDay / 86400) * 100;
  const isDaytime = now.getHours() >= DAY_START_HOUR && now.getHours() < DAY_END_HOUR;

  return (
    <div className="relative h-8 w-full border-b border-white bg-black">
      <div
        className="absolute top-1/2 h-5 w-5"
        style={{
          left: `${percentOfDay}%`,
          transform: "translate(-50%, -50%)",
          transitionProperty: "left",
          transitionDuration: `${UPDATE_INTERVAL_MS}ms`,
          transitionTimingFunction: "linear",
        }}
        title={now.toLocaleTimeString()}
      >
        {isDaytime ? <SunIcon /> : <MoonIcon />}
      </div>
    </div>
  );
}
