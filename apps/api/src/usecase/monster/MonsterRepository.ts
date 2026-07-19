import type { Monster, MonsterRegion } from "@/domain/monster/Monster";

/** Port implemented by infrastructure (Postgres) for monster catalog reads
 * and — since a dungeon boss materializes into a real monsters row on first
 * use (plan3 §2c) — the one write path that needs. */
export interface MonsterRepository {
  findById(id: string): Promise<Monster | null>;
  findByName(name: string): Promise<Monster | null>;
  findAllByRegion(region: MonsterRegion): Promise<Monster[]>;
  /** Every catalog monster EXCEPT a materialized dungeon boss row (named
   * "${bossName} — Tier ${tier}") — the pool a dungeon step draws from
   * (loot-system follow-up), so a step never accidentally fights the boss
   * identity itself. */
  findAllExcludingMaterializedBosses(): Promise<Monster[]>;
  create(monster: Monster): Promise<Monster>;
  /** Retires a previous day's materialized boss rows once today's rotation
   * has confirmed which boss is active (DungeonBossOfTheDayUseCase) —
   * deletes every `region = 'dungeon'` row whose name isn't one of
   * `${currentBossName} — Tier *`. Safe to call from multiple concurrent
   * replicas: it only ever removes rows that *aren't* today's confirmed
   * boss, so it never races with the materialize-or-reuse step that runs
   * immediately before it. */
  deleteStaleDungeonBossRows(currentBossName: string): Promise<void>;
}
