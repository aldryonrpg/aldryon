export type EquipmentPosition =
  | "helmet"
  | "body"
  | "boots"
  | "gloves"
  | "necklace"
  | "weapon_1"
  | "weapon_2";

export interface PlayerItemProps {
  id: string;
  playerId: string;
  itemId: string;
  equippedSlot: EquipmentPosition | null;
  quantity: number;
}

/** One bag slot or equipped item (plan2 §3d). */
export class PlayerItem {
  private constructor(private readonly props: PlayerItemProps) {}

  static create(props: PlayerItemProps): PlayerItem {
    if (props.quantity < 1 || props.quantity > 5) {
      throw new Error("PlayerItem quantity must be between 1 and 5");
    }
    return new PlayerItem(props);
  }

  get id(): string {
    return this.props.id;
  }
  get playerId(): string {
    return this.props.playerId;
  }
  get itemId(): string {
    return this.props.itemId;
  }
  get equippedSlot(): EquipmentPosition | null {
    return this.props.equippedSlot;
  }
  get quantity(): number {
    return this.props.quantity;
  }
  get isEquipped(): boolean {
    return this.props.equippedSlot !== null;
  }

  toProps(): PlayerItemProps {
    return { ...this.props };
  }
}
