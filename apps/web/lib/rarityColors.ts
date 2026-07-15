import type { ItemRarityColorsResponse } from "@aldryon/dtos";
import { getItemRarityColors } from "@/lib/api";

const FALLBACK_COLOR = "white";

let cache: ItemRarityColorsResponse | null = null;
let pending: Promise<ItemRarityColorsResponse> | null = null;

/**
 * Fetches the rarity->color mapping once and keeps it in memory for the
 * page's lifetime — safe to call from every protected page; once loaded,
 * repeat calls are no-ops. Call this before rendering anything that needs
 * `getRarityColor`.
 */
export async function loadRarityColors(): Promise<void> {
  if (cache) return;
  if (!pending) pending = getItemRarityColors();
  try {
    cache = await pending;
  } finally {
    pending = null;
  }
}

/** Synchronous lookup — falls back to white if colors haven't loaded yet
 * (e.g. the request is still in flight) or for an unrecognized rarity. */
export function getRarityColor(rarity: string): string {
  return cache?.[rarity as keyof ItemRarityColorsResponse] ?? FALLBACK_COLOR;
}
