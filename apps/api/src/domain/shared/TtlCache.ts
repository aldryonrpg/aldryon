/**
 * A single-value, in-memory cache with a fixed time-to-live — for hot,
 * rarely-changing, no-input reads (store catalog, dungeon leaderboard).
 * Per-process only: each usecase instance holds its own cache, and each
 * Render replica caches independently — fine for data that's read far more
 * often than it changes and doesn't need cross-replica consistency.
 */
export class TtlCache<T> {
  private value: T | null = null;
  private expiresAt = 0;

  constructor(
    private readonly ttlMs: number,
    private readonly now: () => number = Date.now,
  ) {}

  get(): T | null {
    if (this.value === null || this.now() >= this.expiresAt) return null;
    return this.value;
  }

  /** ttlMsOverride lets a caller expire this particular value on its own
   * schedule (e.g. "end of the current day") instead of the constructor's
   * fixed duration — see msUntilNextUtcMidnight below. */
  set(value: T, ttlMsOverride?: number): void {
    this.value = value;
    this.expiresAt = this.now() + (ttlMsOverride ?? this.ttlMs);
  }
}

/**
 * Same idea as TtlCache, but keyed — for reference data looked up by id
 * where only a handful of distinct keys are hot at once (e.g. a few catalog
 * monsters shared by many concurrent players), so caching just the rows a
 * caller actually asked for beats warming the whole table up front.
 */
export class KeyedTtlCache<K, V> {
  private readonly entries = new Map<K, { value: V; expiresAt: number }>();

  constructor(
    private readonly ttlMs: number,
    private readonly now: () => number = Date.now,
  ) {}

  get(key: K): V | null {
    const entry = this.entries.get(key);
    if (!entry || this.now() >= entry.expiresAt) return null;
    return entry.value;
  }

  /** ttlMsOverride lets a caller shorten this particular entry's lifetime
   * below the constructor's fixed duration (e.g. CachedAuthGateway capping
   * an entry at the token's own remaining exp) — mirrors TtlCache.set. */
  set(key: K, value: V, ttlMsOverride?: number): void {
    this.entries.set(key, { value, expiresAt: this.now() + (ttlMsOverride ?? this.ttlMs) });
  }
}

/**
 * Milliseconds from `now` until the next UTC day boundary — for a cache
 * that should refresh once a day (e.g. the dungeon boss, if it starts
 * rotating daily) without drifting: recompute this at every `set()` rather
 * than caching a fixed 24h duration, so it always lands on the *next*
 * midnight regardless of what time of day the value was first cached. UTC,
 * not server-local time, since the API has no other notion of "the day"
 * (Render's host timezone isn't something this app otherwise depends on).
 */
export function msUntilNextUtcMidnight(now: () => number = Date.now): number {
  const current = new Date(now());
  const nextMidnight = Date.UTC(
    current.getUTCFullYear(),
    current.getUTCMonth(),
    current.getUTCDate() + 1,
  );
  return nextMidnight - current.getTime();
}
