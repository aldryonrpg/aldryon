import type { Monster, MonsterRegion } from "@/domain/monster/Monster";
import type { MonsterAttack } from "@/domain/monster/MonsterAttack";
import { KeyedTtlCache, TtlCache } from "@/domain/shared/TtlCache";
import type { MonsterAttackRepository } from "@/usecase/monster/MonsterAttackRepository";
import type { MonsterRepository } from "@/usecase/monster/MonsterRepository";

export interface MonsterWithMoveset {
  monster: Monster;
  moveset: MonsterAttack[];
}

const CACHE_TTL_MS = 60 * 60 * 1000;
const SWEEP_INTERVAL_MS = 60 * 1000;

/**
 * Caches monster rows and movesets by monster id (perf follow-up): a
 * battle turn re-reads the same handful of monster ids over and over, and
 * with many concurrent players fighting a small rotating set of catalog
 * monsters, the underlying rows are read far more often than they change —
 * a monster/moveset is only ever written at seed time, or once at dungeon-
 * boss materialization, never updated after. Monster and moveset are
 * cached independently (two separate keyed caches) so a caller that only
 * needs one of them — GetActiveBattleUseCase never needs the moveset;
 * StartBattleUseCase/beginDungeonFight already have the monster in hand and
 * only need the moveset — doesn't pay for fetching or caching the other.
 */
export class MonsterCatalogCache {
  private readonly monsterCache = new KeyedTtlCache<string, Monster>(CACHE_TTL_MS);
  private readonly movesetCache = new KeyedTtlCache<string, MonsterAttack[]>(CACHE_TTL_MS);
  // Only the id *lists* are cached here — the actual Monster objects for
  // those ids live in `monsterCache` above (the same one `getMonster`
  // fills), reused via `getMonster` rather than duplicated. Keeps this one
  // source of truth for monster data instead of a second full-object cache.
  private readonly regionIdsCache = new KeyedTtlCache<MonsterRegion, string[]>(CACHE_TTL_MS);
  private readonly excludingBossesIdsCache = new TtlCache<string[]>(CACHE_TTL_MS);
  // Cross-replica invalidation sweep bookkeeping (plan9 follow-up) — see
  // sweepExternalInvalidations below. Per-cache-instance, so each Render
  // replica tracks its own view independently, same as the caches above.
  private lastSweepAt = 0;
  private readonly lastSeenUpdatedAt = new Map<string, number>();

  constructor(
    private readonly monsterRepository: MonsterRepository,
    private readonly monsterAttackRepository: MonsterAttackRepository,
    private readonly sweepIntervalMs: number = SWEEP_INTERVAL_MS,
  ) {}

  /** Drops a monster's cached row (and moveset) so the next read re-fetches
   * from Postgres — used after an admin edit (plan9 §4) so a live battle
   * doesn't keep seeing the pre-edit stats for up to CACHE_TTL_MS. Doesn't
   * touch the region/exclude-bosses id-list caches: a patch never changes
   * which ids exist, only a create does, and a newly created monster is
   * fine waiting out its own TTL for those rarely-read lists. */
  evict(monsterId: string): void {
    this.monsterCache.delete(monsterId);
    this.movesetCache.delete(monsterId);
  }

  /**
   * `evict()` only clears the cache on the one Render replica that handled
   * an admin's PATCH request — every OTHER replica's `MonsterCatalogCache`
   * instance is a separate in-memory object with no way to hear about that
   * (plan9 follow-up: "we might have like 3 instances"). This closes that
   * gap without a pub/sub layer: at most once per `sweepIntervalMs`, compare
   * every currently-cached id's `updated_at` (Postgres, cheap point-selects)
   * against what this instance last saw for that id. A mismatch means some
   * OTHER process wrote to that row since we cached it, so we evict it here
   * too. Comparing two DB-observed timestamps (never this process's own
   * clock) sidesteps any app/DB clock-skew risk entirely.
   */
  private async sweepExternalInvalidations(): Promise<void> {
    const now = Date.now();
    if (now - this.lastSweepAt < this.sweepIntervalMs) return;
    this.lastSweepAt = now;

    const cachedIds = this.monsterCache.keys();
    if (cachedIds.length === 0) return;

    const current = await this.monsterRepository.findUpdatedAtByIds(cachedIds);
    for (const [id, updatedAt] of Object.entries(current)) {
      const lastSeen = this.lastSeenUpdatedAt.get(id);
      if (lastSeen !== undefined && lastSeen !== updatedAt) {
        this.evict(id);
      }
      this.lastSeenUpdatedAt.set(id, updatedAt);
    }
  }

  async getMonster(monsterId: string): Promise<Monster | null> {
    await this.sweepExternalInvalidations();

    const cached = this.monsterCache.get(monsterId);
    if (cached) return cached;

    const monster = await this.monsterRepository.findById(monsterId);
    if (monster) {
      this.monsterCache.set(monsterId, monster);
      // Baseline lastSeenUpdatedAt right here, at the moment we cache a
      // fresh row — not lazily on whatever later sweep pass first notices
      // this id. Otherwise a change landing between this fetch and that
      // first sweep pass would just get folded into the baseline instead of
      // detected, silently absorbing exactly one external write per id.
      const updatedAt = await this.monsterRepository.findUpdatedAtByIds([monsterId]);
      const seen = updatedAt[monsterId];
      if (seen !== undefined) this.lastSeenUpdatedAt.set(monsterId, seen);
    }
    return monster;
  }

  async getMoveset(monsterId: string): Promise<MonsterAttack[]> {
    const cached = this.movesetCache.get(monsterId);
    if (cached) return cached;

    const moveset = await this.monsterAttackRepository.findMovesetByMonsterId(monsterId);
    this.movesetCache.set(monsterId, moveset);
    return moveset;
  }

  /** Fetches both concurrently — a battle turn always needs the pair, and
   * the moveset lookup only needs the id (already known from the battle
   * row), not the resolved Monster entity, so there's no reason to
   * serialize one behind the other. */
  async getMonsterWithMoveset(monsterId: string): Promise<MonsterWithMoveset | null> {
    const [monster, moveset] = await Promise.all([
      this.getMonster(monsterId),
      this.getMoveset(monsterId),
    ]);
    if (!monster) return null;
    return { monster, moveset };
  }

  /** Region monster lists (StartBattleUseCase's encounter roll) — same TTL
   * convention, but caches only the id list per region, not a second copy
   * of the Monster objects; each id is hydrated through `getMonster` above,
   * so a monster fetched via any path shares the same cache entry. A
   * whole-list-of-objects cache was tried here first (perf follow-up,
   * 2026-07-24) and reverted the same day for duplicating monster data
   * across two caches for no benefit — id-list + per-id hydration avoids
   * that while keeping the same round-trip savings. */
  async getMonstersByRegion(region: MonsterRegion): Promise<Monster[]> {
    const cachedIds = this.regionIdsCache.get(region);
    if (cachedIds) {
      const monsters = await Promise.all(cachedIds.map((id) => this.getMonster(id)));
      return monsters.filter((monster): monster is Monster => monster !== null);
    }

    const monsters = await this.monsterRepository.findAllByRegion(region);
    this.regionIdsCache.set(
      region,
      monsters.map((monster) => monster.id),
    );
    for (const monster of monsters) this.monsterCache.set(monster.id, monster);
    return monsters;
  }

  /** The dungeon step-monster pool (every catalog monster except a
   * materialized boss row) — same id-list-plus-hydration shape as
   * `getMonstersByRegion` above, same rationale. */
  async getMonstersExcludingMaterializedBosses(): Promise<Monster[]> {
    const cachedIds = this.excludingBossesIdsCache.get();
    if (cachedIds) {
      const monsters = await Promise.all(cachedIds.map((id) => this.getMonster(id)));
      return monsters.filter((monster): monster is Monster => monster !== null);
    }

    const monsters = await this.monsterRepository.findAllExcludingMaterializedBosses();
    this.excludingBossesIdsCache.set(monsters.map((monster) => monster.id));
    for (const monster of monsters) this.monsterCache.set(monster.id, monster);
    return monsters;
  }
}
