import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { SQL } from "bun";
import { Battle } from "@/domain/battle/Battle";
import { DUNGEON_CONFIG } from "@/domain/dungeon/dungeonConfig";
import { BattleAlreadyInProgressError } from "@/usecase/battle/errors";
import {
  BelowMinimumDungeonLevelError,
  DailyDungeonLimitReachedError,
  DungeonRunAlreadyInProgressError,
} from "@/usecase/dungeon/errors";
import { buildUseCases } from "../support/buildUseCases";
import { expectRejection } from "../support/expectRejection";
import { FakeRng } from "../support/FakeRng";
import { getSharedPostgresEnvironment } from "../support/sharedPostgresEnvironment";
import {
  createTestMonster,
  createTestPlayer,
  createTestUser,
  setPlayerDungeonAttempts,
} from "../support/testFixtures";

// Dungeons never roll an empty encounter — the first roll is always the
// step-monster pick. roll1=0 deterministically picks whichever monster sorts
// first (name asc) across the whole catalog (fixture-created "Test Monster
// ..." rows always sort after any all-caps seed name, so this is stable
// regardless of which real one it happens to be). roll2=99 guarantees no
// ambush regardless of that monster's ambush_chance.
const NO_AMBUSH_RNG = () => new FakeRng([0, 99]);

describe("StartDungeonUseCase (integration)", () => {
  let sql: SQL;

  beforeAll(async () => {
    const env = await getSharedPostgresEnvironment();
    sql = new SQL(env.connectionUri);
  }, 120_000);

  afterAll(async () => {
    await sql.close();
  });

  it("rejects a player below level 10 (403)", async () => {
    const userId = await createTestUser(sql);
    const playerId = await createTestPlayer(sql, userId, { level: 9 });
    const uc = buildUseCases(sql, NO_AMBUSH_RNG());

    await expectRejection(
      uc.startDungeonUseCase.execute({ playerId, isVip: false }),
      BelowMinimumDungeonLevelError,
    );
  });

  it("starts step 1 with a live Dungeon-Enhanced catalog monster, no new monsters row (happy path)", async () => {
    const userId = await createTestUser(sql);
    const playerId = await createTestPlayer(sql, userId, { level: 12, strength: 10 });
    const uc = buildUseCases(sql, NO_AMBUSH_RNG());

    const monstersBefore = await sql<{ n: number }[]>`select count(*)::int as n from monsters`;

    const result = await uc.startDungeonUseCase.execute({ playerId, isVip: false });

    expect(result.outcome).toBe("ongoing");
    expect(result.monster).not.toBeNull();

    const battle = await uc.battleRepository.findByPlayerId(playerId);
    expect(battle?.dungeonTier).toBe(1);
    expect(battle?.dungeonIsBossFight).toBe(false);

    // The picked monster's stats are scaled relative to its own catalog row
    // (tier 1 -> 100%, so unchanged) — no row was inserted for this pick.
    // Attribute values themselves are never in the client-facing output
    // until revealed (loot-system-adjacent monster-attribute-reveal
    // feature) — hp is the one stat that stays visible, so it's what proves
    // the scaling wiring; the scaling math itself is unit-tested in
    // scaleMonsterForDungeonStep.test.ts.
    const rawMonster = await uc.monsterRepository.findById(result.monster?.id as string);
    expect(result.monster?.hp).toBe(rawMonster?.hp);
    expect(result.monster?.attributes).toEqual({});

    const monstersAfter = await sql<{ n: number }[]>`select count(*)::int as n from monsters`;
    expect(monstersAfter[0]?.n).toBe(monstersBefore[0]?.n);

    const player = await uc.playerRepository.findById(playerId);
    expect(player?.dungeonRunTier).toBe(1);
    expect(player?.dungeonRunStep).toBe(1);
    expect(player?.dungeonRunTotalSteps).toBe(DUNGEON_CONFIG.stepsPerTier[1]);
  });

  it("scales the step monster's stats up for a tier-2 player (150%)", async () => {
    const userId = await createTestUser(sql);
    const playerId = await createTestPlayer(sql, userId, { level: 15 });
    const uc = buildUseCases(sql, NO_AMBUSH_RNG());

    const result = await uc.startDungeonUseCase.execute({ playerId, isVip: false });

    const rawMonster = await uc.monsterRepository.findById(result.monster?.id as string);
    expect(result.monster?.hp).toBe(Math.ceil((rawMonster?.hp ?? 0) * 1.5));

    const player = await uc.playerRepository.findById(playerId);
    expect(player?.dungeonRunTier).toBe(2);
    expect(player?.dungeonRunTotalSteps).toBe(DUNGEON_CONFIG.stepsPerTier[2]);
  });

  it("sets 5 total steps for a tier-3 (level 20+) player", async () => {
    const userId = await createTestUser(sql);
    const playerId = await createTestPlayer(sql, userId, { level: 20 });
    const uc = buildUseCases(sql, NO_AMBUSH_RNG());

    await uc.startDungeonUseCase.execute({ playerId, isVip: false });

    const player = await uc.playerRepository.findById(playerId);
    expect(player?.dungeonRunTier).toBe(3);
    expect(player?.dungeonRunTotalSteps).toBe(DUNGEON_CONFIG.stepsPerTier[3]);
  });

  it("rejects entering while a battle (wild or dungeon) is already in progress (409)", async () => {
    const userId = await createTestUser(sql);
    const playerId = await createTestPlayer(sql, userId, { level: 12 });
    const monsterId = await createTestMonster(sql, { region: "forest" });
    const uc = buildUseCases(sql, NO_AMBUSH_RNG());
    await uc.battleRepository.create(
      Battle.create({
        id: Bun.randomUUIDv7(),
        playerId,
        monsterId,
        playerCurrentHp: 100,
        playerCurrentStamina: 25,
        monsterCurrentHp: 50,
        monsterCurrentStamina: 25,
        round: 1,
        playerEffects: [],
        monsterEffects: [],
        monsterChargingAttackId: null,
        chargeRoundsLeft: 0,
        monsterAttackWeights: {},
        stunCooldownRoundsLeft: 0,
        dungeonTier: null,
        dungeonIsBossFight: false,
        revealedMonsterAttributes: [],
      }),
    );

    await expectRejection(
      uc.startDungeonUseCase.execute({ playerId, isVip: false }),
      BattleAlreadyInProgressError,
    );
  });

  it("rejects starting a new run while a previous one is still awaiting Continue/Exit (409)", async () => {
    const userId = await createTestUser(sql);
    const playerId = await createTestPlayer(sql, userId, { level: 12 });
    const uc = buildUseCases(sql, NO_AMBUSH_RNG());

    await uc.startDungeonUseCase.execute({ playerId, isVip: false });
    // The kill hasn't happened yet, but simulate "the battle already ended
    // and the player hasn't clicked Continue/Exit" by clearing just the
    // battle row (dungeon_run_* stays set, exactly like after a real kill).
    await uc.battleRepository.deleteByPlayerId(playerId);

    await expectRejection(
      uc.startDungeonUseCase.execute({ playerId, isVip: false }),
      DungeonRunAlreadyInProgressError,
    );
  });

  it("daily limit: normal player gets 1 attempt/day, VIP gets 2, both reset the next UTC day", async () => {
    const userId = await createTestUser(sql);
    const playerId = await createTestPlayer(sql, userId, { level: 12 });
    let uc = buildUseCases(sql, NO_AMBUSH_RNG());

    await uc.startDungeonUseCase.execute({ playerId, isVip: false });
    await uc.battleRepository.deleteByPlayerId(playerId);
    // Close out the run (Exit) so the daily-limit check is what rejects the
    // next attempt, not the "run already in progress" guard.
    await uc.exitDungeonRunUseCase.execute({ playerId });

    // Each successful start consumes both of NO_AMBUSH_RNG's queued values
    // (pick index + ambush check) — a fresh instance per attempt keeps the
    // next pick's index in bounds instead of falling back to FakeRng's
    // "repeat the last queued value forever" behavior.
    await expectRejection(
      uc.startDungeonUseCase.execute({ playerId, isVip: false }),
      DailyDungeonLimitReachedError,
    );

    const vipUserId = await createTestUser(sql, { isVip: true });
    const vipPlayerId = await createTestPlayer(sql, vipUserId, { level: 12 });

    uc = buildUseCases(sql, NO_AMBUSH_RNG());
    await uc.startDungeonUseCase.execute({ playerId: vipPlayerId, isVip: true });
    await uc.battleRepository.deleteByPlayerId(vipPlayerId);
    await uc.exitDungeonRunUseCase.execute({ playerId: vipPlayerId });
    uc = buildUseCases(sql, NO_AMBUSH_RNG());
    await uc.startDungeonUseCase.execute({ playerId: vipPlayerId, isVip: true });
    await uc.battleRepository.deleteByPlayerId(vipPlayerId);
    await uc.exitDungeonRunUseCase.execute({ playerId: vipPlayerId });

    await expectRejection(
      uc.startDungeonUseCase.execute({ playerId: vipPlayerId, isVip: true }),
      DailyDungeonLimitReachedError,
    );

    // Simulate "yesterday" for the normal player -> eligible again today.
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    await setPlayerDungeonAttempts(sql, playerId, yesterday, null);
    uc = buildUseCases(sql, NO_AMBUSH_RNG());
    const result = await uc.startDungeonUseCase.execute({ playerId, isVip: false });
    expect(result.outcome).toBe("ongoing");
  });
});
