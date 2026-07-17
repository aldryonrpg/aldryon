"use client";

import type {
  AttributeValuesDto,
  BagItemDto,
  PlayerProfileResponse,
  StoreItemDto,
} from "@aldryon/dtos";
import Link from "next/link";
import { useEffect, useState } from "react";
import { getPlayerProfile, getStoreListing, purchaseItem, sellItem } from "@/lib/api";
import { formatAttributeBonuses } from "@/lib/formatAttributeBonuses";
import { formatDisplayName } from "@/lib/formatDisplayName";
import { getRarityColor, loadRarityColors } from "@/lib/rarityColors";

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
    <span>
      <span className="font-bold" style={{ color: getRarityColor(rarity) }}>
        {formatDisplayName(name)}
      </span>
      {setName && (
        <span className="ml-1 text-xs text-stone-400">({formatDisplayName(setName)} Set)</span>
      )}
      {bonusText && <span className="block text-xs text-stone-400">{bonusText}</span>}
    </span>
  );
}

function BagList({
  bag,
  sellingId,
  onSell,
}: {
  bag: BagItemDto[];
  sellingId: string | null;
  onSell: (item: BagItemDto) => void;
}) {
  return (
    <div className="border border-white bg-black p-3">
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
                onClick={() => onSell(item)}
                disabled={sellingId === item.id}
                className="border border-white px-2 py-0.5 text-xs hover:enabled:bg-stone-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {sellingId === item.id ? "Selling..." : `Sell ${item.value * item.quantity}g`}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ItemImageSlot({ itemImage, name }: { itemImage: string | null; name: string }) {
  if (itemImage) {
    return (
      // biome-ignore lint/performance/noImgElement: tolerant of a missing/broken src (no real CDN yet), unlike next/image
      <img
        src={itemImage}
        alt={name}
        className="h-[60px] w-20 rounded border border-white object-cover"
        onError={(e) => {
          e.currentTarget.style.display = "none";
        }}
      />
    );
  }
  return (
    <svg
      viewBox="0 0 80 60"
      className="h-[60px] w-20 rounded border border-white"
      role="img"
      aria-label={`${name} (no image)`}
    >
      <circle cx="40" cy="30" r="18" fill="none" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

function StoreItemCard({
  item,
  gold,
  buying,
  onBuy,
}: {
  item: StoreItemDto;
  gold: number;
  buying: boolean;
  onBuy: () => void;
}) {
  return (
    <div className="flex gap-3 border border-white bg-black p-3 text-sm">
      <ItemImageSlot itemImage={item.itemImage} name={item.name} />
      <div className="flex flex-1 flex-col gap-1">
        <ItemName
          name={item.name}
          rarity={item.rarity}
          setName={item.setName}
          attributeBonuses={item.attributeBonuses}
        />
        <p className="text-stone-400">{item.description}</p>
        {item.slot && <p className="text-xs text-stone-500">Slot: {item.slot}</p>}
        {item.hpRestore !== null && (
          <p className="text-xs text-stone-500">Restores {item.hpRestore} HP</p>
        )}
        <div className="mt-2 flex items-center justify-between">
          <span>{item.price}g</span>
          <button
            type="button"
            onClick={onBuy}
            disabled={buying || gold < item.price}
            className="border border-white bg-black px-3 py-1 hover:enabled:bg-stone-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {buying ? "Buying..." : "Buy"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function StorePage() {
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<PlayerProfileResponse | null>(null);
  const [items, setItems] = useState<StoreItemDto[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [buyingId, setBuyingId] = useState<string | null>(null);
  const [sellingId, setSellingId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [profileResult, listing] = await Promise.all([
          getPlayerProfile(),
          getStoreListing(),
          loadRarityColors(),
        ]);
        if (cancelled) return;
        setProfile(profileResult);
        setItems(listing);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load the store");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleBuy(item: StoreItemDto) {
    setBuyingId(item.id);
    setError(null);
    try {
      const result = await purchaseItem(item.id);
      const refreshedProfile = await getPlayerProfile();
      setProfile(refreshedProfile);
      void result;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Purchase failed");
    } finally {
      setBuyingId(null);
    }
  }

  async function handleSell(item: BagItemDto) {
    setSellingId(item.id);
    setError(null);
    try {
      await sellItem(item.id);
      const refreshedProfile = await getPlayerProfile();
      setProfile(refreshedProfile);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sale failed");
    } finally {
      setSellingId(null);
    }
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-black text-stone-100">
        Loading...
      </main>
    );
  }

  if (!profile) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-black text-stone-100">
        <p>{error ?? "Failed to load your profile."}</p>
        <Link href="/" className="border border-white px-4 py-2 hover:bg-stone-800">
          Return to Map
        </Link>
      </main>
    );
  }

  const consumables = items.filter((item) => item.category === "consumable");
  const gear = items.filter((item) => item.category === "gear");

  return (
    <main className="min-h-screen bg-black p-6 text-stone-100">
      <div className="mx-auto flex max-w-5xl flex-col gap-4">
        <div className="flex items-center justify-between border border-white bg-black px-4 py-2">
          <span className="font-bold">Store</span>
          <span>Gold: {profile.gold}</span>
          <Link href="/" className="border border-white px-3 py-1 text-sm hover:bg-stone-800">
            Return to Map
          </Link>
        </div>

        {error && <p className="text-sm text-red-400">{error}</p>}

        <div className="grid grid-cols-1 gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
          <BagList bag={profile.bag} sellingId={sellingId} onSell={handleSell} />

          <div className="flex flex-col gap-4">
            <div>
              <p className="mb-2 font-bold">Potions &amp; Cures</p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {consumables.map((item) => (
                  <StoreItemCard
                    key={item.id}
                    item={item}
                    gold={profile.gold}
                    buying={buyingId === item.id}
                    onBuy={() => handleBuy(item)}
                  />
                ))}
              </div>
            </div>

            <div>
              <p className="mb-2 font-bold">Gear</p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {gear.map((item) => (
                  <StoreItemCard
                    key={item.id}
                    item={item}
                    gold={profile.gold}
                    buying={buyingId === item.id}
                    onBuy={() => handleBuy(item)}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
