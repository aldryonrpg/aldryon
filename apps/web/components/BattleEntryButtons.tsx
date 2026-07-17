"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getActiveBattle, startBattle, startDungeon } from "@/lib/api";

function StoreLink() {
  return (
    <Link
      href="/store"
      className="rounded-md border border-white px-6 py-3 font-medium text-stone-100 shadow-lg transition hover:bg-stone-800"
    >
      Store
    </Link>
  );
}

function PlayerLink() {
  return (
    <Link
      href="/player"
      className="rounded-md border border-white px-6 py-3 font-medium text-stone-100 shadow-lg transition hover:bg-stone-800"
    >
      Player Sheet
    </Link>
  );
}

export function BattleEntryButtons() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<"battle" | "dungeon" | null>(null);
  const [hasActiveBattle, setHasActiveBattle] = useState<boolean | null>(null);

  useEffect(() => {
    getActiveBattle()
      .then((battle) => setHasActiveBattle(battle !== null))
      .catch(() => setHasActiveBattle(false));
  }, []);

  async function handleBattle() {
    setError(null);
    setLoading("battle");
    try {
      // No region picker yet — forest is the only seeded wild encounter
      // (the Snake), so this is the smallest useful smoke test.
      await startBattle("forest");
      router.push("/battle");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setLoading(null);
    }
  }

  async function handleDungeon() {
    setError(null);
    setLoading("dungeon");
    try {
      await startDungeon();
      router.push("/battle");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setLoading(null);
    }
  }

  if (hasActiveBattle) {
    return (
      <div className="flex gap-4">
        <button
          type="button"
          onClick={() => router.push("/battle")}
          className="rounded-md bg-white px-6 py-3 font-medium text-stone-900 shadow-lg transition hover:bg-stone-200"
        >
          Resume Battle
        </button>
        <StoreLink />
        <PlayerLink />
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex gap-4">
        <button
          type="button"
          onClick={handleBattle}
          disabled={loading !== null || hasActiveBattle === null}
          className="rounded-md bg-white px-6 py-3 font-medium text-stone-900 shadow-lg transition hover:bg-stone-200 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading === "battle" ? "Entering..." : "Battle"}
        </button>
        <button
          type="button"
          onClick={handleDungeon}
          disabled={loading !== null || hasActiveBattle === null}
          className="rounded-md bg-red-800 px-6 py-3 font-medium text-stone-100 shadow-lg transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading === "dungeon" ? "Entering..." : "Dungeon"}
        </button>
        <StoreLink />
        <PlayerLink />
      </div>
      {error && <p className="max-w-md text-center text-sm text-red-400">{error}</p>}
    </div>
  );
}
