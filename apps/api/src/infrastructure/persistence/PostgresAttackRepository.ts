import type { SQL } from "bun";
import { Attack } from "@/domain/attack/Attack";
import type { AttackScaling, BattleEffectKind } from "@/domain/monster/MonsterAttack";
import { TtlCache } from "@/domain/shared/TtlCache";
import type { AttackRepository } from "@/usecase/attack/AttackRepository";

interface AttackRow {
  id: string;
  name: string;
  stamina_cost: number;
  multiplier: string | number;
  scaling_attribute: AttackScaling;
  applies_effect: BattleEffectKind | null;
  min_level: number;
  req_strength: number;
  req_dexterity: number;
  req_agility: number;
  req_intelligence: number;
  req_vitality: number;
  req_luck: number;
  reveals_random_monster_attribute: boolean;
}

function toDomain(row: AttackRow): Attack {
  return Attack.create({
    id: row.id,
    name: row.name,
    staminaCost: row.stamina_cost,
    multiplier: Number(row.multiplier),
    scalingAttribute: row.scaling_attribute,
    appliesEffect: row.applies_effect,
    minLevel: row.min_level,
    attributeRequirements: {
      strength: row.req_strength,
      dexterity: row.req_dexterity,
      agility: row.req_agility,
      intelligence: row.req_intelligence,
      vitality: row.req_vitality,
      luck: row.req_luck,
    },
    revealsRandomMonsterAttribute: row.reveals_random_monster_attribute,
  });
}

const CACHE_TTL_MS = 60 * 60 * 1000;

/**
 * `attacks` is seed/migration-only catalog data (plan2 §10), never written
 * to at runtime, but findAll() is re-read on every single Attack turn
 * (AttackUseCase) and every Battle screen load/reload (GetActiveBattleUseCase)
 * — caching the whole table after the first read (same TTL convention as
 * MonsterCatalogCache) turns those into an in-memory read the rest of the
 * time this process is up.
 */
export class PostgresAttackRepository implements AttackRepository {
  private readonly cache = new TtlCache<Attack[]>(CACHE_TTL_MS);

  constructor(private readonly sql: SQL) {}

  async findAll(): Promise<Attack[]> {
    const cached = this.cache.get();
    if (cached) return cached;

    const rows = await this.sql<AttackRow[]>`select * from attacks order by name asc`;
    const attacks = rows.map(toDomain);
    this.cache.set(attacks);
    return attacks;
  }

  async findByName(name: string): Promise<Attack | null> {
    const attacks = await this.findAll();
    return attacks.find((attack) => attack.name === name) ?? null;
  }
}
