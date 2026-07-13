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
  createTestPlayerItem,
  createTestUser,
  linkMonsterMoveset,
} from "../support/testFixtures";

/** The boss's awakening Growl (plan3 §2e) — a 50/50 roll on the gatekeeper's
 * death that, on success, destroys every POT stack in the player's bag. */
describe("The Growl (integration)", () => {
  let sql: SQL;

  beforeAll(async () => {
    const env = await getSharedPostgresEnvironment();
    sql = new SQL(env.connectionUri);
  }, 120_000);

  afterAll(async () => {
    await sql.close();
  });

  async function setupDungeonBattle(playerId: string, gatekeeperId: string, bossId: string) {
    const playerMaxHp = maxHp(1, 1);
    return Battle.create({
      id: Bun.randomUUIDv7(),
      playerId,
      monsterId: gatekeeperId,
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
      dungeonBossMonsterId: bossId,
      dungeonTier: 1,
    });
  }

  it("on success, destroys every POT stack but leaves bandages/antidotes/equipped gear untouched", async () => {
    const userId = await createTestUser(sql);
    const playerId = await createTestPlayer(sql, userId);
    const gatekeeperId = await createTestMonster(sql, { hp: 1 });
    const gatekeeperAttackId = await createTestMonsterAttack(sql, {
      staminaCost: 0,
      multiplier: 0.4,
    });
    await linkMonsterMoveset(sql, gatekeeperId, gatekeeperAttackId);
    const bossId = await createTestMonster(sql, { hp: 500, maxStamina: 60 });

    const potId = await createTestItem(sql, { name: "Growl Test Potion", hpRestore: 50 });
    const potPlayerItemId = await createTestPlayerItem(sql, playerId, potId, { quantity: 3 });
    const bandageId = await createTestItem(sql, { name: "Growl Test Bandage" });
    const bandagePlayerItemId = await createTestPlayerItem(sql, playerId, bandageId);
    const helmetId = await createTestItem(sql, { name: "Growl Test Helmet", slot: "helmet" });
    const helmetPlayerItemId = await createTestPlayerItem(sql, playerId, helmetId, {
      equippedSlot: "helmet",
    });

    const battle = await setupDungeonBattle(playerId, gatekeeperId, bossId);
    // No drop pools set (0 calls) -> the only rng call is the growl roll itself.
    const uc = buildUseCases(sql, new FakeRng([1])); // 1 <= 50 -> growl succeeds
    await uc.battleRepository.create(battle);

    const result = await uc.attackUseCase.execute({ playerId, attackName: "HIT" });

    expect(result.outcome).toBe("ongoing");
    expect(result.monsterAttack).toEqual({
      attackName: "Growl",
      hit: true,
      damage: 0,
      effectApplied: null,
    });

    expect(await uc.playerItemRepository.findById(potPlayerItemId)).toBeNull();
    expect(await uc.playerItemRepository.findById(bandagePlayerItemId)).not.toBeNull();
    expect(await uc.playerItemRepository.findById(helmetPlayerItemId)).not.toBeNull();
  });

  it("on failure, leaves the bag completely untouched", async () => {
    const userId = await createTestUser(sql);
    const playerId = await createTestPlayer(sql, userId);
    const gatekeeperId = await createTestMonster(sql, { hp: 1 });
    const gatekeeperAttackId = await createTestMonsterAttack(sql, {
      staminaCost: 0,
      multiplier: 0.4,
    });
    await linkMonsterMoveset(sql, gatekeeperId, gatekeeperAttackId);
    const bossId = await createTestMonster(sql, { hp: 500, maxStamina: 60 });

    const potId = await createTestItem(sql, { name: "Growl Test Potion 2", hpRestore: 50 });
    const potPlayerItemId = await createTestPlayerItem(sql, playerId, potId, { quantity: 2 });

    const battle = await setupDungeonBattle(playerId, gatekeeperId, bossId);
    const uc = buildUseCases(sql, new FakeRng([100])); // 100 <= 50 is false -> growl fails
    await uc.battleRepository.create(battle);

    const result = await uc.attackUseCase.execute({ playerId, attackName: "HIT" });

    expect(result.outcome).toBe("ongoing");
    expect(result.monsterAttack).toBeNull();
    expect(await uc.playerItemRepository.findById(potPlayerItemId)).not.toBeNull();
  });
});
