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

  async findByName(name: string): Promise<MonsterAttack | null> {
    const rows = await this.sql<
      MonsterAttackRow[]
    >`select * from monster_attacks where name = ${name} limit 1`;
    return rows[0] ? toDomain(rows[0]) : null;
  }

  async findAll(): Promise<MonsterAttack[]> {
    const rows = await this.sql<
      MonsterAttackRow[]
    >`select * from monster_attacks order by name asc`;
    return rows.map(toDomain);
  }

  async create(monsterAttack: MonsterAttack): Promise<MonsterAttack> {
    const props = monsterAttack.toProps();

    const rows = await this.sql<MonsterAttackRow[]>`
      insert into monster_attacks (
        id, name, stamina_cost, multiplier, scaling_attribute, applies_effect,
        is_special, charge_turns
      ) values (
        ${props.id}, ${props.name}, ${props.staminaCost}, ${props.multiplier},
        ${props.scalingAttribute}, ${props.appliesEffect}, ${props.isSpecial}, ${props.chargeTurns}
      )
      returning *
    `;
    const saved = rows[0];
    if (!saved) throw new Error("Failed to create monster attack: no row returned");
    return toDomain(saved);
  }

  async update(monsterAttack: MonsterAttack): Promise<MonsterAttack> {
    const props = monsterAttack.toProps();

    const rows = await this.sql<MonsterAttackRow[]>`
      update monster_attacks set
        name = ${props.name},
        stamina_cost = ${props.staminaCost},
        multiplier = ${props.multiplier},
        scaling_attribute = ${props.scalingAttribute},
        applies_effect = ${props.appliesEffect},
        is_special = ${props.isSpecial},
        charge_turns = ${props.chargeTurns}
      where id = ${props.id}
      returning *
    `;
    const saved = rows[0];
    if (!saved) {
      throw new Error(`Failed to update monster attack: no row returned for id ${props.id}`);
    }
    return toDomain(saved);
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

  async copyDungeonBossMoveset(dungeonBossId: string, monsterId: string): Promise<void> {
    await this.sql`
      insert into monster_movesets (monster_id, monster_attack_id)
      select ${monsterId}, dbm.monster_attack_id
      from dungeon_boss_movesets dbm
      where dbm.dungeon_boss_id = ${dungeonBossId}
      on conflict do nothing
    `;
  }
}
