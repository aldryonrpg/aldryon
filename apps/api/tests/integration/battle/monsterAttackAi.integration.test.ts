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

describe("Monster attack-selection AI (integration)", () => {
  let sql: SQL;

  beforeAll(async () => {
    const env = await getSharedPostgresEnvironment();
    sql = new SQL(env.connectionUri);
  }, 120_000);

  afterAll(async () => {
    await sql.close();
  });

  it("always starts charging an affordable special over a much higher-damage normal attack", async () => {
    const userId = await createTestUser(sql);
    const playerId = await createTestPlayer(sql, userId, { strength: 1 });
    const monsterId = await createTestMonster(sql, { hp: 1000, strength: 100 });
    const strongNormalId = await createTestMonsterAttack(sql, {
      name: "Strong Normal",
      staminaCost: 0,
      multiplier: 10,
      scalingAttribute: "strength",
    });
    const weakSpecialId = await createTestMonsterAttack(sql, {
      name: "Weak Special",
      staminaCost: 2,
      multiplier: 0,
      scalingAttribute: "strength",
      isSpecial: true,
      chargeTurns: 1,
    });
    await linkMonsterMoveset(sql, monsterId, strongNormalId);
    await linkMonsterMoveset(sql, monsterId, weakSpecialId);

    const battle = Battle.create({
      id: Bun.randomUUIDv7(),
      playerId,
      monsterId,
      playerCurrentHp: maxHp(1, 1),
      playerCurrentStamina: 10,
      monsterCurrentHp: 1000,
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

    // Both attacks are affordable and selection is deterministic (a single
    // affordable special beats any number of affordable normals, no rng) —
    // the only value consumed is the charge-warning flavor pick.
    const uc = buildUseCases(sql, new FakeRng([0]));
    await uc.battleRepository.create(battle);

    const result = await uc.attackUseCase.execute({ playerId, attackName: "HIT" });

    expect(result.monsterAttack).toBeNull();
    expect(result.messages.length).toBeGreaterThan(0);

    const charging = await uc.battleRepository.findByPlayerId(playerId);
    expect(charging?.monsterChargingAttackId).toBe(weakSpecialId);
  });

  it("rotates onto a lower-damage attack once its unpicked weight outweighs the gap", async () => {
    const userId = await createTestUser(sql);
    const playerId = await createTestPlayer(sql, userId, { strength: 5 });
    const monsterId = await createTestMonster(sql, { hp: 100_000, strength: 10 });
    // damage = ceil(multiplier * 10) + 0 - ceil(1 * 5): Strong=5, Weak=3.
    const strongId = await createTestMonsterAttack(sql, {
      name: "Strong",
      staminaCost: 0,
      multiplier: 1.0,
      scalingAttribute: "strength",
    });
    const weakId = await createTestMonsterAttack(sql, {
      name: "Weak",
      staminaCost: 0,
      multiplier: 0.8,
      scalingAttribute: "strength",
    });
    await linkMonsterMoveset(sql, monsterId, strongId);
    await linkMonsterMoveset(sql, monsterId, weakId);

    const battle = Battle.create({
      id: Bun.randomUUIDv7(),
      playerId,
      monsterId,
      playerCurrentHp: maxHp(1, 5),
      playerCurrentStamina: 100,
      monsterCurrentHp: 100_000,
      monsterCurrentStamina: 100,
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

    // Hits are guaranteed both ways and selection itself needs no rng, so
    // each turn consumes exactly one value for the effect-proc roll; 50
    // fails it every time (diff 0), keeping the battle state simple.
    //
    // Score = damage + weight. Turn1: Strong(5+0) beats Weak(3+0) -> Strong,
    // weightWeak=1. Turn2: Strong(5+0) still beats Weak(3+1=4) -> Strong,
    // weightWeak=2. Turn3: Strong(5+0) ties Weak(3+2=5) -> Strong wins the
    // tie (first in candidate order), weightWeak=3. Turn4: Weak(3+3=6) beats
    // Strong(5+0=5) -> Weak finally wins.
    const uc = buildUseCases(sql, new FakeRng([50, 50, 50, 50]));
    await uc.battleRepository.create(battle);

    const turn1 = await uc.attackUseCase.execute({ playerId, attackName: "HIT" });
    expect(turn1.monsterAttack?.attackName).toBe("Strong");

    const turn2 = await uc.attackUseCase.execute({ playerId, attackName: "HIT" });
    expect(turn2.monsterAttack?.attackName).toBe("Strong");

    const turn3 = await uc.attackUseCase.execute({ playerId, attackName: "HIT" });
    expect(turn3.monsterAttack?.attackName).toBe("Strong");

    const turn4 = await uc.attackUseCase.execute({ playerId, attackName: "HIT" });
    expect(turn4.monsterAttack?.attackName).toBe("Weak");
  });
});
