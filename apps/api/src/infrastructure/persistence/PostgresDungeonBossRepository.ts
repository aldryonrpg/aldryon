import type { SQL } from "bun";
import { DungeonBoss } from "@/domain/dungeon/DungeonBoss";
import type { DropTuple, MonsterType } from "@/domain/monster/Monster";
import { parseJsonbColumn } from "@/infrastructure/persistence/jsonbColumn";
import type { DungeonBossRepository } from "@/usecase/dungeon/DungeonBossRepository";

interface DungeonBossRow {
  id: string;
  name: string;
  description: string;
  monster_image: string;
  monster_type: MonsterType;
  base_hp: number;
  base_xp_gain: number;
  base_max_stamina: number;
  base_strength: number;
  base_dexterity: number;
  base_agility: number;
  base_intelligence: number;
  base_vitality: number;
  base_luck: number;
  drops: unknown;
  exclusive_drops: unknown;
  legendary_drops: unknown;
}

function toDomain(row: DungeonBossRow): DungeonBoss {
  return DungeonBoss.create({
    id: row.id,
    name: row.name,
    description: row.description,
    monsterImage: row.monster_image,
    monsterType: row.monster_type,
    baseHp: row.base_hp,
    baseXpGain: row.base_xp_gain,
    baseMaxStamina: row.base_max_stamina,
    baseAttributes: {
      strength: row.base_strength,
      dexterity: row.base_dexterity,
      agility: row.base_agility,
      intelligence: row.base_intelligence,
      vitality: row.base_vitality,
      luck: row.base_luck,
    },
    drops: parseJsonbColumn<DropTuple[]>(row.drops, []),
    exclusiveDrops: parseJsonbColumn<DropTuple[]>(row.exclusive_drops, []),
    legendaryDrops: parseJsonbColumn<DropTuple[]>(row.legendary_drops, []),
  });
}

export class PostgresDungeonBossRepository implements DungeonBossRepository {
  constructor(private readonly sql: SQL) {}

  async findById(id: string): Promise<DungeonBoss | null> {
    const rows = await this.sql<
      DungeonBossRow[]
    >`select * from dungeon_bosses where id = ${id} limit 1`;
    return rows[0] ? toDomain(rows[0]) : null;
  }

  async findByName(name: string): Promise<DungeonBoss | null> {
    const rows = await this.sql<
      DungeonBossRow[]
    >`select * from dungeon_bosses where name = ${name} limit 1`;
    return rows[0] ? toDomain(rows[0]) : null;
  }

  async findAll(): Promise<DungeonBoss[]> {
    const rows = await this.sql<DungeonBossRow[]>`select * from dungeon_bosses order by name asc`;
    return rows.map(toDomain);
  }

  async create(dungeonBoss: DungeonBoss): Promise<DungeonBoss> {
    const props = dungeonBoss.toProps();
    const attrs = props.baseAttributes;

    const rows = await this.sql<DungeonBossRow[]>`
      insert into dungeon_bosses (
        id, name, description, monster_image, monster_type,
        base_hp, base_xp_gain, base_max_stamina,
        base_strength, base_dexterity, base_agility, base_intelligence, base_vitality, base_luck,
        drops, exclusive_drops, legendary_drops
      ) values (
        ${props.id}, ${props.name}, ${props.description}, ${props.monsterImage}, ${props.monsterType},
        ${props.baseHp}, ${props.baseXpGain}, ${props.baseMaxStamina},
        ${attrs.strength}, ${attrs.dexterity}, ${attrs.agility}, ${attrs.intelligence}, ${attrs.vitality}, ${attrs.luck},
        ${props.drops}::jsonb, ${props.exclusiveDrops}::jsonb, ${props.legendaryDrops}::jsonb
      )
      returning *
    `;
    const saved = rows[0];
    if (!saved) throw new Error("Failed to create dungeon boss: no row returned");
    return toDomain(saved);
  }

  async update(dungeonBoss: DungeonBoss): Promise<DungeonBoss> {
    const props = dungeonBoss.toProps();
    const attrs = props.baseAttributes;

    const rows = await this.sql<DungeonBossRow[]>`
      update dungeon_bosses set
        name = ${props.name},
        description = ${props.description},
        monster_image = ${props.monsterImage},
        monster_type = ${props.monsterType},
        base_hp = ${props.baseHp},
        base_xp_gain = ${props.baseXpGain},
        base_max_stamina = ${props.baseMaxStamina},
        base_strength = ${attrs.strength},
        base_dexterity = ${attrs.dexterity},
        base_agility = ${attrs.agility},
        base_intelligence = ${attrs.intelligence},
        base_vitality = ${attrs.vitality},
        base_luck = ${attrs.luck},
        drops = ${props.drops}::jsonb,
        exclusive_drops = ${props.exclusiveDrops}::jsonb,
        legendary_drops = ${props.legendaryDrops}::jsonb,
        updated_at = now()
      where id = ${props.id}
      returning *
    `;
    const saved = rows[0];
    if (!saved)
      throw new Error(`Failed to update dungeon boss: no row returned for id ${props.id}`);
    return toDomain(saved);
  }
}
