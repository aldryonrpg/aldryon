import type { DungeonBoss } from "@/domain/dungeon/DungeonBoss";

/** Port implemented by infrastructure (Postgres) for the dungeon boss
 * catalog. Moveset copying at materialization time goes through
 * MonsterAttackRepository.copyDungeonBossMoveset instead of loading the
 * moveset here first. */
export interface DungeonBossRepository {
  findById(id: string): Promise<DungeonBoss | null>;
  /** The full boss catalog, in a stable order — DungeonBossOfTheDayUseCase
   * indexes into this deterministically by date, so the order must be
   * consistent across calls/replicas (name ASC in the Postgres impl). */
  findAll(): Promise<DungeonBoss[]>;
}
