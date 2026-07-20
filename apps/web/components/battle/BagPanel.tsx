import type { BagItemDto } from "@aldryon/dtos";
import { formatAttributeBonuses } from "@/lib/formatAttributeBonuses";
import { formatDisplayName } from "@/lib/formatDisplayName";
import { getRarityColor } from "@/lib/rarityColors";

interface BagPanelProps {
  bag: BagItemDto[];
  normalSlotCapacity: number;
  onUse: (playerItemId: string) => void;
  onEquip: (playerItemId: string) => void;
  disabled: boolean;
}

function BagItemButton({
  item,
  disabled,
  onUse,
  onEquip,
}: {
  item: BagItemDto;
  disabled: boolean;
  onUse: (playerItemId: string) => void;
  onEquip: (playerItemId: string) => void;
}) {
  const bonusText = formatAttributeBonuses(item.attributeBonuses);
  const metaText = [
    item.setName ? `${formatDisplayName(item.setName)} Set` : null,
    bonusText || null,
  ]
    .filter(Boolean)
    .join(" · ");
  return (
    <button
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
}

/** Clicking an equippable item equips it; clicking a consumable uses it
 * (plan3 §9 UI decisions). Renders gracefully when empty — a Growl mid-run
 * can wipe every POT at once, which is an intended punishing moment, not an
 * error state. Split into the same two buckets the backend actually
 * enforces capacity by: Permanent Slots (bandage/antidote/POTs, capacity-
 * exempt, driven by the catalog's isPermanent flag) in green, and the
 * capacity-limited Normal Slots (gear and monster drop parts) in brown. */
export function BagPanel({ bag, normalSlotCapacity, onUse, onEquip, disabled }: BagPanelProps) {
  const permanentItems = bag.filter((item) => item.isPermanent);
  const normalItems = bag.filter((item) => !item.isPermanent);

  return (
    <div>
      {permanentItems.length > 0 && (
        <>
          <div className="border-b border-white px-2 py-1 text-center font-bold text-green-500">
            Permanent Slots:
          </div>
          <div className="grid grid-cols-4 gap-1 p-2">
            {permanentItems.map((item) => (
              <BagItemButton
                key={item.id}
                item={item}
                disabled={disabled}
                onUse={onUse}
                onEquip={onEquip}
              />
            ))}
          </div>
        </>
      )}
      <div className="border-b border-white px-2 py-1 text-center font-bold text-amber-700">
        Normal Slots: ({normalItems.length}/{normalSlotCapacity} Slots)
      </div>
      {normalItems.length > 0 && (
        <div className="grid grid-cols-4 gap-1 p-2">
          {normalItems.map((item) => (
            <BagItemButton
              key={item.id}
              item={item}
              disabled={disabled}
              onUse={onUse}
              onEquip={onEquip}
            />
          ))}
        </div>
      )}
    </div>
  );
}
