import type { BagItemDto } from "@aldryon/dtos";

function ItemName({ name, color }: { name: string; color: string }) {
  return (
    <span className="font-bold" style={{ color }}>
      {name}
    </span>
  );
}

interface LootScreenProps {
  bag: BagItemDto[];
  /** Item ids from the kill's lootOffer that haven't been claimed (or
   * rejected) yet. */
  lootOfferIds: string[];
  itemDetailsById: Map<string, { name: string; rarityColor: string }>;
  busy: boolean;
  onDestroy: (playerItemId: string) => void;
  onClaim: (itemId: string) => void;
  onContinue: () => void;
  onExit: () => void;
  continueLabel: string;
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
  continueLabel,
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
                    <ItemName name={item.name} color={item.rarityColor} />
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
                      color={detail?.rarityColor ?? "white"}
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
        <button
          type="button"
          onClick={onContinue}
          disabled={busy}
          className="border border-white bg-white px-6 py-2 font-medium text-black hover:enabled:bg-stone-200 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {continueLabel}
        </button>
        <button
          type="button"
          onClick={onExit}
          disabled={busy}
          className="border border-white px-6 py-2 font-medium hover:enabled:bg-stone-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Exit
        </button>
      </div>
    </div>
  );
}
