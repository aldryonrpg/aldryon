import type { EquipmentPositionDto, EquippedItemsDto } from "@aldryon/dtos";
import { formatDisplayName } from "@/lib/formatDisplayName";
import { getRarityColor } from "@/lib/rarityColors";

const CELLS: { label: string; position: EquipmentPositionDto }[] = [
  { label: "Helmet", position: "helmet" },
  { label: "Armor", position: "body" },
  { label: "Necklace", position: "necklace" },
  { label: "Bracelet", position: "bracelet" },
  { label: "Gloves", position: "gloves" },
  { label: "Boots", position: "boots" },
  { label: "Hand", position: "weapon_1" },
  { label: "Off-Hand", position: "weapon_2" },
];

interface EquipmentPanelProps {
  equipped: EquippedItemsDto;
  onUnequip: (playerItemId: string) => void;
  disabled: boolean;
}

/** Clicking an occupied cell unequips it; equipping happens from BagPanel
 * (plan3 §9 UI decisions). */
export function EquipmentPanel({ equipped, onUnequip, disabled }: EquipmentPanelProps) {
  // A two-handed weapon only ever occupies weapon_1 (domain/player/
  // Equipment.ts's resolveEquip) — weapon_2 stays empty/unusable the whole
  // time one is held, so rendering it as its own selectable cell reads as a
  // free slot that doesn't actually exist. Spanning the Hand cell across
  // both columns instead shows at a glance that it's taking up both.
  const weapon1 = equipped.weapon_1;
  const isTwoHanded = weapon1?.slot === "two_handed_weapon";

  return (
    <div className="grid grid-cols-2 gap-1">
      {CELLS.map(({ label, position }) => {
        if (isTwoHanded && position === "weapon_2") return null;

        const item = equipped[position];
        const spanBothColumns = isTwoHanded && position === "weapon_1";
        return (
          <button
            key={position}
            type="button"
            disabled={disabled || !item}
            onClick={() => item && onUnequip(item.playerItemId)}
            title={
              item
                ? `${formatDisplayName(item.name)}${
                    item.setName ? ` (${formatDisplayName(item.setName)} Set)` : ""
                  } — click to unequip`
                : label
            }
            className={`flex h-12 flex-col items-center justify-center border border-white bg-black text-[10px] hover:enabled:bg-stone-800 disabled:cursor-default ${
              spanBothColumns ? "col-span-2 w-full" : "w-24"
            }`}
          >
            <span className="text-stone-400">{spanBothColumns ? "Hand (Two-Handed)" : label}</span>
            {item && (
              <span
                className="w-full truncate px-1 text-center"
                style={{ color: getRarityColor(item.rarity) }}
              >
                {formatDisplayName(item.name)}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
