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
 * `attacks` was originally seed/migration-only catalog data (plan2 §10), now
 * also admin-editable (POST/PATCH /admin/attacks). findAll() is re-read on
 * every single Attack turn (AttackUseCase) and every Battle screen load/
 * reload (GetActiveBattleUseCase) — caching the whole table after the first
 * read (same TTL convention as MonsterCatalogCache) turns those into an
 * in-memory read the rest of the time this process is up. create()/update()
 * clear() the cache so the very next findAll() re-reads instead of serving a
 * stale snapshot for up to CACHE_TTL_MS.
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

  async findById(id: string): Promise<Attack | null> {
    const attacks = await this.findAll();
    return attacks.find((attack) => attack.id === id) ?? null;
  }

  async findByName(name: string): Promise<Attack | null> {
    const attacks = await this.findAll();
    return attacks.find((attack) => attack.name === name) ?? null;
  }

  async create(attack: Attack): Promise<Attack> {
    const props = attack.toProps();
    const req = props.attributeRequirements;

    const rows = await this.sql<AttackRow[]>`
      insert into attacks (
        id, name, stamina_cost, multiplier, scaling_attribute, applies_effect, min_level,
        req_strength, req_dexterity, req_agility, req_intelligence, req_vitality, req_luck,
        reveals_random_monster_attribute
      ) values (
        ${props.id}, ${props.name}, ${props.staminaCost}, ${props.multiplier},
        ${props.scalingAttribute}, ${props.appliesEffect}, ${props.minLevel},
        ${req.strength}, ${req.dexterity}, ${req.agility}, ${req.intelligence}, ${req.vitality}, ${req.luck},
        ${props.revealsRandomMonsterAttribute}
      )
      returning *
    `;
    const saved = rows[0];
    if (!saved) throw new Error("Failed to create attack: no row returned");
    this.cache.clear();
    return toDomain(saved);
  }

  async update(attack: Attack): Promise<Attack> {
    const props = attack.toProps();
    const req = props.attributeRequirements;

    const rows = await this.sql<AttackRow[]>`
      update attacks set
        name = ${props.name},
        stamina_cost = ${props.staminaCost},
        multiplier = ${props.multiplier},
        scaling_attribute = ${props.scalingAttribute},
        applies_effect = ${props.appliesEffect},
        min_level = ${props.minLevel},
        req_strength = ${req.strength},
        req_dexterity = ${req.dexterity},
        req_agility = ${req.agility},
        req_intelligence = ${req.intelligence},
        req_vitality = ${req.vitality},
        req_luck = ${req.luck},
        reveals_random_monster_attribute = ${props.revealsRandomMonsterAttribute}
      where id = ${props.id}
      returning *
    `;
    const saved = rows[0];
    if (!saved) throw new Error(`Failed to update attack: no row returned for id ${props.id}`);
    this.cache.clear();
    return toDomain(saved);
  }
}
