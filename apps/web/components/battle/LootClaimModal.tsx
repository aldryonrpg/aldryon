interface LootClaimModalProps {
  itemIds: string[];
  itemDetails: Map<string, { name: string; rarityColor: string }>;
  onClaimAll: () => void;
  onDismiss: () => void;
  loading: boolean;
}

export function LootClaimModal({
  itemIds,
  itemDetails,
  onClaimAll,
  onDismiss,
  loading,
}: LootClaimModalProps) {
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black/70">
      <div className="w-72 border border-white bg-black p-4">
        <p className="mb-2 font-bold">Loot!</p>
        <ul className="mb-3 space-y-1 text-sm">
          {itemIds.map((id) => {
            const detail = itemDetails.get(id);
            return (
              <li key={id} style={{ color: detail?.rarityColor }}>
                {detail?.name ?? id}
              </li>
            );
          })}
        </ul>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onDismiss}
            disabled={loading}
            className="border border-white px-3 py-1 text-sm hover:enabled:bg-stone-800 disabled:opacity-50"
          >
            Later
          </button>
          <button
            type="button"
            onClick={onClaimAll}
            disabled={loading}
            className="border border-white bg-white px-3 py-1 text-sm text-black hover:enabled:bg-stone-200 disabled:opacity-50"
          >
            Claim All
          </button>
        </div>
      </div>
    </div>
  );
}
