import type { SQL } from "bun";
import { Player } from "@/domain/player/Player";
import { parseJsonbColumn } from "@/infrastructure/persistence/jsonbColumn";
import type { PlayerRepository } from "@/usecase/player/PlayerRepository";

interface PlayerRow {
  id: string;
  user_id: string;
  player_name: string | null;
  gold: number;
  level: number;
  xp: number;
  attribute_points: number;
  strength: number;
  dexterity: number;
  agility: number;
  intelligence: number;
  vitality: number;
  luck: number;
  last_death_at: string | Date | null;
  last_run_at: string | Date | null;
  pending_loot: unknown;
  dungeon_attempt_1: string | Date | null;
  dungeon_attempt_2: string | Date | null;
  dungeon_run_tier: 1 | 2 | 3 | null;
  dungeon_run_step: number | null;
  dungeon_run_total_steps: number | null;
}

function toDate(value: string | Date | null): Date | null {
  if (value === null) return null;
  return value instanceof Date ? value : new Date(value);
}

function toDomain(row: PlayerRow): Player {
  return Player.create({
    id: row.id,
    userId: row.user_id,
    playerName: row.player_name,
    gold: row.gold,
    level: row.level,
    xp: row.xp,
    attributePoints: row.attribute_points,
    attributes: {
      strength: row.strength,
      dexterity: row.dexterity,
      agility: row.agility,
      intelligence: row.intelligence,
      vitality: row.vitality,
      luck: row.luck,
    },
    lastDeathAt: toDate(row.last_death_at),
    lastRunAt: toDate(row.last_run_at),
    pendingLoot: parseJsonbColumn<string[]>(row.pending_loot, []),
    dungeonAttempt1: toDate(row.dungeon_attempt_1),
    dungeonAttempt2: toDate(row.dungeon_attempt_2),
    dungeonRunTier: row.dungeon_run_tier,
    dungeonRunStep: row.dungeon_run_step,
    dungeonRunTotalSteps: row.dungeon_run_total_steps,
  });
}

export class PostgresPlayerRepository implements PlayerRepository {
  constructor(private readonly sql: SQL) {}

  async findByUserId(userId: string): Promise<Player | null> {
    const rows = await this.sql<
      PlayerRow[]
    >`select * from players where user_id = ${userId} limit 1`;
    return rows[0] ? toDomain(rows[0]) : null;
  }

  async findById(id: string): Promise<Player | null> {
    const rows = await this.sql<PlayerRow[]>`select * from players where id = ${id} limit 1`;
    return rows[0] ? toDomain(rows[0]) : null;
  }

  async create(player: Player): Promise<Player> {
    const props = player.toProps();
    const attrs = player.getAttributes();

    const rows = await this.sql<PlayerRow[]>`
      insert into players (
        id, user_id, player_name, gold, level, xp, attribute_points,
        strength, dexterity, agility, intelligence, vitality, luck,
        last_death_at, last_run_at, pending_loot, dungeon_attempt_1, dungeon_attempt_2,
        dungeon_run_tier, dungeon_run_step, dungeon_run_total_steps, updated_at
      ) values (
        ${props.id}, ${props.userId}, ${props.playerName}, ${props.gold}, ${props.level}, ${props.xp}, ${props.attributePoints},
        ${attrs.strength}, ${attrs.dexterity}, ${attrs.agility}, ${attrs.intelligence}, ${attrs.vitality}, ${attrs.luck},
        ${props.lastDeathAt}, ${props.lastRunAt}, ${JSON.stringify(props.pendingLoot)}::jsonb,
        ${props.dungeonAttempt1}, ${props.dungeonAttempt2},
        ${props.dungeonRunTier}, ${props.dungeonRunStep}, ${props.dungeonRunTotalSteps}, now()
      )
      returning *
    `;

    const saved = rows[0];
    if (!saved) throw new Error("Failed to create player: no row returned");
    return toDomain(saved);
  }

  async update(player: Player): Promise<Player> {
    const props = player.toProps();
    const attrs = player.getAttributes();

    const rows = await this.sql<PlayerRow[]>`
      update players set
        player_name = ${props.playerName},
        gold = ${props.gold},
        level = ${props.level},
        xp = ${props.xp},
        attribute_points = ${props.attributePoints},
        strength = ${attrs.strength},
        dexterity = ${attrs.dexterity},
        agility = ${attrs.agility},
        intelligence = ${attrs.intelligence},
        vitality = ${attrs.vitality},
        luck = ${attrs.luck},
        last_death_at = ${props.lastDeathAt},
        last_run_at = ${props.lastRunAt},
        pending_loot = ${JSON.stringify(props.pendingLoot)}::jsonb,
        dungeon_attempt_1 = ${props.dungeonAttempt1},
        dungeon_attempt_2 = ${props.dungeonAttempt2},
        dungeon_run_tier = ${props.dungeonRunTier},
        dungeon_run_step = ${props.dungeonRunStep},
        dungeon_run_total_steps = ${props.dungeonRunTotalSteps},
        updated_at = now()
      where id = ${props.id}
      returning *
    `;

    const saved = rows[0];
    if (!saved) throw new Error("Failed to update player: no row returned");
    return toDomain(saved);
  }
}
