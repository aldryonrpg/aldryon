import type { AttributeValuesDto, BagItemDto } from "@aldryon/dtos";
import { formatAttributeBonuses } from "@/lib/formatAttributeBonuses";
import { formatDisplayName } from "@/lib/formatDisplayName";
import { getRarityColor } from "@/lib/rarityColors";

function ItemName({
  name,
  rarity,
  setName,
  attributeBonuses,
}: {
  name: string;
  rarity: string;
  setName: string | null;
  attributeBonuses: AttributeValuesDto;
}) {
  const bonusText = formatAttributeBonuses(attributeBonuses);
  return (
    <span className="flex flex-col">
      <span className="flex items-center gap-1">
        <span className="font-bold" style={{ color: getRarityColor(rarity) }}>
          {formatDisplayName(name)}
        </span>
        {setName && (
          <span className="text-xs text-stone-400">({formatDisplayName(setName)} Set)</span>
        )}
      </span>
      {bonusText && <span className="text-xs text-stone-400">{bonusText}</span>}
    </span>
  );
}

const ZERO_ATTRIBUTE_BONUSES: AttributeValuesDto = {
  strength: 0,
  dexterity: 0,
  agility: 0,
  intelligence: 0,
  vitality: 0,
  luck: 0,
};

interface LootScreenProps {
  bag: BagItemDto[];
  /** Item ids from the kill's lootOffer that haven't been claimed (or
   * rejected) yet. */
  lootOfferIds: string[];
  itemDetailsById: Map<
    string,
    { name: string; rarity: string; setName: string | null; attributeBonuses: AttributeValuesDto }
  >;
  busy: boolean;
  onDestroy: (playerItemId: string) => void;
  onClaim: (itemId: string) => void;
  onContinue: () => void;
  onExit: () => void;
  /** False when this win just killed a dungeon run's boss — the run is
   * over, so Continue is hidden entirely rather than offered (it would
   * otherwise silently start an unrelated wild battle instead of doing
   * nothing useful). True for every other win (wild kill, or a regular
   * dungeon step kill that still has more steps/the boss ahead). */
  showContinue: boolean;
}

/**
 * The end-of-fight screen (loot-system follow-up) — Bag on the left (with a
 * free-standing Destroy action on every item, always available regardless
 * of whether any pick needs the room), the kill's drops on the right (one
 * Claim button per item), Continue/Exit at the bottom. Replaces the old
 * small "Claim All" LootClaimModal + bare "Return to Map" link.
 */
export function LootScreen({
  bag,
  lootOfferIds,
  itemDetailsById,
  busy,
  onDestroy,
  onClaim,
  onContinue,
  onExit,
  showContinue,
}: LootScreenProps) {
  return (
    <div className="flex w-full max-w-3xl flex-col gap-4 border border-white bg-black p-4">
      <p className="text-center font-bold">Victory!</p>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="border border-white p-3">
          <p className="mb-2 font-bold">Bag</p>
          {bag.length === 0 ? (
            <p className="text-sm text-stone-400">Empty</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {bag.map((item) => (
                <li key={item.id} className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2">
                    <ItemName
                      name={item.name}
                      rarity={item.rarity}
                      setName={item.setName}
                      attributeBonuses={item.attributeBonuses}
                    />
                    <span className="text-stone-400">x{item.quantity}</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => onDestroy(item.id)}
                    disabled={busy}
                    className="border border-white px-2 py-0.5 text-xs hover:enabled:bg-stone-800 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Destroy
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="border border-white p-3">
          <p className="mb-2 font-bold">Drops</p>
          {lootOfferIds.length === 0 ? (
            <p className="text-sm text-stone-400">Nothing dropped</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {lootOfferIds.map((itemId) => {
                const detail = itemDetailsById.get(itemId);
                return (
                  <li key={itemId} className="flex items-center justify-between gap-2">
                    <ItemName
                      name={detail?.name ?? itemId}
                      rarity={detail?.rarity ?? "basic"}
                      setName={detail?.setName ?? null}
                      attributeBonuses={detail?.attributeBonuses ?? ZERO_ATTRIBUTE_BONUSES}
                    />
                    <button
                      type="button"
                      onClick={() => onClaim(itemId)}
                      disabled={busy}
                      className="border border-white bg-white px-2 py-0.5 text-xs text-black hover:enabled:bg-stone-200 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Claim
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      <div className="flex justify-center gap-4">
        {showContinue && (
          <button
            type="button"
            onClick={onContinue}
            disabled={busy}
            className="battle-button rounded-md px-6 py-2 font-medium disabled:cursor-not-allowed disabled:opacity-50"
          >
            Continue
          </button>
        )}
        <button
          type="button"
          onClick={onExit}
          disabled={busy}
          className="battle-button rounded-md px-6 py-2 font-medium disabled:cursor-not-allowed disabled:opacity-50"
        >
          Exit
        </button>
      </div>
    </div>
  );
}
