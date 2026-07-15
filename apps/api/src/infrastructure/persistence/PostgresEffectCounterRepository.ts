import type { SQL } from "bun";
import type { BattleEffectKind } from "@/domain/monster/MonsterAttack";
import type { EffectCounterRepository } from "@/usecase/battle/EffectCounterRepository";

interface EffectRow {
  item_counter_id: string | null;
}

export class PostgresEffectCounterRepository implements EffectCounterRepository {
  constructor(private readonly sql: SQL) {}

  async findByKind(kind: BattleEffectKind): Promise<string | null> {
    const rows = await this.sql<
      EffectRow[]
    >`select item_counter_id from effect where effect_kind = ${kind} limit 1`;
    return rows[0]?.item_counter_id ?? null;
  }
}
