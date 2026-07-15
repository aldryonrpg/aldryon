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

  set(value: T): void {
    this.value = value;
    this.expiresAt = this.now() + this.ttlMs;
  }
}
