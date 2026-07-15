import type {
  ActiveBattleResponse,
  AllocateAttributePointsResponse,
  AttributeKeyDto,
  ClaimLootResponse,
  ContinueDungeonResponse,
  DestroyBagItemResponse,
  DungeonLeaderboardResponse,
  EquipItemResponse,
  ExitDungeonRunResponse,
  ItemCatalogResponse,
  ItemRarityColorsResponse,
  LoginResponse,
  MonsterRegionDto,
  PlayerProfileResponse,
  PurchaseItemResponse,
  StartBattleResponse,
  StartDungeonResponse,
  StoreListResponse,
  TurnReportDto,
} from "@aldryon/dtos";
import { createClient } from "@/lib/supabase/client";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export async function loginWithSupabaseToken(supabaseAccessToken: string): Promise<LoginResponse> {
  const res = await fetch(`${API_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ supabaseAccessToken }),
  });

  if (!res.ok) {
    throw new Error(`Login failed with status ${res.status}`);
  }

  return res.json();
}

async function getAccessToken(): Promise<string> {
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) throw new Error("Not authenticated");
  return session.access_token;
}

/**
 * Every protected battle/player/dungeon/item endpoint goes through here —
 * the Supabase access token as an `Authorization: Bearer` header, matching
 * apps/api's authMiddleware. Surfaces the backend's own `{error:{message}}`
 * body when present (403 below-level, 429 daily-limit/run-cooldown, 409
 * already-in-battle, ...) instead of a bare status code.
 */
async function authedFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = await getAccessToken();
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...init.headers,
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    const message = body?.error?.message ?? `Request to ${path} failed with status ${res.status}`;
    throw new Error(message);
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}

export function getPlayerProfile(): Promise<PlayerProfileResponse> {
  return authedFetch("/player");
}

export function getActiveBattle(): Promise<ActiveBattleResponse> {
  return authedFetch("/battle");
}

export function getItemCatalog(): Promise<ItemCatalogResponse> {
  return authedFetch("/items");
}

export function getItemRarityColors(): Promise<ItemRarityColorsResponse> {
  return authedFetch("/items/rarity-colors");
}

export function startBattle(region: MonsterRegionDto): Promise<StartBattleResponse> {
  return authedFetch("/battle/start", { method: "POST", body: JSON.stringify({ region }) });
}

export function startDungeon(): Promise<StartDungeonResponse> {
  return authedFetch("/dungeon/start", { method: "POST", body: JSON.stringify({}) });
}

export function continueDungeon(): Promise<ContinueDungeonResponse> {
  return authedFetch("/dungeon/continue", { method: "POST", body: JSON.stringify({}) });
}

export function exitDungeonRun(): Promise<ExitDungeonRunResponse> {
  return authedFetch("/dungeon/exit", { method: "POST", body: JSON.stringify({}) });
}

export function getDungeonLeaderboard(): Promise<DungeonLeaderboardResponse> {
  return authedFetch("/dungeon/leaderboard");
}

export function attack(attackName: string): Promise<TurnReportDto> {
  return authedFetch("/battle/attack", { method: "POST", body: JSON.stringify({ attackName }) });
}

export function useBagItem(playerItemId: string): Promise<TurnReportDto> {
  return authedFetch("/battle/bag", { method: "POST", body: JSON.stringify({ playerItemId }) });
}

export function rest(): Promise<TurnReportDto> {
  return authedFetch("/battle/rest", { method: "POST" });
}

export function runFromBattle(): Promise<TurnReportDto> {
  return authedFetch("/battle/run", { method: "POST" });
}

export function claimLoot(picks: string[]): Promise<ClaimLootResponse> {
  return authedFetch("/battle/loot", { method: "POST", body: JSON.stringify({ picks }) });
}

export function equipItem(
  playerItemId: string,
  preferredWeaponPosition?: "weapon_1" | "weapon_2",
): Promise<EquipItemResponse> {
  return authedFetch("/player/equip", {
    method: "POST",
    body: JSON.stringify({ playerItemId, preferredWeaponPosition }),
  });
}

export function unequipItem(playerItemId: string): Promise<EquipItemResponse> {
  return authedFetch("/player/unequip", { method: "POST", body: JSON.stringify({ playerItemId }) });
}

export function destroyBagItem(playerItemId: string): Promise<DestroyBagItemResponse> {
  return authedFetch("/player/bag/destroy", {
    method: "POST",
    body: JSON.stringify({ playerItemId }),
  });
}

export function allocateAttributePoints(
  allocations: Partial<Record<AttributeKeyDto, number>>,
): Promise<AllocateAttributePointsResponse> {
  return authedFetch("/player/attributes", {
    method: "POST",
    body: JSON.stringify({ allocations }),
  });
}

export function getStoreListing(): Promise<StoreListResponse> {
  return authedFetch("/store");
}

export function purchaseItem(itemId: string): Promise<PurchaseItemResponse> {
  return authedFetch("/store/purchase", { method: "POST", body: JSON.stringify({ itemId }) });
}
