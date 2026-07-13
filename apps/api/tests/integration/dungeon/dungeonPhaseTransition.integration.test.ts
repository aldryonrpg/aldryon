import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { SQL } from "bun";
import { Battle } from "@/domain/battle/Battle";
import { maxHp } from "@/domain/battle/battleConfig";
import { buildUseCases } from "../support/buildUseCases";
import { FakeRng } from "../support/FakeRng";
import { getSharedPostgresEnvironment } from "../support/sharedPostgresEnvironment";
import {
  createTestItem,
  createTestMonster,
  createTestMonsterAttack,
  createTestPlayer,
  createTestUser,
  linkMonsterMoveset,
} from "../support/testFixtures";

/**
 * Exercises settleTurn's dungeon phase-transition branch directly, by
 * constructing a battle with dungeonBossMonsterId/dungeonTier set — no need
 * to go through StartDungeonUseCase or the real singleton dungeon_encounters
 * row (that's covered separately in startDungeon.integration.test.ts).
 * Every attribute/level defaults to 1 on both sides, so a HIT (multiplier
 * 0.4, stamina cost 1) always deals exactly 1 damage and hitChance is always
 * >=100 (guaranteed hit, no rng consumed for the strike itself) — the only
 * rng calls in these tests are drop-pool rolls and the Growl roll.
 */
describe("Dungeon phase transition via settleTurn (integration)", () => {
  let sql: SQL;

  beforeAll(async () => {
    const env = await getSharedPostgresEnvironment();
    sql = new SQL(env.connectionUri);
  }, 120_000);

  afterAll(async () => {
    await sql.close();
  });

  async function setupDungeonBattle(overrides: {
    gatekeeperHp?: number;
    gatekeeperDrops?: { itemId: string; dropRate: number }[];
    bossHp?: number;
    bossDrops?: { itemId: string; dropRate: number }[];
    dungeonTier?: 1 | 2 | 3;
  }) {
    const userId = await createTestUser(sql);
    const playerId = await createTestPlayer(sql, userId);
    const gatekeeperId = await createTestMonster(sql, {
      hp: overrides.gatekeeperHp ?? 1,
      xpGain: 100,
      drops: overrides.gatekeeperDrops ?? [],
    });
    const gatekeeperAttackId = await createTestMonsterAttack(sql, {
      staminaCost: 0,
      multiplier: 0.4,
    });
    await linkMonsterMoveset(sql, gatekeeperId, gatekeeperAttackId);

    const bossId = await createTestMonster(sql, {
      hp: overrides.bossHp ?? 500,
      xpGain: 300,
      maxStamina: 60,
      drops: overrides.bossDrops ?? [],
    });
    const bossAttackId = await createTestMonsterAttack(sql, { staminaCost: 0, multiplier: 0.4 });
    await linkMonsterMoveset(sql, bossId, bossAttackId);

    const playerMaxHp = maxHp(1, 1);
    const battle = Battle.create({
      id: Bun.randomUUIDv7(),
      playerId,
      monsterId: gatekeeperId,
      playerCurrentHp: playerMaxHp,
      playerCurrentStamina: 10,
      monsterCurrentHp: overrides.gatekeeperHp ?? 1,
      monsterCurrentStamina: 10,
      round: 1,
      playerEffects: [],
      monsterEffects: [],
      monsterChargingAttackId: null,
      chargeRoundsLeft: 0,
      monsterAttackWeights: {},
      stunCooldownRoundsLeft: 0,
      dungeonBossMonsterId: bossId,
      dungeonTier: overrides.dungeonTier ?? 1,
    });

    return { userId, playerId, gatekeeperId, bossId, playerMaxHp, battle };
  }

  it("gatekeeper death partially settles: XP/loot awarded, boss swapped in, battle NOT deleted", async () => {
    const itemId = await createTestItem(sql, { name: "Gatekeeper Drop" });
    const { playerId, gatekeeperId, bossId, battle } = await setupDungeonBattle({
      gatekeeperDrops: [{ itemId, dropRate: 100 }],
    });
    // dropsPool tuple-check (50<=100 -> success), winner-index (only option),
    // growl roll (100 -> fails, since growlChancePercent is 50).
    const uc = buildUseCases(sql, new FakeRng([50, 0, 100]));
    await uc.battleRepository.create(battle);

    const result = await uc.attackUseCase.execute({ playerId, attackName: "HIT" });

    expect(result.outcome).toBe("ongoing");
    expect(result.lootOffer).toEqual([itemId]);
    expect(result.messages.some((m) => m.includes("has fallen"))).toBe(true);
    expect(result.messages.some((m) => m.includes("reveals itself"))).toBe(true);

    const updatedBattle = await uc.battleRepository.findByPlayerId(playerId);
    expect(updatedBattle?.monsterId).toBe(bossId);
    expect(updatedBattle?.dungeonBossMonsterId).toBeNull();
    expect(updatedBattle?.dungeonTier).toBe(1);
    expect(updatedBattle?.monsterCurrentHp).toBe(500);

    const player = await uc.playerRepository.findById(playerId);
    expect(player?.xp).toBe(100);
    expect(player?.pendingLoot).toEqual([itemId]);

    // The gatekeeper monster itself is untouched — only the battle row moved on.
    expect(await uc.monsterRepository.findById(gatekeeperId)).not.toBeNull();
  });

  it("boss death after the transition fully settles, appending loot on top of the gatekeeper's", async () => {
    const gatekeeperItemId = await createTestItem(sql, { name: "Gatekeeper Drop 2" });
    const bossItemId = await createTestItem(sql, { name: "Boss Drop" });
    const { playerId, battle } = await setupDungeonBattle({
      gatekeeperHp: 1,
      gatekeeperDrops: [{ itemId: gatekeeperItemId, dropRate: 100 }],
      bossHp: 1,
      bossDrops: [{ itemId: bossItemId, dropRate: 100 }],
      dungeonTier: 1,
    });
    // Kill 1 (gatekeeper): dropsPool tuple(50), winner-index(0), growl(100->fail).
    // Kill 2 (boss): dropsPool tuple(50), winner-index(0).
    const uc = buildUseCases(sql, new FakeRng([50, 0, 100, 50, 0]));
    await uc.battleRepository.create(battle);

    const first = await uc.attackUseCase.execute({ playerId, attackName: "HIT" });
    expect(first.outcome).toBe("ongoing");

    const second = await uc.attackUseCase.execute({ playerId, attackName: "HIT" });
    expect(second.outcome).toBe("won");
    expect(second.lootOffer).toEqual([bossItemId]);

    const player = await uc.playerRepository.findById(playerId);
    // Both drops present — the second win did NOT overwrite the first.
    expect(player?.pendingLoot?.sort()).toEqual([gatekeeperItemId, bossItemId].sort());
    expect(player?.xp).toBe(400); // 100 (gatekeeper) + 300 (boss)

    const battleAfter = await uc.battleRepository.findByPlayerId(playerId);
    expect(battleAfter).toBeNull();
  });

  it("a DoT tick that kills the gatekeeper (not a direct hit) still triggers the phase transition", async () => {
    const { playerId, bossId, battle } = await setupDungeonBattle({ gatekeeperHp: 100 });
    // Give the gatekeeper a lethal bleed DoT so it dies to the tick, not the strike.
    const battleWithDot = Battle.create({
      ...battle.toProps(),
      monsterEffects: [{ type: "dot", kind: "bleed", damagePerRound: 999, counterItemId: null }],
    });
    const uc = buildUseCases(sql, new FakeRng([100])); // growl fails; no drop pools set
    await uc.battleRepository.create(battleWithDot);

    // A miss (rest) still ticks effects and settles the transition.
    const result = await uc.restUseCase.execute({ playerId });

    expect(result.outcome).toBe("ongoing");
    const updatedBattle = await uc.battleRepository.findByPlayerId(playerId);
    expect(updatedBattle?.monsterId).toBe(bossId);
    expect(updatedBattle?.dungeonBossMonsterId).toBeNull();
  });
});
