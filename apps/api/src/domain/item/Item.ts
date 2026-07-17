import type { AttributeValues } from "@/domain/shared/Attributes";

/**
 * Full rarity ladder (plan3 Store follow-up). 'basic' is store-only stock,
 * never a monster drop. The rest is the drop ladder in ascending rarity —
 * common 60% / uncommon 30% / rare 6% / very_rare 3% / legendary ~1% or
 * less is the intended content-authoring proportion for future drop-pool
 * dropRate values (a design guideline, not runtime-enforced — the domain
 * layer has no I/O to cross-check a drop pool's rarities against the item
 * catalog at validation time). Only exclusive_drops pools are meant to
 * ever reference 'rare' and above — regular drops pools stay basic/common/
 * uncommon — again a content convention, not a runtime check. 'unique'
 * means at most one such item ever exists on the server, hand-placed.
 */
export type ItemRarity =
  | "basic"
  | "common"
  | "uncommon"
  | "rare"
  | "very_rare"
  | "legendary"
  | "unique";

export type EquipmentSlot =
  | "helmet"
  | "body"
  | "boots"
  | "gloves"
  | "necklace"
  | "bracelet"
  | "weapon"
  | "two_handed_weapon";

export interface ItemProps {
  id: string;
  name: string;
  description: string;
  value: number;
  rarity: ItemRarity;
  slot: EquipmentSlot | null;
  attributeBonuses: AttributeValues;
  hpRestore: number | null;
  /** Knowledge Potion only — reveals every monster attribute at once when
   * consumed from the Bag, unlike REVEAL SPELL's one-at-a-time reveal. */
  revealsAllMonsterAttributes: boolean;
  /** Null for anything not part of an equipment set (weapons, consumables,
   * unique items). Equipping all 6 non-weapon slots from the same set name
   * grants a flat +2-all-attributes bonus — see `computeSetBonus`. */
  setName: string | null;
  /** Decoupled from `rarity` — the store lists basic/common/uncommon items
   * by default, but a set tier can be an uncommon-or-rarer rarity that's
   * still drop-only (e.g. the Iron Set), never store stock. */
  storePurchasable: boolean;
  /** Null until item artwork exists — the client falls back to a placeholder
   * SVG circle rather than treating this as required, unlike Monster's
   * `monsterImage`. */
  itemImage: string | null;
}

/** Item catalog entry (plan2 §3b). Immutable — items are catalog data. */
export class Item {
  private constructor(private readonly props: ItemProps) {}

  static create(props: ItemProps): Item {
    if (props.value < 0) {
      throw new Error("Item value must be >= 0");
    }
    if (props.hpRestore !== null && props.hpRestore <= 0) {
      throw new Error("Item hpRestore must be > 0 when set");
    }
    return new Item(props);
  }

  get id(): string {
    return this.props.id;
  }
  get name(): string {
    return this.props.name;
  }
  get description(): string {
    return this.props.description;
  }
  get value(): number {
    return this.props.value;
  }
  get rarity(): ItemRarity {
    return this.props.rarity;
  }
  get slot(): EquipmentSlot | null {
    return this.props.slot;
  }
  get attributeBonuses(): AttributeValues {
    return { ...this.props.attributeBonuses };
  }
  get hpRestore(): number | null {
    return this.props.hpRestore;
  }
  get revealsAllMonsterAttributes(): boolean {
    return this.props.revealsAllMonsterAttributes;
  }
  get setName(): string | null {
    return this.props.setName;
  }
  get storePurchasable(): boolean {
    return this.props.storePurchasable;
  }
  get itemImage(): string | null {
    return this.props.itemImage;
  }

  get isEquippable(): boolean {
    return this.props.slot !== null;
  }

  get isConsumable(): boolean {
    return this.props.hpRestore !== null || this.props.revealsAllMonsterAttributes;
  }

  toProps(): ItemProps {
    return { ...this.props, attributeBonuses: { ...this.props.attributeBonuses } };
  }
}
