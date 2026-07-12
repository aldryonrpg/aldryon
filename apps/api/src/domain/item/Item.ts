import type { AttributeValues } from "@/domain/shared/Attributes";

export type ItemRarity = "common" | "uncommon" | "rare" | "epic" | "legendary";

export type EquipmentSlot =
  | "helmet"
  | "body"
  | "boots"
  | "gloves"
  | "necklace"
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

  get isEquippable(): boolean {
    return this.props.slot !== null;
  }

  get isConsumable(): boolean {
    return this.props.hpRestore !== null;
  }

  toProps(): ItemProps {
    return { ...this.props, attributeBonuses: { ...this.props.attributeBonuses } };
  }
}
