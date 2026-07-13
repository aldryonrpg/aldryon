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
  legendary_drops: unknown;
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
    legendaryDrops: parseJsonbColumn<DropTuple[]>(row.legendary_drops, []),
    ambushChance: row.ambush_chance,
  });
}

export class PostgresMonsterRepository implements MonsterRepository {
  constructor(private readonly sql: SQL) {}

  async findById(id: string): Promise<Monster | null> {
    const rows = await this.sql<MonsterRow[]>`select * from monsters where id = ${id} limit 1`;
    return rows[0] ? toDomain(rows[0]) : null;
  }

  async findByName(name: string): Promise<Monster | null> {
    const rows = await this.sql<MonsterRow[]>`select * from monsters where name = ${name} limit 1`;
    return rows[0] ? toDomain(rows[0]) : null;
  }

  async findAllByRegion(region: MonsterRegion): Promise<Monster[]> {
    const rows = await this.sql<
      MonsterRow[]
    >`select * from monsters where region = ${region} order by name asc`;
    return rows.map(toDomain);
  }

  /** The one write path a dungeon boss's materialization needs (plan3 §2c) —
   * every other monsters row is seed data. */
  async create(monster: Monster): Promise<Monster> {
    const props = monster.toProps();
    const attrs = monster.getAttributes();

    const rows = await this.sql<MonsterRow[]>`
      insert into monsters (
        id, name, description, region, monster_image, hp, xp_gain, level, max_stamina,
        force, dexterity, agility, intelligence, vitality, luck, monster_type,
        drops, exclusive_drops, legendary_drops, ambush_chance
      ) values (
        ${props.id}, ${props.name}, ${props.description}, ${props.region}, ${props.monsterImage},
        ${props.hp}, ${props.xpGain}, ${props.level}, ${props.maxStamina},
        ${attrs.force}, ${attrs.dexterity}, ${attrs.agility}, ${attrs.intelligence}, ${attrs.vitality}, ${attrs.luck},
        ${props.monsterType},
        ${JSON.stringify(props.drops)}::jsonb, ${JSON.stringify(props.exclusiveDrops)}::jsonb,
        ${JSON.stringify(props.legendaryDrops)}::jsonb, ${props.ambushChance}
      )
      returning *
    `;
    const saved = rows[0];
    if (!saved) throw new Error("Failed to create monster: no row returned");
    return toDomain(saved);
  }
}
