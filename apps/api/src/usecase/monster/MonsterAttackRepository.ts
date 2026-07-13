import type { MonsterAttack } from "@/domain/monster/MonsterAttack";

/** Port implemented by infrastructure (Postgres) for monster attacks + movesets. */
export interface MonsterAttackRepository {
  findById(id: string): Promise<MonsterAttack | null>;
  findMovesetByMonsterId(monsterId: string): Promise<MonsterAttack[]>;
  /** Copies a dungeon boss's dungeon_boss_movesets rows into monster_movesets
   * for the newly-materialized monster row (plan3 §2c) — a one-time step at
   * first-materialization, idempotent via `on conflict do nothing`. */
  copyDungeonBossMoveset(dungeonBossId: string, monsterId: string): Promise<void>;
}
