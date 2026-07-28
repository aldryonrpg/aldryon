import type { DungeonBoss } from "@/domain/dungeon/DungeonBoss";

/** Port implemented by infrastructure (Postgres) for the dungeon boss
 * catalog. Moveset copying at materialization time goes through
 * MonsterAttackRepository.copyDungeonBossMoveset instead of loading the
 * moveset here first. */
export interface DungeonBossRepository {
  findById(id: string): Promise<DungeonBoss | null>;
  /** Admin create/patch duplicate-name checks (plan9 follow-up), same
   * shape as MonsterRepository.findByName. */
  findByName(name: string): Promise<DungeonBoss | null>;
  /** The full boss catalog, in a stable order — DungeonBossOfTheDayUseCase
   * indexes into this deterministically by date, so the order must be
   * consistent across calls/replicas (name ASC in the Postgres impl). */
  findAll(): Promise<DungeonBoss[]>;
  /** Admin create (plan9 follow-up) — a brand-new boss still needs its
   * moveset linked in `dungeon_boss_movesets` by hand afterward (same
   * limitation the Monster admin screen already has for `monster_movesets`
   * — out of scope for this screen). */
  create(dungeonBoss: DungeonBoss): Promise<DungeonBoss>;
  /** Admin patch (plan9 follow-up). Only changes the `dungeon_bosses` base
   * row — any already-materialized "`${name}` — Tier N" monster rows keep
   * their old stats until this boss's next rotation turn re-materializes
   * them from these updated base values (see DungeonBossOfTheDayUseCase). */
  update(dungeonBoss: DungeonBoss): Promise<DungeonBoss>;
}
