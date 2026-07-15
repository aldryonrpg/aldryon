import type { EquipmentPositionDto, EquippedItemsDto } from "@aldryon/dtos";

const CELLS: { label: string; position: EquipmentPositionDto }[] = [
  { label: "Helmet", position: "helmet" },
  { label: "Armor", position: "body" },
  { label: "Necklace", position: "necklace" },
  { label: "Bracelet", position: "bracelet" },
  { label: "Gloves", position: "gloves" },
  { label: "Boots", position: "boots" },
  { label: "H", position: "weapon_1" },
  { label: "OF", position: "weapon_2" },
];

interface EquipmentPanelProps {
  equipped: EquippedItemsDto;
  onUnequip: (playerItemId: string) => void;
  disabled: boolean;
}

/** Clicking an occupied cell unequips it; equipping happens from BagPanel
 * (plan3 §9 UI decisions). */
export function EquipmentPanel({ equipped, onUnequip, disabled }: EquipmentPanelProps) {
  return (
    <div className="grid grid-cols-2 gap-1">
      {CELLS.map(({ label, position }) => {
        const item = equipped[position];
        return (
          <button
            key={position}
            type="button"
            disabled={disabled || !item}
            onClick={() => item && onUnequip(item.playerItemId)}
            title={item ? `${item.name} — click to unequip` : label}
            className="flex h-12 w-24 flex-col items-center justify-center border border-white bg-black text-[10px] hover:enabled:bg-stone-800 disabled:cursor-default"
          >
            <span className="text-stone-400">{label}</span>
            {item && (
              <span
                className="w-full truncate px-1 text-center"
                style={{ color: item.rarityColor }}
              >
                {item.name}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
