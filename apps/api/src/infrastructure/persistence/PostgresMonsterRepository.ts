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
  strength: number;
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
      strength: row.strength,
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

  async findAllExcludingMaterializedBosses(): Promise<Monster[]> {
    const rows = await this.sql<
      MonsterRow[]
    >`select * from monsters where name not like '%— Tier %' order by name asc`;
    return rows.map(toDomain);
  }

  /** One point-select per id (not `= any(${ids})`) — this Bun version has a
   * documented array-binding bug (see deleteStaleDungeonBossRows above), and
   * this only ever runs against a handful of currently-cached ids on a slow
   * poll interval, so N cheap indexed lookups cost nothing extra. */
  async findUpdatedAtByIds(ids: string[]): Promise<Record<string, number>> {
    const rows = await Promise.all(
      ids.map(
        (id) =>
          this.sql<
            { id: string; updated_at: string | Date }[]
          >`select id, updated_at from monsters where id = ${id}`,
      ),
    );

    const result: Record<string, number> = {};
    for (const rowSet of rows) {
      const row = rowSet[0];
      if (!row) continue;
      const updatedAt = row.updated_at instanceof Date ? row.updated_at : new Date(row.updated_at);
      result[row.id] = updatedAt.getTime();
    }
    return result;
  }

  /** The one write path a dungeon boss's materialization needs (plan3 §2c) —
   * every other monsters row is seed data. */
  async create(monster: Monster): Promise<Monster> {
    const props = monster.toProps();
    const attrs = monster.getAttributes();

    const rows = await this.sql<MonsterRow[]>`
      insert into monsters (
        id, name, description, region, monster_image, hp, xp_gain, level, max_stamina,
        strength, dexterity, agility, intelligence, vitality, luck, monster_type,
        drops, exclusive_drops, legendary_drops, ambush_chance
      ) values (
        ${props.id}, ${props.name}, ${props.description}, ${props.region}, ${props.monsterImage},
        ${props.hp}, ${props.xpGain}, ${props.level}, ${props.maxStamina},
        ${attrs.strength}, ${attrs.dexterity}, ${attrs.agility}, ${attrs.intelligence}, ${attrs.vitality}, ${attrs.luck},
        ${props.monsterType},
        ${props.drops}::jsonb, ${props.exclusiveDrops}::jsonb,
        ${props.legendaryDrops}::jsonb, ${props.ambushChance}
      )
      returning *
    `;
    const saved = rows[0];
    if (!saved) throw new Error("Failed to create monster: no row returned");
    return toDomain(saved);
  }

  /** Full-row update for the admin patch flow (plan9 §4) — mirrors
   * `create()`'s column list exactly, just against an existing id. */
  async update(monster: Monster): Promise<Monster> {
    const props = monster.toProps();
    const attrs = monster.getAttributes();

    const rows = await this.sql<MonsterRow[]>`
      update monsters set
        name = ${props.name},
        description = ${props.description},
        region = ${props.region},
        monster_image = ${props.monsterImage},
        hp = ${props.hp},
        xp_gain = ${props.xpGain},
        level = ${props.level},
        max_stamina = ${props.maxStamina},
        strength = ${attrs.strength},
        dexterity = ${attrs.dexterity},
        agility = ${attrs.agility},
        intelligence = ${attrs.intelligence},
        vitality = ${attrs.vitality},
        luck = ${attrs.luck},
        monster_type = ${props.monsterType},
        drops = ${props.drops}::jsonb,
        exclusive_drops = ${props.exclusiveDrops}::jsonb,
        legendary_drops = ${props.legendaryDrops}::jsonb,
        ambush_chance = ${props.ambushChance},
        updated_at = now()
      where id = ${props.id}
      returning *
    `;
    const saved = rows[0];
    if (!saved) throw new Error(`Failed to update monster: no row returned for id ${props.id}`);
    return toDomain(saved);
  }

  async deleteStaleDungeonBossRows(currentBossName: string): Promise<void> {
    // Every materialized tier row is named "${bossName} — Tier N" — a LIKE
    // prefix match on the current boss's own name avoids ever having to pass
    // an array parameter through Bun.SQL for this (sql.array() mishandles
    // multi-byte characters like "—" in this Bun version, corrupting the
    // comparison — see git history for the array-based approach this
    // replaced). % and _ are escaped since a boss name could contain either.
    // Excludes rows a live `battles` row still references — with a real
    // multi-boss rotation, a day can roll over while a player is mid-fight
    // against yesterday's boss; deleting that row out from under them would
    // violate battles_monster_id_fkey (and end their fight for no reason).
    // It stays "stale" until that battle itself ends and gets cleaned up
    // the next time this runs.
    const likePattern = `${currentBossName.replace(/[%_]/g, "\\$&")} — Tier %`;
    await this.sql`
      delete from monsters
      where region = 'dungeon'
        and name not like ${likePattern}
        and id not in (select monster_id from battles)
    `;
  }
}
