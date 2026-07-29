import type { MonsterAttack } from "@/domain/monster/MonsterAttack";

/** Port implemented by infrastructure (Postgres) for monster attacks + movesets. */
export interface MonsterAttackRepository {
  findById(id: string): Promise<MonsterAttack | null>;
  findByName(name: string): Promise<MonsterAttack | null>;
  /** The full monster attack catalog — backs GET /admin/monster-attacks. */
  findAll(): Promise<MonsterAttack[]>;
  findMovesetByMonsterId(monsterId: string): Promise<MonsterAttack[]>;
  /** Copies a dungeon boss's dungeon_boss_movesets rows into monster_movesets
   * for the newly-materialized monster row (plan3 §2c) — a one-time step at
   * first-materialization, idempotent via `on conflict do nothing`. */
  copyDungeonBossMoveset(dungeonBossId: string, monsterId: string): Promise<void>;
  /** Admin create. */
  create(monsterAttack: MonsterAttack): Promise<MonsterAttack>;
  /** Admin patch. */
  update(monsterAttack: MonsterAttack): Promise<MonsterAttack>;
  /** The ids of this dungeon boss's currently-linked *special* attacks only
   * (0-2) — backs the admin "special attacks" picker. Normal (non-special)
   * moveset entries are a separate admin picker — see
   * findDungeonBossNormalAttackIds/setDungeonBossNormalAttacks below. */
  findDungeonBossSpecialAttackIds(dungeonBossId: string): Promise<string[]>;
  /** Replaces this dungeon boss's special-attack links with exactly the
   * given set (0-2 ids, every id assumed already validated as an existing
   * special MonsterAttack by the caller) — any non-special moveset entries
   * for this boss are left alone. Atomic: old special links are removed and
   * the new ones inserted in one transaction. */
  setDungeonBossSpecialAttacks(dungeonBossId: string, monsterAttackIds: string[]): Promise<void>;
  /** The ids of this monster's currently-linked *normal* (non-special)
   * attacks — backs the admin "normal attacks" picker, available for both
   * monsters and dungeon bosses (unlike special attacks, boss-only). No
   * count cap. */
  findMonsterNormalAttackIds(monsterId: string): Promise<string[]>;
  /** Replaces this monster's normal-attack links with exactly the given set
   * (every id assumed already validated as an existing non-special
   * MonsterAttack by the caller) — any special moveset entries for this
   * monster are left alone. Atomic. */
  setMonsterNormalAttacks(monsterId: string, monsterAttackIds: string[]): Promise<void>;
  /** The ids of this dungeon boss's currently-linked *normal* (non-special)
   * attacks — the boss-side counterpart to findMonsterNormalAttackIds. */
  findDungeonBossNormalAttackIds(dungeonBossId: string): Promise<string[]>;
  /** Replaces this dungeon boss's normal-attack links with exactly the given
   * set (every id assumed already validated as an existing non-special
   * MonsterAttack by the caller) — any special moveset entries for this boss
   * (see setDungeonBossSpecialAttacks) are left alone. Atomic. */
  setDungeonBossNormalAttacks(dungeonBossId: string, monsterAttackIds: string[]): Promise<void>;
}
