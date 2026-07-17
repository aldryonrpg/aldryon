import type { EquipmentSlot, ItemRarity } from "@/domain/item/Item";
import type { AttributeValues } from "@/domain/shared/Attributes";
import { TtlCache } from "@/domain/shared/TtlCache";
import type { ItemRepository } from "@/usecase/item/ItemRepository";

const STORE_CACHE_TTL_MS = 5 * 60 * 1000;

export interface StoreItemOutput {
  id: string;
  name: string;
  description: string;
  price: number;
  slot: EquipmentSlot | null;
  rarity: ItemRarity;
  hpRestore: number | null;
  /** Pots/Bandage/Antidote render in the store's separate consumables
   * section, priced the same as everything else (plan3 Store follow-up). */
  category: "consumable" | "gear";
  /** Null for anything not part of an equipment set. */
  setName: string | null;
  /** Null until item artwork exists — the client falls back to a
   * placeholder SVG circle. */
  itemImage: string | null;
  /** Per-item flat bonuses (0 where an item grants nothing in that
   * attribute). */
  attributeBonuses: AttributeValues;
}

/**
 * GET /store — the store's catalog. Pots, Bandage, Antidote, and every
 * basic gear/weapon item are purchasable this way instead of ever dropping
 * from a monster. `items.value` doubles as the store price — no separate
 * listings table. `storePurchasable` is a per-item flag, not derived from
 * rarity — most rare-and-above items never appear here, but a set tier
 * (e.g. the Iron Set, uncommon) can be marked drop-only despite an
 * otherwise-store-eligible rarity (equipment-sets follow-up).
 *
 * The catalog barely changes (only via migrations) but the store is a hot
 * endpoint, so the listing is cached in-process for 5 minutes rather than
 * re-querying the full catalog on every request.
 */
export class ListStoreItemsUseCase {
  private readonly cache = new TtlCache<StoreItemOutput[]>(STORE_CACHE_TTL_MS);

  constructor(private readonly itemRepository: ItemRepository) {}

  async execute(): Promise<StoreItemOutput[]> {
    const cached = this.cache.get();
    if (cached) return cached;

    const items = await this.itemRepository.findAll();
    const listing = items
      .filter((item) => item.storePurchasable)
      .map((item) => ({
        id: item.id,
        name: item.name,
        description: item.description,
        price: item.value,
        slot: item.slot,
        rarity: item.rarity,
        hpRestore: item.hpRestore,
        // A "consumable" is simply anything you can't equip — every
        // non-slotted item so far (bandage, antidote, POTs, Knowledge
        // Potion) is exactly that; equipment always has a slot.
        category: (item.slot === null ? "consumable" : "gear") as "consumable" | "gear",
        setName: item.setName,
        itemImage: item.itemImage,
        attributeBonuses: item.attributeBonuses,
      }));

    this.cache.set(listing);
    return listing;
  }
}
