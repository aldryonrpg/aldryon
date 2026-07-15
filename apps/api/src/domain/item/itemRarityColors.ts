import type { ItemRarity } from "@/domain/item/Item";

/**
 * Display color per rarity tier (plan3 Store follow-up) — item names
 * always render in their rarity's color. Mirrors the seeded
 * item_rarity_colors table; kept here as a static constant rather than a
 * per-request DB join since it's static reference data that essentially
 * never changes.
 */
export const ITEM_RARITY_COLORS: Record<ItemRarity, string> = {
  basic: "white",
  common: "gray",
  uncommon: "green",
  rare: "blue",
  very_rare: "purple",
  legendary: "gold",
  unique: "red",
};
