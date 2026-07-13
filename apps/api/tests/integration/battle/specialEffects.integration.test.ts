import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { SQL } from "bun";
import { Battle } from "@/domain/battle/Battle";
import { computeDamage } from "@/domain/battle/services/DamageCalculator";
import { buildUseCases } from "../support/buildUseCases";
import { FakeRng } from "../support/FakeRng";
import { getSharedPostgresEnvironment } from "../support/sharedPostgresEnvironment";
import {
  createTestMonster,
  createTestMonsterAttack,
  createTestPlayer,
  createTestPlayerAttack,
  createTestUser,
  linkMonsterMoveset,
} from "../support/testFixtures";

describe("Fear / Magic Aura Blast / Stun specials (integration)", () => {
  let sql: SQL;

  beforeAll(async () => {
    const env = await getSharedPostgresEnvironment();
    sql = new SQL(env.connectionUri);
  }, 120_000);

  afterAll(async () => {
    await sql.close();
  });

  it("unleashing a Fear special applies a Force stat-debuff to the player", async () => {
    const userId = await createTestUser(sql);
    const playerId = await createTestPlayer(sql, userId, { force: 20 });
    const monsterId = await createTestMonster(sql, { hp: 1000, force: 1 });
    const fearId = await createTestMonsterAttack(sql, {
      name: "Fear Test",
      staminaCost: 10,
      multiplier: 0,
      scalingAttribute: "force",
      appliesEffect: "fear",
      isSpecial: true,
      chargeTurns: 1,
    });
    await linkMonsterMoveset(sql, monsterId, fearId);

    const battle = Battle.create({
      id: Bun.randomUUIDv7(),
      playerId,
      monsterId,
      playerCurrentHp: 500,
      playerCurrentStamina: 10,
      monsterCurrentHp: 1000,
      monsterCurrentStamina: 25,
      round: 1,
      playerEffects: [],
      monsterEffects: [],
      monsterChargingAttackId: null,
      chargeRoundsLeft: 0,
      monsterAttackWeights: {},
      stunCooldownRoundsLeft: 0,
    });

    // turn1: pick Fear (only option, idx0), charge-warning flavor pick (idx0)
    const uc = buildUseCases(sql, new FakeRng([0, 0]));
    await uc.battleRepository.create(battle);

    await uc.attackUseCase.execute({ playerId, attackName: "HIT" });
    const charging = await uc.battleRepository.findByPlayerId(playerId);
    expect(charging?.monsterChargingAttackId).toBe(fearId);

    // turn2: unleash — guaranteed, no further rng consumption
    await uc.attackUseCase.execute({ playerId, attackName: "HIT" });
    const afterUnleash = await uc.battleRepository.findByPlayerId(playerId);

    const fearDebuff = afterUnleash?.playerEffects.find((e) => e.type === "debuff");
    expect(fearDebuff).toBeTruthy();
    expect(fearDebuff?.type).toBe("debuff");
    if (fearDebuff?.type === "debuff") {
      expect(fearDebuff.kind).toBe("fear");
      expect(fearDebuff.stat).toBe("force");
    }
  });

  it("unleashing a Stun special voids the player's next two turns while the monster keeps attacking", async () => {
    const userId = await createTestUser(sql);
    const playerId = await createTestPlayer(sql, userId, { force: 10 });
    const monsterId = await createTestMonster(sql, { hp: 1000, force: 1 });
    const clawId = await createTestMonsterAttack(sql, {
      name: "Claw",
      staminaCost: 2,
      multiplier: 1,
      scalingAttribute: "force",
    });
    const stunId = await createTestMonsterAttack(sql, {
      name: "Stun Test",
      staminaCost: 10,
      multiplier: 1,
      scalingAttribute: "force",
      appliesEffect: "stun",
      isSpecial: true,
      chargeTurns: 1,
    });
    await linkMonsterMoveset(sql, monsterId, clawId);
    await linkMonsterMoveset(sql, monsterId, stunId);

    const battle = Battle.create({
      id: Bun.randomUUIDv7(),
      playerId,
      monsterId,
      playerCurrentHp: 500,
      playerCurrentStamina: 10,
      monsterCurrentHp: 1000,
      monsterCurrentStamina: 25,
      round: 1,
      playerEffects: [],
      monsterEffects: [],
      monsterChargingAttackId: null,
      chargeRoundsLeft: 0,
      monsterAttackWeights: {},
      stunCooldownRoundsLeft: 0,
    });

    // Attack selection is deterministic (no rng), so every queued value
    // below is either a charge-warning flavor pick or an effect-proc roll:
    // turn1 charges Stun Test (affordable, always preferred) -> flavor(0).
    // turn2 unleashes it unconditionally (no rng) and starts the Stun
    // cooldown (test default 5 rounds, buildUseCases.ts). turns 3-5: Stun
    // Test would still be affordable stamina-wise, but is excluded from
    // selection entirely while the cooldown is active — Stun must never
    // chain — so Claw is the only option each time -> proc roll (50,
    // doesn't matter which way it lands) each turn.
    const uc = buildUseCases(sql, new FakeRng([0, 50, 50, 50]));
    await uc.battleRepository.create(battle);

    await uc.attackUseCase.execute({ playerId, attackName: "HIT" }); // turn1: charge
    await uc.attackUseCase.execute({ playerId, attackName: "HIT" }); // turn2: unleash Stun

    const afterUnleash = await uc.battleRepository.findByPlayerId(playerId);
    expect(afterUnleash?.playerEffects.some((e) => e.type === "stun")).toBe(true);
    expect(afterUnleash?.stunCooldownRoundsLeft).toBeGreaterThan(0);

    const turn3 = await uc.attackUseCase.execute({ playerId, attackName: "HIT" });
    expect(turn3.playerAttack).toBeNull();
    expect(turn3.monsterAttack?.attackName).toBe("Claw");
    expect(turn3.messages).toContain("You are stunned and cannot act!");

    const turn4 = await uc.attackUseCase.execute({ playerId, attackName: "HIT" });
    expect(turn4.playerAttack).toBeNull();
    expect(turn4.monsterAttack?.attackName).toBe("Claw");

    const afterStun = await uc.battleRepository.findByPlayerId(playerId);
    expect(afterStun?.playerEffects.some((e) => e.type === "stun")).toBe(false);

    const turn5 = await uc.attackUseCase.execute({ playerId, attackName: "HIT" });
    expect(turn5.playerAttack).not.toBeNull();
  });

  it("an active Fear debuff halves the player's effective Force, reducing damage output", async () => {
    const userId = await createTestUser(sql);
    const playerId = await createTestPlayer(sql, userId, { force: 20 });
    const monsterId = await createTestMonster(sql, { hp: 1000, force: 1 });
    const attackId = await createTestMonsterAttack(sql, {
      name: "Basic Strike",
      staminaCost: 0,
      multiplier: 0.4,
      scalingAttribute: "force",
    });
    await linkMonsterMoveset(sql, monsterId, attackId);

    const battle = Battle.create({
      id: Bun.randomUUIDv7(),
      playerId,
      monsterId,
      playerCurrentHp: 500,
      playerCurrentStamina: 10,
      monsterCurrentHp: 1000,
      monsterCurrentStamina: 10,
      round: 1,
      playerEffects: [{ type: "debuff", kind: "fear", stat: "force", roundsElapsed: 0 }],
      monsterEffects: [],
      monsterChargingAttackId: null,
      chargeRoundsLeft: 0,
      monsterAttackWeights: {},
      stunCooldownRoundsLeft: 0,
    });

    const uc = buildUseCases(sql, new FakeRng([0, 50]));
    await uc.battleRepository.create(battle);

    const result = await uc.attackUseCase.execute({ playerId, attackName: "HIT" });

    const expectedDamage = computeDamage({
      attackMultiplier: 0.4,
      attackerScalingValue: 10, // 20 halved by the active Fear debuff
      staminaCost: 1, // seeded HIT costs 1
      defenderLevel: 1,
      defenderScalingValue: 1,
    });

    expect(result.playerAttack?.damage).toBe(expectedDamage);
  });

  it("an active Magic Aura Blast debuff reduces the player's effective Intelligence", async () => {
    const userId = await createTestUser(sql);
    const playerId = await createTestPlayer(sql, userId, { intelligence: 20 });
    const monsterId = await createTestMonster(sql, { hp: 1000, force: 1 });
    const attackId = await createTestMonsterAttack(sql, {
      name: "Basic Strike 2",
      staminaCost: 0,
      multiplier: 0.4,
      scalingAttribute: "force",
    });
    await linkMonsterMoveset(sql, monsterId, attackId);
    await createTestPlayerAttack(sql, {
      name: "Test Magic Bolt",
      staminaCost: 1,
      multiplier: 0.5,
      scalingAttribute: "intelligence",
    });

    const battle = Battle.create({
      id: Bun.randomUUIDv7(),
      playerId,
      monsterId,
      playerCurrentHp: 500,
      playerCurrentStamina: 10,
      monsterCurrentHp: 1000,
      monsterCurrentStamina: 10,
      round: 1,
      playerEffects: [
        { type: "debuff", kind: "magic_aura_blast", stat: "intelligence", roundsElapsed: 3 },
      ],
      monsterEffects: [],
      monsterChargingAttackId: null,
      chargeRoundsLeft: 0,
      monsterAttackWeights: {},
      stunCooldownRoundsLeft: 0,
    });

    const uc = buildUseCases(sql, new FakeRng([0, 50]));
    await uc.battleRepository.create(battle);

    const result = await uc.attackUseCase.execute({ playerId, attackName: "Test Magic Bolt" });

    const expectedDamage = computeDamage({
      attackMultiplier: 0.5,
      attackerScalingValue: 14, // 20 * (1 - 0.3) = 14 at roundsElapsed 3 (30%)
      staminaCost: 1,
      defenderLevel: 1,
      defenderScalingValue: 1,
    });

    expect(result.playerAttack?.damage).toBe(expectedDamage);
  });
});
