import type { SQL } from "bun";
import { Battle } from "@/domain/battle/Battle";
import type { BattleEffect } from "@/domain/battle/BattleEffect";
import type { AttributeKey } from "@/domain/shared/Attributes";
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
  monster_attack_weights: unknown;
  status_cooldown_rounds_left: number;
  dungeon_tier: 1 | 2 | 3 | null;
  dungeon_is_boss_fight: boolean;
  revealed_monster_attributes: unknown;
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
    monsterAttackWeights: parseJsonbColumn<Record<string, number>>(row.monster_attack_weights, {}),
    statusCooldownRoundsLeft: row.status_cooldown_rounds_left,
    dungeonTier: row.dungeon_tier,
    dungeonIsBossFight: row.dungeon_is_boss_fight,
    revealedMonsterAttributes: parseJsonbColumn<AttributeKey[]>(
      row.revealed_monster_attributes,
      [],
    ),
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
        player_effects, monster_effects, monster_charging_attack_id, charge_rounds_left,
        monster_attack_weights, status_cooldown_rounds_left,
        dungeon_tier, dungeon_is_boss_fight, revealed_monster_attributes
      ) values (
        ${props.id}, ${props.playerId}, ${props.monsterId}, ${props.playerCurrentHp}, ${props.playerCurrentStamina},
        ${props.monsterCurrentHp}, ${props.monsterCurrentStamina}, ${props.round},
        ${JSON.stringify(props.playerEffects)}::jsonb, ${JSON.stringify(props.monsterEffects)}::jsonb,
        ${props.monsterChargingAttackId}, ${props.chargeRoundsLeft},
        ${JSON.stringify(props.monsterAttackWeights)}::jsonb, ${props.statusCooldownRoundsLeft},
        ${props.dungeonTier}, ${props.dungeonIsBossFight},
        ${JSON.stringify(props.revealedMonsterAttributes)}::jsonb
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
        monster_id = ${props.monsterId},
        player_current_hp = ${props.playerCurrentHp},
        player_current_stamina = ${props.playerCurrentStamina},
        monster_current_hp = ${props.monsterCurrentHp},
        monster_current_stamina = ${props.monsterCurrentStamina},
        round = ${props.round},
        player_effects = ${JSON.stringify(props.playerEffects)}::jsonb,
        monster_effects = ${JSON.stringify(props.monsterEffects)}::jsonb,
        monster_charging_attack_id = ${props.monsterChargingAttackId},
        charge_rounds_left = ${props.chargeRoundsLeft},
        monster_attack_weights = ${JSON.stringify(props.monsterAttackWeights)}::jsonb,
        status_cooldown_rounds_left = ${props.statusCooldownRoundsLeft},
        dungeon_tier = ${props.dungeonTier},
        dungeon_is_boss_fight = ${props.dungeonIsBossFight},
        revealed_monster_attributes = ${JSON.stringify(props.revealedMonsterAttributes)}::jsonb
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
