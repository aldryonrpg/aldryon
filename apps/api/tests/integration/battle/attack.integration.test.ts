import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { SQL } from "bun";
import { Battle } from "@/domain/battle/Battle";
import { isDot } from "@/domain/battle/BattleEffect";
import { maxHp } from "@/domain/battle/battleConfig";
import { computeDamage } from "@/domain/battle/services/DamageCalculator";
import { AttackNotUsableError, UnknownAttackError } from "@/usecase/battle/errors";
import { buildUseCases } from "../support/buildUseCases";
import { expectRejection } from "../support/expectRejection";
import { FakeRng } from "../support/FakeRng";
import { getSharedPostgresEnvironment } from "../support/sharedPostgresEnvironment";
import {
  createTestItem,
  createTestMonster,
  createTestMonsterAttack,
  createTestPlayer,
  createTestPlayerAttack,
  createTestUser,
  linkMonsterMoveset,
} from "../support/testFixtures";

describe("AttackUseCase (integration)", () => {
  let sql: SQL;

  beforeAll(async () => {
    const env = await getSharedPostgresEnvironment();
    sql = new SQL(env.connectionUri);
  }, 120_000);

  afterAll(async () => {
    await sql.close();
  });

  async function setupBasicBattle(overrides: {
    playerHp?: number;
    playerStamina?: number;
    monsterHp?: number;
    monsterStamina?: number;
    playerStrength?: number;
    monsterStrength?: number;
    monsterLuck?: number;
    playerLuck?: number;
    monsterType?: "normal" | "poisonous";
    drops?: { itemId: string; dropRate: number }[];
  }) {
    const userId = await createTestUser(sql);
    const playerId = await createTestPlayer(sql, userId, {
      strength: overrides.playerStrength ?? 10,
      luck: overrides.playerLuck ?? 1,
    });
    const monsterId = await createTestMonster(sql, {
      hp: overrides.monsterHp ?? 100,
      strength: overrides.monsterStrength ?? 1,
      luck: overrides.monsterLuck ?? 1,
      monsterType: overrides.monsterType ?? "normal",
      drops: overrides.drops ?? [],
    });
    const monsterAttackId = await createTestMonsterAttack(sql, {
      staminaCost: 0,
      multiplier: 1,
      scalingAttribute: "strength",
    });
    await linkMonsterMoveset(sql, monsterId, monsterAttackId);

    const playerMaxHp = maxHp(1, overrides.playerStrength ?? 10);
    const battle = Battle.create({
      id: Bun.randomUUIDv7(),
      playerId,
      monsterId,
      playerCurrentHp: overrides.playerHp ?? playerMaxHp,
      playerCurrentStamina: overrides.playerStamina ?? 10,
      monsterCurrentHp: overrides.monsterHp ?? 100,
      monsterCurrentStamina: overrides.monsterStamina ?? 10,
      round: 1,
      playerEffects: [],
      monsterEffects: [],
      monsterChargingAttackId: null,
      chargeRoundsLeft: 0,
      monsterAttackWeights: {},
      statusCooldownRoundsLeft: 0,
      dungeonIsBossFight: false,
      revealedMonsterAttributes: [],
      dungeonTier: null,
    });

    return { userId, playerId, monsterId, monsterAttackId, playerMaxHp, battle };
  }

  it("resolves a full turn: player strikes, monster replies, stamina spent, statuses persisted (happy path)", async () => {
    const { playerId, battle } = await setupBasicBattle({});
    const uc = buildUseCases(sql, new FakeRng([0, 50]));
    await uc.battleRepository.create(battle);

    const result = await uc.attackUseCase.execute({ playerId, attackName: "HIT" });

    const expectedPlayerDamage = computeDamage({
      attackMultiplier: 1, // seeded HIT multiplier (combat-balance follow-up)
      attackerScalingValue: 10,
      staminaCost: 5, // seeded HIT stamina cost (combat-balance follow-up)
      defenderLevel: 1,
      defenderScalingValue: 1,
    });

    expect(result.playerAttack).toEqual({
      attackName: "HIT",
      hit: true,
      damage: expectedPlayerDamage,
      effectApplied: null,
    });
    expect(result.outcome).toBe("ongoing");
    expect(result.playerStatus.currentStamina).toBe(10); // 10 - 5 (HIT) + 5 passive
    expect(result.monsterStatus.currentHp).toBe(100 - expectedPlayerDamage);
  });

  it("rejects an unknown attack name", async () => {
    const { playerId, battle } = await setupBasicBattle({});
    const uc = buildUseCases(sql, new FakeRng([1]));
    await uc.battleRepository.create(battle);

    await expectRejection(
      uc.attackUseCase.execute({ playerId, attackName: "NOT_REAL" }),
      UnknownAttackError,
    );
  });

  it("rejects an attack the player can't afford (insufficient stamina)", async () => {
    const { playerId, battle } = await setupBasicBattle({ playerStamina: 5 });
    const costlyAttackName = "Costly Slash";
    await createTestPlayerAttack(sql, { name: costlyAttackName, staminaCost: 20, multiplier: 1 });

    const uc = buildUseCases(sql, new FakeRng([1]));
    await uc.battleRepository.create(battle);

    await expectRejection(
      uc.attackUseCase.execute({ playerId, attackName: costlyAttackName }),
      AttackNotUsableError,
    );
  });

  it("kill flow: awards XP, rolls drops into pending_loot, deletes the battle row", async () => {
    const itemId = await createTestItem(sql, { name: "Rare Fang" });
    const { playerId, monsterId, battle } = await setupBasicBattle({
      monsterHp: 1,
      drops: [{ itemId, dropRate: 1000 }],
    });

    // pick(monster attack, unused since monster dies before acting) not consumed;
    // drop roll: [tuple-roll(<=100000 always succeeds at dropRate 1000), winner-index(0, only success)]
    const uc = buildUseCases(sql, new FakeRng([50, 0]));
    await uc.battleRepository.create(battle);

    const monsterBefore = await uc.monsterRepository.findById(monsterId);
    const playerBefore = await uc.playerRepository.findById(playerId);
    console.log(
      "DEBUG drops order:",
      JSON.stringify(monsterBefore?.drops),
      "expected itemId:",
      itemId,
    );

    const result = await uc.attackUseCase.execute({ playerId, attackName: "HIT" });

    expect(result.outcome).toBe("won");
    expect(result.lootOffer).toEqual([itemId]);

    const playerAfter = await uc.playerRepository.findById(playerId);
    expect(playerAfter?.xp).toBe((playerBefore?.xp ?? 0) + (monsterBefore?.xpGain ?? 0));
    expect(playerAfter?.pendingLoot).toEqual([itemId]);

    const battleAfter = await uc.battleRepository.findByPlayerId(playerId);
    expect(battleAfter).toBeNull();
  });

  it("death flow: applies the 1% XP penalty and deletes the battle row", async () => {
    const { playerId, battle } = await setupBasicBattle({
      playerHp: 1,
      playerStrength: 1, // player deals ~0 damage, monster survives to act
      monsterStrength: 10, // monster deals lethal damage back
      monsterHp: 100,
    });
    await sql`update players set xp = 1000 where id = ${playerId}`;

    // pick(monster's only attack, idx0) then proc roll (value doesn't matter, low luck diff)
    const uc = buildUseCases(sql, new FakeRng([0, 50]));
    await uc.battleRepository.create(battle);

    const result = await uc.attackUseCase.execute({ playerId, attackName: "HIT" });

    expect(result.outcome).toBe("lost");

    const playerAfter = await uc.playerRepository.findById(playerId);
    expect(playerAfter?.xp).toBe(990);
    expect(playerAfter?.lastDeathAt).not.toBeNull();

    const battleAfter = await uc.battleRepository.findByPlayerId(playerId);
    expect(battleAfter).toBeNull();
  });

  it("procs the monster's innate type DoT on a successful hit with a large Luck lead", async () => {
    const { playerId, battle } = await setupBasicBattle({
      playerHp: 500,
      monsterLuck: 100,
      playerLuck: 1,
      monsterType: "poisonous",
      monsterStrength: 1,
    });

    // pick(idx0), proc roll (<=99 always procs given a 99-point Luck lead)
    const uc = buildUseCases(sql, new FakeRng([0, 50]));
    await uc.battleRepository.create(battle);

    const result = await uc.attackUseCase.execute({ playerId, attackName: "HIT" });

    expect(result.monsterAttack?.effectApplied).toBe("poison");

    const battleAfter = await uc.battleRepository.findByPlayerId(playerId);
    expect(battleAfter?.playerEffects.some((e) => e.type === "dot" && e.kind === "poison")).toBe(
      true,
    );
  });

  it("resolves the cure item for an attack-caused effect via the centralized effect_counters table, not the monster's innate type", async () => {
    // The monster is 'normal' (innate bleed), but its special explicitly
    // applies 'poison' instead — proving the cure resolves off the effect
    // *kind*, not off the monster's own innate type or any per-attack data
    // (attacks/monster_attacks no longer even have a counter_item_id column).
    const userId = await createTestUser(sql);
    const playerId = await createTestPlayer(sql, userId, { strength: 10 });
    const monsterId = await createTestMonster(sql, { hp: 100, strength: 1, monsterType: "normal" });
    const specialId = await createTestMonsterAttack(sql, {
      name: "Venom Fang",
      staminaCost: 5,
      multiplier: 0,
      scalingAttribute: "strength",
      appliesEffect: "poison",
      isSpecial: true,
      chargeTurns: 1,
    });
    await linkMonsterMoveset(sql, monsterId, specialId);

    const battle = Battle.create({
      id: Bun.randomUUIDv7(),
      playerId,
      monsterId,
      playerCurrentHp: maxHp(1, 10),
      playerCurrentStamina: 10,
      monsterCurrentHp: 100,
      monsterCurrentStamina: 25,
      round: 1,
      playerEffects: [],
      monsterEffects: [],
      monsterChargingAttackId: null,
      chargeRoundsLeft: 0,
      monsterAttackWeights: {},
      statusCooldownRoundsLeft: 0,
      dungeonIsBossFight: false,
      revealedMonsterAttributes: [],
      dungeonTier: null,
    });

    const uc = buildUseCases(sql, new FakeRng([0]));
    await uc.battleRepository.create(battle);

    // Turn 1: monster starts charging Venom Fang. Turn 2: unleashes it,
    // guaranteed effect on unleash (plan2 §6a).
    await uc.attackUseCase.execute({ playerId, attackName: "HIT" });
    await uc.attackUseCase.execute({ playerId, attackName: "HIT" });

    const [antidote] = await sql<
      { id: string }[]
    >`select id from items where name = 'antidote' limit 1`;

    const battleAfter = await uc.battleRepository.findByPlayerId(playerId);
    const poisonEffect = battleAfter?.playerEffects.find((e) => isDot(e) && e.kind === "poison");
    expect(poisonEffect && isDot(poisonEffect) ? poisonEffect.counterItemId : null).toBe(
      antidote.id,
    );
  });

  it("charge -> unleash: the monster charges a special, then unleashes it guaranteed with 100% effect", async () => {
    const userId = await createTestUser(sql);
    const playerId = await createTestPlayer(sql, userId, { strength: 10 });
    const monsterId = await createTestMonster(sql, { hp: 100, strength: 1, monsterType: "normal" });
    const specialId = await createTestMonsterAttack(sql, {
      name: "Charged Slam",
      staminaCost: 5,
      multiplier: 2,
      scalingAttribute: "strength",
      isSpecial: true,
      chargeTurns: 1,
    });
    await linkMonsterMoveset(sql, monsterId, specialId);

    const battle = Battle.create({
      id: Bun.randomUUIDv7(),
      playerId,
      monsterId,
      playerCurrentHp: maxHp(1, 10),
      playerCurrentStamina: 10,
      monsterCurrentHp: 100,
      monsterCurrentStamina: 25,
      round: 1,
      playerEffects: [],
      monsterEffects: [],
      monsterChargingAttackId: null,
      chargeRoundsLeft: 0,
      monsterAttackWeights: {},
      statusCooldownRoundsLeft: 0,
      dungeonIsBossFight: false,
      revealedMonsterAttributes: [],
      dungeonTier: null,
    });

    const uc = buildUseCases(sql, new FakeRng([0]));
    await uc.battleRepository.create(battle);

    const turn1 = await uc.attackUseCase.execute({ playerId, attackName: "HIT" });
    expect(turn1.monsterAttack).toBeNull();
    expect(turn1.messages.length).toBeGreaterThan(0);

    const chargingBattle = await uc.battleRepository.findByPlayerId(playerId);
    expect(chargingBattle?.monsterChargingAttackId).toBe(specialId);
    expect(chargingBattle?.chargeRoundsLeft).toBe(1);

    const turn2 = await uc.attackUseCase.execute({ playerId, attackName: "HIT" });
    expect(turn2.monsterAttack?.attackName).toBe("Charged Slam");
    expect(turn2.monsterAttack?.hit).toBe(true);
    expect(turn2.monsterAttack?.effectApplied).toBe("bleed");

    const finalBattle = await uc.battleRepository.findByPlayerId(playerId);
    expect(finalBattle?.monsterChargingAttackId).toBeNull();
  });
});
