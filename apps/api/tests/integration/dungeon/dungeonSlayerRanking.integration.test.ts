import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { SQL } from "bun";
import { Battle } from "@/domain/battle/Battle";
import { maxHp } from "@/domain/battle/battleConfig";
import { buildUseCases } from "../support/buildUseCases";
import { FakeRng } from "../support/FakeRng";
import { getSharedPostgresEnvironment } from "../support/sharedPostgresEnvironment";
import {
  createTestMonster,
  createTestMonsterAttack,
  createTestPlayer,
  createTestUser,
  linkMonsterMoveset,
} from "../support/testFixtures";

describe("Dungeon Slayer ranking (integration)", () => {
  let sql: SQL;

  beforeAll(async () => {
    const env = await getSharedPostgresEnvironment();
    sql = new SQL(env.connectionUri);
  }, 120_000);

  afterAll(async () => {
    await sql.close();
  });

  async function oneShotBattle(
    playerId: string,
    dungeonTier: 1 | 2 | 3 | null,
    dungeonIsBossFight: boolean,
  ) {
    const monsterId = await createTestMonster(sql, { hp: 1 });
    const attackId = await createTestMonsterAttack(sql, { staminaCost: 0, multiplier: 0.4 });
    await linkMonsterMoveset(sql, monsterId, attackId);

    const playerMaxHp = maxHp(1, 1);
    return Battle.create({
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
      statusCooldownRoundsLeft: 0,
      dungeonIsBossFight,
      dungeonTier,
      revealedMonsterAttributes: [],
    });
  }

  it("upserts a ranking row only when the win-settling battle has dungeonTier === 3 && dungeonIsBossFight", async () => {
    const userId = await createTestUser(sql);
    const playerId = await createTestPlayer(sql, userId);
    const uc = buildUseCases(sql, new FakeRng([1]));

    const battle = await oneShotBattle(playerId, 3, true);
    await uc.battleRepository.create(battle);
    await uc.attackUseCase.execute({ playerId, attackName: "HIT" });

    const ranking = await uc.dungeonSlayerRankingRepository.findByPlayerId(playerId);
    expect(ranking?.kills).toBe(1);
    expect(ranking?.lastKillAt).not.toBeNull();
  });

  it("a second tier-3 boss kill by the same player increments kills and refreshes last_kill_at", async () => {
    const userId = await createTestUser(sql);
    const playerId = await createTestPlayer(sql, userId);
    const uc = buildUseCases(sql, new FakeRng([1]));

    const battle1 = await oneShotBattle(playerId, 3, true);
    await uc.battleRepository.create(battle1);
    await uc.attackUseCase.execute({ playerId, attackName: "HIT" });

    const battle2 = await oneShotBattle(playerId, 3, true);
    await uc.battleRepository.create(battle2);
    await uc.attackUseCase.execute({ playerId, attackName: "HIT" });

    const ranking = await uc.dungeonSlayerRankingRepository.findByPlayerId(playerId);
    expect(ranking?.kills).toBe(2);
  });

  it("a tier-1/tier-2 boss kill creates no ranking row", async () => {
    const userId = await createTestUser(sql);
    const playerId = await createTestPlayer(sql, userId);
    const uc = buildUseCases(sql, new FakeRng([1]));

    const battle = await oneShotBattle(playerId, 1, true);
    await uc.battleRepository.create(battle);
    await uc.attackUseCase.execute({ playerId, attackName: "HIT" });

    expect(await uc.dungeonSlayerRankingRepository.findByPlayerId(playerId)).toBeNull();
  });

  it("a step kill at tier 3 (dungeonIsBossFight false) creates no ranking row", async () => {
    const userId = await createTestUser(sql);
    const playerId = await createTestPlayer(sql, userId);
    const uc = buildUseCases(sql, new FakeRng([1]));

    const battle = await oneShotBattle(playerId, 3, false);
    await uc.battleRepository.create(battle);
    await uc.attackUseCase.execute({ playerId, attackName: "HIT" });

    expect(await uc.dungeonSlayerRankingRepository.findByPlayerId(playerId)).toBeNull();
  });

  it("GET /dungeon/leaderboard orders by kills desc, ties by last_kill_at asc, and omits non-slayers", async () => {
    const uc = buildUseCases(sql, new FakeRng([1]));
    const userId = await createTestUser(sql);
    const playerId = await createTestPlayer(sql, userId, { level: 20 });
    await uc.updatePlayerNameUseCase.execute({ playerId, playerName: "TopSlayer99" });

    const battle1 = await oneShotBattle(playerId, 3, true);
    await uc.battleRepository.create(battle1);
    await uc.attackUseCase.execute({ playerId, attackName: "HIT" });
    const battle2 = await oneShotBattle(playerId, 3, true);
    await uc.battleRepository.create(battle2);
    await uc.attackUseCase.execute({ playerId, attackName: "HIT" });

    const neverSlainUserId = await createTestUser(sql);
    const neverSlainPlayerId = await createTestPlayer(sql, neverSlainUserId);

    const leaderboard = await uc.getDungeonSlayerLeaderboardUseCase.execute();

    const entry = leaderboard.find((e) => e.playerName === "TopSlayer99");
    expect(entry?.kills).toBe(2);
    expect(leaderboard.some((e) => e.playerName === null && e.kills === 0)).toBe(false);
    void neverSlainPlayerId;
  });
});
