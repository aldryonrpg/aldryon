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

/** The third (legendary_drops) pool a materialized dungeon boss carries
 * (plan3 §2c) — rolled exactly like the other two pools, independently. */
describe("legendary_drops pool (integration)", () => {
  let sql: SQL;

  beforeAll(async () => {
    const env = await getSharedPostgresEnvironment();
    sql = new SQL(env.connectionUri);
  }, 120_000);

  afterAll(async () => {
    await sql.close();
  });

  async function setupOneShotBattle(legendaryDropRate: number, legendaryItemId: string) {
    const userId = await createTestUser(sql);
    const playerId = await createTestPlayer(sql, userId);
    const monsterId = await createTestMonster(sql, {
      hp: 1,
      legendaryDrops: [{ itemId: legendaryItemId, dropRate: legendaryDropRate }],
    });
    const attackId = await createTestMonsterAttack(sql, { staminaCost: 0, multiplier: 0.4 });
    await linkMonsterMoveset(sql, monsterId, attackId);

    const playerMaxHp = maxHp(1, 1);
    const battle = Battle.create({
      id: Bun.randomUUIDv7(),
      playerId,
      monsterId,
      playerCurrentHp: playerMaxHp,
      playerCurrentStamina: 10,
      monsterCurrentHp: 1,
      monsterCurrentStamina: 10,
      round: 1,
      playerEffects: [],
      monsterEffects: [],
      monsterChargingAttackId: null,
      chargeRoundsLeft: 0,
      monsterAttackWeights: {},
      stunCooldownRoundsLeft: 0,
      dungeonIsBossFight: false,
      revealedMonsterAttributes: [],
      dungeonTier: null,
    });
    return { playerId, battle };
  }

  it("a seeded hit yields the legendary item alongside the (empty) regular pools", async () => {
    const legendaryItemId = await createTestItem(sql, { name: "Legendary Drop Test Hit" });
    const { playerId, battle } = await setupOneShotBattle(100, legendaryItemId);
    // tuple-check (50<=100 -> success), winner-index (only option).
    const uc = buildUseCases(sql, new FakeRng([50, 0]));
    await uc.battleRepository.create(battle);

    const result = await uc.attackUseCase.execute({ playerId, attackName: "HIT" });

    expect(result.outcome).toBe("won");
    expect(result.lootOffer).toEqual([legendaryItemId]);
  });

  it("a seeded miss yields nothing from the legendary pool", async () => {
    const legendaryItemId = await createTestItem(sql, { name: "Legendary Drop Test Miss" });
    const { playerId, battle } = await setupOneShotBattle(1, legendaryItemId);
    // tuple-check (100 > 1 -> fails); no winner-index call needed on a miss.
    const uc = buildUseCases(sql, new FakeRng([100]));
    await uc.battleRepository.create(battle);

    const result = await uc.attackUseCase.execute({ playerId, attackName: "HIT" });

    expect(result.outcome).toBe("won");
    expect(result.lootOffer).toEqual([]);
  });
});
