import type { SQL } from "bun";
import { Battle } from "@/domain/battle/Battle";
import type { BattleEffect } from "@/domain/battle/BattleEffect";
import { parseJsonbColumn } from "@/infrastructure/persistence/jsonbColumn";
import type { BattleRepository } from "@/usecase/battle/BattleRepository";

interface BattleRow {
  id: string;
  player_id: string;
  monster_id: string;
  player_current_hp: number;
  player_current_stamina: number;
  monster_current_hp: number;
  monster_current_stamina: number;
  round: number;
  player_effects: unknown;
  monster_effects: unknown;
  monster_charging_attack_id: string | null;
  charge_rounds_left: number;
}

function toDomain(row: BattleRow): Battle {
  return Battle.create({
    id: row.id,
    playerId: row.player_id,
    monsterId: row.monster_id,
    playerCurrentHp: row.player_current_hp,
    playerCurrentStamina: row.player_current_stamina,
    monsterCurrentHp: row.monster_current_hp,
    monsterCurrentStamina: row.monster_current_stamina,
    round: row.round,
    playerEffects: parseJsonbColumn<BattleEffect[]>(row.player_effects, []),
    monsterEffects: parseJsonbColumn<BattleEffect[]>(row.monster_effects, []),
    monsterChargingAttackId: row.monster_charging_attack_id,
    chargeRoundsLeft: row.charge_rounds_left,
  });
}

export class PostgresBattleRepository implements BattleRepository {
  constructor(private readonly sql: SQL) {}

  async findByPlayerId(playerId: string): Promise<Battle | null> {
    const rows = await this.sql<
      BattleRow[]
    >`select * from battles where player_id = ${playerId} limit 1`;
    return rows[0] ? toDomain(rows[0]) : null;
  }

  async create(battle: Battle): Promise<Battle> {
    const props = battle.toProps();
    const rows = await this.sql<BattleRow[]>`
      insert into battles (
        id, player_id, monster_id, player_current_hp, player_current_stamina,
        monster_current_hp, monster_current_stamina, round,
        player_effects, monster_effects, monster_charging_attack_id, charge_rounds_left
      ) values (
        ${props.id}, ${props.playerId}, ${props.monsterId}, ${props.playerCurrentHp}, ${props.playerCurrentStamina},
        ${props.monsterCurrentHp}, ${props.monsterCurrentStamina}, ${props.round},
        ${JSON.stringify(props.playerEffects)}::jsonb, ${JSON.stringify(props.monsterEffects)}::jsonb,
        ${props.monsterChargingAttackId}, ${props.chargeRoundsLeft}
      )
      returning *
    `;
    const saved = rows[0];
    if (!saved) throw new Error("Failed to create battle: no row returned");
    return toDomain(saved);
  }

  async update(battle: Battle): Promise<Battle> {
    const props = battle.toProps();
    const rows = await this.sql<BattleRow[]>`
      update battles set
        player_current_hp = ${props.playerCurrentHp},
        player_current_stamina = ${props.playerCurrentStamina},
        monster_current_hp = ${props.monsterCurrentHp},
        monster_current_stamina = ${props.monsterCurrentStamina},
        round = ${props.round},
        player_effects = ${JSON.stringify(props.playerEffects)}::jsonb,
        monster_effects = ${JSON.stringify(props.monsterEffects)}::jsonb,
        monster_charging_attack_id = ${props.monsterChargingAttackId},
        charge_rounds_left = ${props.chargeRoundsLeft}
      where id = ${props.id}
      returning *
    `;
    const saved = rows[0];
    if (!saved) throw new Error("Failed to update battle: no row returned");
    return toDomain(saved);
  }

  async deleteByPlayerId(playerId: string): Promise<void> {
    await this.sql`delete from battles where player_id = ${playerId}`;
  }
}
