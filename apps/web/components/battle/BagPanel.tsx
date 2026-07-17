import type { BagItemDto } from "@aldryon/dtos";
import { formatAttributeBonuses } from "@/lib/formatAttributeBonuses";
import { formatDisplayName } from "@/lib/formatDisplayName";
import { getRarityColor } from "@/lib/rarityColors";

interface BagPanelProps {
  bag: BagItemDto[];
  onUse: (playerItemId: string) => void;
  onEquip: (playerItemId: string) => void;
  disabled: boolean;
}

/** Clicking an equippable item equips it; clicking a consumable uses it
 * (plan3 §9 UI decisions). Renders gracefully when empty — a Growl mid-run
 * can wipe every POT at once, which is an intended punishing moment, not an
 * error state. */
export function BagPanel({ bag, onUse, onEquip, disabled }: BagPanelProps) {
  return (
    <div className="w-60 border border-white bg-black">
      <div className="border-b border-white px-2 py-1 text-center font-bold">Bag</div>
      {bag.length === 0 ? (
        <p className="p-3 text-center text-xs text-stone-400">Empty</p>
      ) : (
        <div className="grid grid-cols-4 gap-1 p-2">
          {bag.map((item) => {
            const bonusText = formatAttributeBonuses(item.attributeBonuses);
            const metaText = [
              item.setName ? `${formatDisplayName(item.setName)} Set` : null,
              bonusText || null,
            ]
              .filter(Boolean)
              .join(" · ");
            return (
              <button
                key={item.id}
                type="button"
                disabled={disabled}
                onClick={() => (item.slot ? onEquip(item.id) : onUse(item.id))}
                title={`${formatDisplayName(item.name)} x${item.quantity}${metaText ? ` (${metaText})` : ""}`}
                className="flex h-16 w-14 flex-col items-center justify-center border border-white bg-black text-[9px] leading-tight hover:enabled:bg-stone-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <span
                  className="w-full truncate px-0.5 text-center"
                  style={{ color: getRarityColor(item.rarity) }}
                >
                  {formatDisplayName(item.name)}
                </span>
                <span className="text-stone-400">x{item.quantity}</span>
                {metaText && (
                  <span className="w-full truncate px-0.5 text-center text-[7px] text-stone-500">
                    {metaText}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
