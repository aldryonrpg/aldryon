"use client";

import type { MonsterRegionDto } from "@aldryon/dtos";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ApiError, getActiveBattle, startBattle, startDungeon } from "@/lib/api";

const RESUMABLE_ERROR_CODES = new Set(["BATTLE_IN_PROGRESS", "DUNGEON_RUN_IN_PROGRESS"]);

export interface BattleEntry {
  /** null while the initial GET /battle check is still in flight. */
  hasActiveBattle: boolean | null;
  loading: "battle" | "dungeon" | null;
  error: string | null;
  startBattleAndEnter(region: MonsterRegionDto): Promise<void>;
  startDungeonAndEnter(): Promise<void>;
}

/**
 * Shared by BattleEntryButtons and MapRegionHotspots — both need the same
 * "is there already a battle/dungeon run in progress" check and the same
 * start-then-navigate behavior, including resuming into /battle instead of
 * dead-ending on a raw error message when the backend reports one already in
 * progress. /battle itself already knows how to render the right state
 * (live battle, or a dungeon Continue/Exit prompt) once you land on it, so
 * the fix for either "already in progress" code is simply navigating there.
 */
export function useBattleEntry(): BattleEntry {
  const router = useRouter();
  const [hasActiveBattle, setHasActiveBattle] = useState<boolean | null>(null);
  const [loading, setLoading] = useState<"battle" | "dungeon" | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getActiveBattle()
      .then((battle) => setHasActiveBattle(battle !== null))
      .catch(() => setHasActiveBattle(false));
  }, []);

  async function enter(kind: "battle" | "dungeon", action: () => Promise<unknown>) {
    setError(null);
    setLoading(kind);
    try {
      await action();
      router.push("/battle");
    } catch (err) {
      if (err instanceof ApiError && err.code && RESUMABLE_ERROR_CODES.has(err.code)) {
        router.push("/battle");
        return;
      }
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(null);
    }
  }

  return {
    hasActiveBattle,
    loading,
    error,
    startBattleAndEnter: (region) => enter("battle", () => startBattle(region)),
    startDungeonAndEnter: () => enter("dungeon", () => startDungeon()),
  };
}
