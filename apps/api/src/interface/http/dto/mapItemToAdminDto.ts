import type { ItemAdminDto } from "@aldryon/dtos";
import type { Item } from "@/domain/item/Item";

export function mapItemToAdminDto(item: Item): ItemAdminDto {
  const props = item.toProps();
  return {
    id: props.id,
    name: props.name,
    description: props.description,
    value: props.value,
    rarity: props.rarity,
    slot: props.slot,
    attributeBonuses: props.attributeBonuses,
    hpRestore: props.hpRestore,
    revealsAllMonsterAttributes: props.revealsAllMonsterAttributes,
    setName: props.setName,
    storePurchasable: props.storePurchasable,
    itemImage: props.itemImage,
    isPermanent: props.isPermanent,
  };
}
