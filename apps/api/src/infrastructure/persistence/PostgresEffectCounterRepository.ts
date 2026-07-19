import type { SQL } from "bun";
import type { BattleEffectKind } from "@/domain/monster/MonsterAttack";
import { TtlCache } from "@/domain/shared/TtlCache";
import type { EffectCounterRepository } from "@/usecase/battle/EffectCounterRepository";

interface EffectRow {
  effect_kind: BattleEffectKind;
  item_counter_id: string | null;
}

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

/**
 * `effect` is a fixed 6-row table (one per BattleEffectKind), seeded once and
 * never written to at runtime — a battle turn can call findByKind up to 3x
 * (player's proc, monster's innate effect, monster's extra special effect),
 * so caching the whole table after the first read turns every later lookup
 * into an in-memory Map.get, no round-trip at all.
 */
export class PostgresEffectCounterRepository implements EffectCounterRepository {
  private readonly cache = new TtlCache<Map<BattleEffectKind, string | null>>(CACHE_TTL_MS);

  constructor(private readonly sql: SQL) {}

  async findByKind(kind: BattleEffectKind): Promise<string | null> {
    const table = await this.getOrLoadTable();
    return table.get(kind) ?? null;
  }

  private async getOrLoadTable(): Promise<Map<BattleEffectKind, string | null>> {
    const cached = this.cache.get();
    if (cached) return cached;

    const rows = await this.sql<EffectRow[]>`select effect_kind, item_counter_id from effect`;
    const table = new Map(rows.map((row) => [row.effect_kind, row.item_counter_id]));
    this.cache.set(table);
    return table;
  }
}
