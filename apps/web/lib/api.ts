import type {
  ActiveBattleResponse,
  AllocateAttributePointsResponse,
  AttributeKeyDto,
  ClaimLootResponse,
  ContinueDungeonResponse,
  CreateAttackRequest,
  CreateAttackResponse,
  CreateDungeonBossRequest,
  CreateDungeonBossResponse,
  CreateItemRequest,
  CreateItemResponse,
  CreateMonsterAttackRequest,
  CreateMonsterAttackResponse,
  CreateMonsterRequest,
  CreateMonsterResponse,
  DestroyBagItemResponse,
  DungeonLeaderboardResponse,
  EquipItemResponse,
  ExitDungeonRunResponse,
  GetDungeonBossNormalAttacksResponse,
  GetDungeonBossSpecialAttacksResponse,
  GetMonsterNormalAttacksResponse,
  ItemCatalogResponse,
  ItemRarityColorsResponse,
  ListAttacksAdminResponse,
  ListDungeonBossesAdminResponse,
  ListItemsAdminResponse,
  ListMonsterAttacksAdminResponse,
  ListMonstersAdminResponse,
  LoginResponse,
  MonsterRegionDto,
  PatchAttackRequest,
  PatchAttackResponse,
  PatchDungeonBossRequest,
  PatchDungeonBossResponse,
  PatchItemRequest,
  PatchItemResponse,
  PatchMonsterAttackRequest,
  PatchMonsterAttackResponse,
  PatchMonsterRequest,
  PatchMonsterResponse,
  PatchPlayerResponse,
  PlayerProfileResponse,
  PurchaseItemResponse,
  SellItemResponse,
  SetDungeonBossNormalAttacksResponse,
  SetDungeonBossSpecialAttacksResponse,
  SetMonsterNormalAttacksResponse,
  StartBattleResponse,
  StartDungeonResponse,
  StoreListResponse,
  TurnReportDto,
} from "@aldryon/dtos";
import { createClient } from "@/lib/supabase/client";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

/** Thrown by authedFetch on any non-OK response — carries the backend's
 * structured `error.code` (e.g. "BATTLE_IN_PROGRESS") alongside the
 * human-readable message, so callers can branch on the code instead of
 * matching against message text. */
export class ApiError extends Error {
  constructor(
    message: string,
    public readonly code: string | undefined,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

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
    throw new ApiError(message, body?.error?.code);
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}

export function getPlayerProfile(): Promise<PlayerProfileResponse> {
  return authedFetch("/player");
}

export function updatePlayerName(playerName: string): Promise<PatchPlayerResponse> {
  return authedFetch("/player", { method: "PATCH", body: JSON.stringify({ playerName }) });
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

export function sellItem(playerItemId: string): Promise<SellItemResponse> {
  return authedFetch("/store/sell", { method: "POST", body: JSON.stringify({ playerItemId }) });
}

export function listMonstersAdmin(): Promise<ListMonstersAdminResponse> {
  return authedFetch("/admin/monsters");
}

export function createMonsterAdmin(input: CreateMonsterRequest): Promise<CreateMonsterResponse> {
  return authedFetch("/admin/monsters", { method: "POST", body: JSON.stringify(input) });
}

export function patchMonsterAdmin(
  id: string,
  patch: PatchMonsterRequest,
): Promise<PatchMonsterResponse> {
  return authedFetch(`/admin/monsters/${id}`, { method: "PATCH", body: JSON.stringify(patch) });
}

/** Normalized to a plain string[] (unwrapping the `{normalAttackIds}`
 * envelope) so callers/UI don't need to know the response field name — same
 * for the other 5 moveset get/set functions below. */
export async function getMonsterNormalAttacksAdmin(id: string): Promise<string[]> {
  const res = await authedFetch<GetMonsterNormalAttacksResponse>(
    `/admin/monsters/${id}/normal-attacks`,
  );
  return res.normalAttackIds;
}

export async function setMonsterNormalAttacksAdmin(
  id: string,
  attackIds: string[],
): Promise<string[]> {
  const res = await authedFetch<SetMonsterNormalAttacksResponse>(
    `/admin/monsters/${id}/normal-attacks`,
    { method: "PUT", body: JSON.stringify({ attackIds }) },
  );
  return res.normalAttackIds;
}

export function listDungeonBossesAdmin(): Promise<ListDungeonBossesAdminResponse> {
  return authedFetch("/admin/dungeon-bosses");
}

export function createDungeonBossAdmin(
  input: CreateDungeonBossRequest,
): Promise<CreateDungeonBossResponse> {
  return authedFetch("/admin/dungeon-bosses", { method: "POST", body: JSON.stringify(input) });
}

export async function getDungeonBossNormalAttacksAdmin(id: string): Promise<string[]> {
  const res = await authedFetch<GetDungeonBossNormalAttacksResponse>(
    `/admin/dungeon-bosses/${id}/normal-attacks`,
  );
  return res.normalAttackIds;
}

export async function setDungeonBossNormalAttacksAdmin(
  id: string,
  attackIds: string[],
): Promise<string[]> {
  const res = await authedFetch<SetDungeonBossNormalAttacksResponse>(
    `/admin/dungeon-bosses/${id}/normal-attacks`,
    { method: "PUT", body: JSON.stringify({ attackIds }) },
  );
  return res.normalAttackIds;
}

export async function getDungeonBossSpecialAttacksAdmin(id: string): Promise<string[]> {
  const res = await authedFetch<GetDungeonBossSpecialAttacksResponse>(
    `/admin/dungeon-bosses/${id}/special-attacks`,
  );
  return res.specialAttackIds;
}

export async function setDungeonBossSpecialAttacksAdmin(
  id: string,
  attackIds: string[],
): Promise<string[]> {
  const res = await authedFetch<SetDungeonBossSpecialAttacksResponse>(
    `/admin/dungeon-bosses/${id}/special-attacks`,
    { method: "PUT", body: JSON.stringify({ attackIds }) },
  );
  return res.specialAttackIds;
}

export function patchDungeonBossAdmin(
  id: string,
  patch: PatchDungeonBossRequest,
): Promise<PatchDungeonBossResponse> {
  return authedFetch(`/admin/dungeon-bosses/${id}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
}

export function listItemsAdmin(): Promise<ListItemsAdminResponse> {
  return authedFetch("/admin/items");
}

export function createItemAdmin(input: CreateItemRequest): Promise<CreateItemResponse> {
  return authedFetch("/admin/items", { method: "POST", body: JSON.stringify(input) });
}

export function patchItemAdmin(id: string, patch: PatchItemRequest): Promise<PatchItemResponse> {
  return authedFetch(`/admin/items/${id}`, { method: "PATCH", body: JSON.stringify(patch) });
}

export function listAttacksAdmin(): Promise<ListAttacksAdminResponse> {
  return authedFetch("/admin/attacks");
}

export function createAttackAdmin(input: CreateAttackRequest): Promise<CreateAttackResponse> {
  return authedFetch("/admin/attacks", { method: "POST", body: JSON.stringify(input) });
}

export function patchAttackAdmin(
  id: string,
  patch: PatchAttackRequest,
): Promise<PatchAttackResponse> {
  return authedFetch(`/admin/attacks/${id}`, { method: "PATCH", body: JSON.stringify(patch) });
}

export function listMonsterAttacksAdmin(): Promise<ListMonsterAttacksAdminResponse> {
  return authedFetch("/admin/monster-attacks");
}

export function createMonsterAttackAdmin(
  input: CreateMonsterAttackRequest,
): Promise<CreateMonsterAttackResponse> {
  return authedFetch("/admin/monster-attacks", { method: "POST", body: JSON.stringify(input) });
}

export function patchMonsterAttackAdmin(
  id: string,
  patch: PatchMonsterAttackRequest,
): Promise<PatchMonsterAttackResponse> {
  return authedFetch(`/admin/monster-attacks/${id}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
}
