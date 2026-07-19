import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { SQL } from "bun";
import { Battle } from "@/domain/battle/Battle";
import { maxHp, maxStamina } from "@/domain/battle/battleConfig";
import { computeDamage } from "@/domain/battle/services/DamageCalculator";
import { AttackNotUsableError } from "@/usecase/battle/errors";
import { buildUseCases } from "../support/buildUseCases";
import { expectRejection } from "../support/expectRejection";
import { FakeRng } from "../support/FakeRng";
import { getSharedPostgresEnvironment } from "../support/sharedPostgresEnvironment";
import {
  createTestMonster,
  createTestMonsterAttack,
  createTestPlayer,
  createTestUser,
  linkMonsterMoveset,
} from "../support/testFixtures";

/**
 * FIREBALL SPELL (supabase/migrations/20260719060000_seed_fireball_spell.sql)
 * — a second Intelligence-scaled offensive player spell alongside BURN
 * SPELL: 20 Stamina, x2 multiplier, gated behind >=30 Intelligence, no DoT.
 * Exercised here against the real seeded catalog row (testcontainers applies
 * the migrations folder directly, no fixture stand-in needed), so this also
 * confirms the migration itself landed correctly.
 */
describe("FIREBALL SPELL (integration)", () => {
  let sql: SQL;

  beforeAll(async () => {
    const env = await getSharedPostgresEnvironment();
    sql = new SQL(env.connectionUri);
  }, 120_000);

  afterAll(async () => {
    await sql.close();
  });

  it("is seeded with the expected catalog values", async () => {
    const uc = buildUseCases(sql, new FakeRng([1]));
    const attacks = await uc.attackRepository.findAll();
    const fireball = attacks.find((a) => a.name === "FIREBALL SPELL");

    expect(fireball).toBeDefined();
    expect(fireball?.staminaCost).toBe(20);
    expect(fireball?.multiplier).toBe(2);
    expect(fireball?.scalingAttribute).toBe("intelligence");
    expect(fireball?.appliesEffect).toBeNull();
    expect(fireball?.attributeRequirements.intelligence).toBe(30);
  });

  it("scales defense off the defender's own Intelligence, not Strength (attack-type-driven defense)", async () => {
    const userId = await createTestUser(sql);
    // High Intelligence (comfortably above the 30 requirement); Strength is
    // irrelevant to a magic attack either way.
    const playerId = await createTestPlayer(sql, userId, { intelligence: 40, strength: 1 });
    // Deliberately lopsided — high Strength, low Intelligence — so this test
    // fails loudly if defense ever again reads the wrong attribute.
    const monsterId = await createTestMonster(sql, { hp: 1000, strength: 20, intelligence: 3 });
    const monsterAttackId = await createTestMonsterAttack(sql, {
      staminaCost: 0,
      multiplier: 0,
      scalingAttribute: "strength",
    });
    await linkMonsterMoveset(sql, monsterId, monsterAttackId);

    const battle = Battle.create({
      id: Bun.randomUUIDv7(),
      playerId,
      monsterId,
      playerCurrentHp: maxHp(1, 1),
      playerCurrentStamina: 20,
      monsterCurrentHp: 1000,
      monsterCurrentStamina: 10,
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

    const uc = buildUseCases(sql, new FakeRng([0, 50]));
    await uc.battleRepository.create(battle);

    const result = await uc.attackUseCase.execute({ playerId, attackName: "FIREBALL SPELL" });

    const expectedDamage = computeDamage({
      attackMultiplier: 2,
      attackerScalingValue: 40, // player's Intelligence
      staminaCost: 20,
      defenderLevel: 1,
      // Monster's own Intelligence, not its (much higher) Strength — FIREBALL
      // SPELL is Intelligence-scaled, so defense matches that, not a fixed
      // per-side stance.
      defenderScalingValue: 3,
    });

    expect(result.playerAttack).toEqual({
      attackName: "FIREBALL SPELL",
      hit: true,
      damage: expectedDamage,
      effectApplied: null,
    });
    expect(result.playerStatus.currentStamina).toBe(5); // 20 - 20 (spell) + 5 passive
  });

  it("rejects a caster below the 30-Intelligence requirement", async () => {
    const userId = await createTestUser(sql);
    const playerId = await createTestPlayer(sql, userId, { intelligence: 29 });
    const monsterId = await createTestMonster(sql, { hp: 100 });
    const monsterAttackId = await createTestMonsterAttack(sql, { staminaCost: 0, multiplier: 1 });
    await linkMonsterMoveset(sql, monsterId, monsterAttackId);

    const battle = Battle.create({
      id: Bun.randomUUIDv7(),
      playerId,
      monsterId,
      playerCurrentHp: maxHp(1, 1),
      playerCurrentStamina: maxStamina(1),
      monsterCurrentHp: 100,
      monsterCurrentStamina: 10,
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

    const uc = buildUseCases(sql, new FakeRng([1]));
    await uc.battleRepository.create(battle);

    await expectRejection(
      uc.attackUseCase.execute({ playerId, attackName: "FIREBALL SPELL" }),
      AttackNotUsableError,
    );
  });
});
