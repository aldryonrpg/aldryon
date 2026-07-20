"use client";

import type { MonsterRegionDto, StartBattleResponse, StartDungeonResponse } from "@aldryon/dtos";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ApiError, getActiveBattle, startBattle, startDungeon } from "@/lib/api";

const RESUMABLE_ERROR_CODES = new Set(["BATTLE_IN_PROGRESS", "DUNGEON_RUN_IN_PROGRESS"]);

// Relays a missed-encounter message across the /battle navigation — Start
// has an ~20% chance of coming back with monster: null (no battle row ever
// gets created), which /battle's own mount fetch can't see on its own since
// it's a fresh GET. sessionStorage is the simplest way to hand that one
// message across without threading it through the URL. See battle/page.tsx.
export const EMPTY_ENCOUNTER_STORAGE_KEY = "aldryon:pendingEmptyEncounterMessage";

// Remembers which region a wild battle was started in, since the Battle row
// itself carries no region — /battle's Continue action needs this to re-roll
// from the SAME region instead of guessing, including across the empty-
// encounter case above where no battle row exists at all yet.
export const WILD_REGION_STORAGE_KEY = "aldryon:wildRegion";

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

  async function enter(
    kind: "battle" | "dungeon",
    action: () => Promise<StartBattleResponse | StartDungeonResponse>,
  ) {
    setError(null);
    setLoading(kind);
    try {
      const result = await action();
      if (result.monster === null) {
        sessionStorage.setItem(EMPTY_ENCOUNTER_STORAGE_KEY, result.message ?? "You found nothing.");
      }
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
    startBattleAndEnter: (region) => {
      sessionStorage.setItem(WILD_REGION_STORAGE_KEY, region);
      return enter("battle", () => startBattle(region));
    },
    startDungeonAndEnter: () => enter("dungeon", () => startDungeon()),
  };
}
