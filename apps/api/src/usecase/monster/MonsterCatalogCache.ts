import type { Monster } from "@/domain/monster/Monster";
import type { MonsterAttack } from "@/domain/monster/MonsterAttack";
import { KeyedTtlCache } from "@/domain/shared/TtlCache";
import type { MonsterAttackRepository } from "@/usecase/monster/MonsterAttackRepository";
import type { MonsterRepository } from "@/usecase/monster/MonsterRepository";

export interface MonsterWithMoveset {
  monster: Monster;
  moveset: MonsterAttack[];
}

const CACHE_TTL_MS = 60 * 60 * 1000;

/**
 * Caches monster rows and movesets by monster id (perf follow-up): a
 * battle turn re-reads the same handful of monster ids over and over, and
 * with many concurrent players fighting a small rotating set of catalog
 * monsters, the underlying rows are read far more often than they change —
 * a monster/moveset is only ever written at seed time, or once at dungeon-
 * boss materialization, never updated after. Monster and moveset are
 * cached independently (two separate keyed caches) so a caller that only
 * needs one of them — GetActiveBattleUseCase never needs the moveset;
 * StartBattleUseCase/beginDungeonFight already have the monster in hand and
 * only need the moveset — doesn't pay for fetching or caching the other.
 */
export class MonsterCatalogCache {
  private readonly monsterCache = new KeyedTtlCache<string, Monster>(CACHE_TTL_MS);
  private readonly movesetCache = new KeyedTtlCache<string, MonsterAttack[]>(CACHE_TTL_MS);

  constructor(
    private readonly monsterRepository: MonsterRepository,
    private readonly monsterAttackRepository: MonsterAttackRepository,
  ) {}

  async getMonster(monsterId: string): Promise<Monster | null> {
    const cached = this.monsterCache.get(monsterId);
    if (cached) return cached;

    const monster = await this.monsterRepository.findById(monsterId);
    if (monster) this.monsterCache.set(monsterId, monster);
    return monster;
  }

  async getMoveset(monsterId: string): Promise<MonsterAttack[]> {
    const cached = this.movesetCache.get(monsterId);
    if (cached) return cached;

    const moveset = await this.monsterAttackRepository.findMovesetByMonsterId(monsterId);
    this.movesetCache.set(monsterId, moveset);
    return moveset;
  }

  /** Fetches both concurrently — a battle turn always needs the pair, and
   * the moveset lookup only needs the id (already known from the battle
   * row), not the resolved Monster entity, so there's no reason to
   * serialize one behind the other. */
  async getMonsterWithMoveset(monsterId: string): Promise<MonsterWithMoveset | null> {
    const [monster, moveset] = await Promise.all([
      this.getMonster(monsterId),
      this.getMoveset(monsterId),
    ]);
    if (!monster) return null;
    return { monster, moveset };
  }
}
