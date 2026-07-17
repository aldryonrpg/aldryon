import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { SQL } from "bun";
import { Battle } from "@/domain/battle/Battle";
import { maxHp } from "@/domain/battle/battleConfig";
import { ATTRIBUTE_KEYS } from "@/domain/shared/Attributes";
import { buildUseCases } from "../support/buildUseCases";
import { FakeRng } from "../support/FakeRng";
import { getSharedPostgresEnvironment } from "../support/sharedPostgresEnvironment";
import {
  createTestItem,
  createTestMonster,
  createTestMonsterAttack,
  createTestPlayer,
  createTestPlayerAttack,
  createTestPlayerItem,
  createTestUser,
  linkMonsterMoveset,
} from "../support/testFixtures";

/**
 * Monster attributes are hidden ("??") until revealed — REVEAL SPELL reveals
 * one random not-yet-known attribute per successful cast; Knowledge Potion
 * reveals all six at once. The server never sends a hidden attribute's
 * value at all (checked here via the raw response shape, not just what the
 * UI happens to render).
 */
describe("Monster attribute reveal (integration)", () => {
  let sql: SQL;

  beforeAll(async () => {
    const env = await getSharedPostgresEnvironment();
    sql = new SQL(env.connectionUri);
  }, 120_000);

  afterAll(async () => {
    await sql.close();
  });

  async function setupBasicBattle() {
    const userId = await createTestUser(sql);
    const playerId = await createTestPlayer(sql, userId, { intelligence: 30, strength: 10 });
    const monsterId = await createTestMonster(sql, { hp: 1000, strength: 5 });
    const monsterAttackId = await createTestMonsterAttack(sql, { staminaCost: 0, multiplier: 0 });
    await linkMonsterMoveset(sql, monsterId, monsterAttackId);

    const playerMaxHp = maxHp(1, 10);
    const battle = Battle.create({
      id: Bun.randomUUIDv7(),
      playerId,
      monsterId,
      playerCurrentHp: playerMaxHp,
      playerCurrentStamina: 50,
      monsterCurrentHp: 1000,
      monsterCurrentStamina: 200,
      round: 1,
      playerEffects: [],
      monsterEffects: [],
      monsterChargingAttackId: null,
      chargeRoundsLeft: 0,
      monsterAttackWeights: {},
      statusCooldownRoundsLeft: 0,
      dungeonTier: null,
      dungeonIsBossFight: false,
      revealedMonsterAttributes: [],
    });

    return { playerId, monsterId, battle };
  }

  it("GetActiveBattleUseCase never sends any monster attribute before it's revealed", async () => {
    const { playerId, battle } = await setupBasicBattle();
    const uc = buildUseCases(sql, new FakeRng([1]));
    await uc.battleRepository.create(battle);

    const result = await uc.getActiveBattleUseCase.execute({ playerId });

    expect(result?.monster.attributes).toEqual({});
    expect(result?.monsterStatus).not.toHaveProperty("currentStamina");
  });

  it("REVEAL SPELL reveals exactly one attribute on a successful hit", async () => {
    const { playerId, monsterId, battle } = await setupBasicBattle();
    await createTestPlayerAttack(sql, {
      name: "Test Reveal Spell 1",
      staminaCost: 10,
      multiplier: 0,
      scalingAttribute: "intelligence",
      reqIntelligence: 30,
      revealsRandomMonsterAttribute: true,
    });
    const uc = buildUseCases(sql, new FakeRng([1]));
    await uc.battleRepository.create(battle);

    const result = await uc.attackUseCase.execute({ playerId, attackName: "Test Reveal Spell 1" });

    expect(result.outcome).toBe("ongoing");
    expect(Object.keys(result.monsterAttributes)).toHaveLength(1);
    expect(result.messages.some((m) => m.includes("glimpse"))).toBe(true);

    const monster = await uc.monsterRepository.findById(monsterId);
    const revealedKey = Object.keys(
      result.monsterAttributes,
    )[0] as keyof typeof result.monsterAttributes;
    expect(result.monsterAttributes[revealedKey]).toBe(monster?.getAttributes().get(revealedKey));
  });

  it("REVEAL SPELL says so once every attribute is already known", async () => {
    const { playerId, battle } = await setupBasicBattle();
    await createTestPlayerAttack(sql, {
      name: "Test Reveal Spell 2",
      staminaCost: 10,
      multiplier: 0,
      scalingAttribute: "intelligence",
      reqIntelligence: 30,
      revealsRandomMonsterAttribute: true,
    });
    const uc = buildUseCases(sql, new FakeRng([1]));
    await uc.battleRepository.create(
      Battle.create({ ...battle.toProps(), revealedMonsterAttributes: [...ATTRIBUTE_KEYS] }),
    );

    const result = await uc.attackUseCase.execute({ playerId, attackName: "Test Reveal Spell 2" });

    expect(Object.keys(result.monsterAttributes)).toHaveLength(6);
    expect(result.messages).toContain("You already know everything about this monster.");
  });

  it("Knowledge Potion reveals all six attributes at once", async () => {
    const { playerId, monsterId, battle } = await setupBasicBattle();
    const potionId = await createTestItem(sql, {
      name: "Test Knowledge Potion",
      revealsAllMonsterAttributes: true,
    });
    const playerItemId = await createTestPlayerItem(sql, playerId, potionId);
    const uc = buildUseCases(sql, new FakeRng([1]));
    await uc.battleRepository.create(battle);

    const result = await uc.useBagItemUseCase.execute({ playerId, playerItemId });

    expect(result.outcome).toBe("ongoing");
    expect(Object.keys(result.monsterAttributes)).toHaveLength(6);
    const monster = await uc.monsterRepository.findById(monsterId);
    if (!monster) throw new Error("Monster not found");
    expect(result.monsterAttributes).toEqual(monster.getAttributes().toValues());
    expect(result.messages.some((m) => m.includes("Knowledge Potion"))).toBe(true);

    expect(await uc.playerItemRepository.findById(playerItemId)).toBeNull();
  });
});
