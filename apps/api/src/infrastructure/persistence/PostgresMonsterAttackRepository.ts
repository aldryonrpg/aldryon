import type { SQL } from "bun";
import type { AttackScaling, BattleEffectKind } from "@/domain/monster/MonsterAttack";
import { MonsterAttack } from "@/domain/monster/MonsterAttack";
import type { MonsterAttackRepository } from "@/usecase/monster/MonsterAttackRepository";

interface MonsterAttackRow {
  id: string;
  name: string;
  stamina_cost: number;
  multiplier: string | number;
  scaling_attribute: AttackScaling;
  applies_effect: BattleEffectKind | null;
  counter_item_id: string | null;
  is_special: boolean;
  charge_turns: number;
}

function toDomain(row: MonsterAttackRow): MonsterAttack {
  return MonsterAttack.create({
    id: row.id,
    name: row.name,
    staminaCost: row.stamina_cost,
    multiplier: Number(row.multiplier),
    scalingAttribute: row.scaling_attribute,
    appliesEffect: row.applies_effect,
    counterItemId: row.counter_item_id,
    isSpecial: row.is_special,
    chargeTurns: row.charge_turns,
  });
}

export class PostgresMonsterAttackRepository implements MonsterAttackRepository {
  constructor(private readonly sql: SQL) {}

  async findById(id: string): Promise<MonsterAttack | null> {
    const rows = await this.sql<
      MonsterAttackRow[]
    >`select * from monster_attacks where id = ${id} limit 1`;
    return rows[0] ? toDomain(rows[0]) : null;
  }

  async findMovesetByMonsterId(monsterId: string): Promise<MonsterAttack[]> {
    const rows = await this.sql<MonsterAttackRow[]>`
      select ma.*
      from monster_attacks ma
      inner join monster_movesets mm on mm.monster_attack_id = ma.id
      where mm.monster_id = ${monsterId}
      order by ma.name asc
    `;
    return rows.map(toDomain);
  }
}
