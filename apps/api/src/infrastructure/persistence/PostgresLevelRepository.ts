import type { SQL } from "bun";
import type { LevelRow } from "@/domain/level/LevelCurve";
import { TtlCache } from "@/domain/shared/TtlCache";
import type { LevelRepository } from "@/usecase/level/LevelRepository";

interface LevelTableRow {
  level: number;
  xp_required: number;
}

const CACHE_TTL_MS = 60 * 60 * 1000;

/**
 * `levels` is the XP curve — seed data, tuned in the DB but never written to
 * at runtime. findAll() is re-read on every kill/death settlement
 * (settleTurn, deathSettlement) across every battle usecase, so caching the
 * whole table (same TTL convention as MonsterCatalogCache) turns every later
 * read into an in-memory lookup.
 */
export class PostgresLevelRepository implements LevelRepository {
  private readonly cache = new TtlCache<LevelRow[]>(CACHE_TTL_MS);

  constructor(private readonly sql: SQL) {}

  async findAll(): Promise<LevelRow[]> {
    const cached = this.cache.get();
    if (cached) return cached;

    const rows = await this.sql<LevelTableRow[]>`select * from levels order by level asc`;
    const levels = rows.map((row) => ({ level: row.level, xpRequired: row.xp_required }));
    this.cache.set(levels);
    return levels;
  }
}
