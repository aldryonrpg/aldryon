"use client";

import Image from "next/image";
import { useMapNightOpacity } from "@/lib/useMapNightOpacity";
import { DEFAULT_TIME_OF_DAY_UPDATE_INTERVAL_MS } from "@/lib/useTimeOfDay";

/**
 * The main-page map illustration (mapa.png), fading toward
 * `useMapNightOpacity`'s value overnight instead of a separate dimming
 * layer on top of it (superseded MapNightOverlay).
 */
export function MapImage() {
  const opacity = useMapNightOpacity();

  return (
    <Image
      src="/mapa.png"
      alt=""
      width={1024}
      height={479}
      priority
      className="h-auto w-full"
      style={{
        opacity,
        transitionProperty: "opacity",
        transitionDuration: `${DEFAULT_TIME_OF_DAY_UPDATE_INTERVAL_MS}ms`,
        transitionTimingFunction: "linear",
      }}
    />
  );
}
