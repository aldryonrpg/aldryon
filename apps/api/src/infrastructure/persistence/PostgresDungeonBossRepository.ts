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
  base_force: number;
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
      force: row.base_force,
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
}
