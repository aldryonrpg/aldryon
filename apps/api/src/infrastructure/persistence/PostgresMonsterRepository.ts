import type { SQL } from "bun";
import type { DropTuple, MonsterRegion, MonsterType } from "@/domain/monster/Monster";
import { Monster } from "@/domain/monster/Monster";
import { parseJsonbColumn } from "@/infrastructure/persistence/jsonbColumn";
import type { MonsterRepository } from "@/usecase/monster/MonsterRepository";

interface MonsterRow {
  id: string;
  name: string;
  description: string;
  region: MonsterRegion;
  monster_image: string;
  hp: number;
  xp_gain: number;
  level: number;
  max_stamina: number;
  force: number;
  dexterity: number;
  agility: number;
  intelligence: number;
  vitality: number;
  luck: number;
  monster_type: MonsterType;
  drops: unknown;
  exclusive_drops: unknown;
  ambush_chance: number;
}

function toDomain(row: MonsterRow): Monster {
  return Monster.create({
    id: row.id,
    name: row.name,
    description: row.description,
    region: row.region,
    monsterImage: row.monster_image,
    hp: row.hp,
    xpGain: row.xp_gain,
    level: row.level,
    maxStamina: row.max_stamina,
    attributes: {
      force: row.force,
      dexterity: row.dexterity,
      agility: row.agility,
      intelligence: row.intelligence,
      vitality: row.vitality,
      luck: row.luck,
    },
    monsterType: row.monster_type,
    drops: parseJsonbColumn<DropTuple[]>(row.drops, []),
    exclusiveDrops: parseJsonbColumn<DropTuple[]>(row.exclusive_drops, []),
    ambushChance: row.ambush_chance,
  });
}

export class PostgresMonsterRepository implements MonsterRepository {
  constructor(private readonly sql: SQL) {}

  async findById(id: string): Promise<Monster | null> {
    const rows = await this.sql<MonsterRow[]>`select * from monsters where id = ${id} limit 1`;
    return rows[0] ? toDomain(rows[0]) : null;
  }

  async findAllByRegion(region: MonsterRegion): Promise<Monster[]> {
    const rows = await this.sql<
      MonsterRow[]
    >`select * from monsters where region = ${region} order by name asc`;
    return rows.map(toDomain);
  }
}
