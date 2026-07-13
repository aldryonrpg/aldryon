import type { SQL } from "bun";
import { Attack } from "@/domain/attack/Attack";
import type { AttackScaling, BattleEffectKind } from "@/domain/monster/MonsterAttack";
import type { AttackRepository } from "@/usecase/attack/AttackRepository";

interface AttackRow {
  id: string;
  name: string;
  stamina_cost: number;
  multiplier: string | number;
  scaling_attribute: AttackScaling;
  applies_effect: BattleEffectKind | null;
  counter_item_id: string | null;
  min_level: number;
  req_force: number;
  req_dexterity: number;
  req_agility: number;
  req_intelligence: number;
  req_vitality: number;
  req_luck: number;
}

function toDomain(row: AttackRow): Attack {
  return Attack.create({
    id: row.id,
    name: row.name,
    staminaCost: row.stamina_cost,
    multiplier: Number(row.multiplier),
    scalingAttribute: row.scaling_attribute,
    appliesEffect: row.applies_effect,
    counterItemId: row.counter_item_id,
    minLevel: row.min_level,
    attributeRequirements: {
      force: row.req_force,
      dexterity: row.req_dexterity,
      agility: row.req_agility,
      intelligence: row.req_intelligence,
      vitality: row.req_vitality,
      luck: row.req_luck,
    },
  });
}

export class PostgresAttackRepository implements AttackRepository {
  constructor(private readonly sql: SQL) {}

  async findAll(): Promise<Attack[]> {
    const rows = await this.sql<AttackRow[]>`select * from attacks order by name asc`;
    return rows.map(toDomain);
  }

  async findByName(name: string): Promise<Attack | null> {
    const rows = await this.sql<AttackRow[]>`select * from attacks where name = ${name} limit 1`;
    return rows[0] ? toDomain(rows[0]) : null;
  }
}
