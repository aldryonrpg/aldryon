import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { SQL } from "bun";
import { buildUseCases } from "../support/buildUseCases";
import { FakeRng } from "../support/FakeRng";
import { getSharedPostgresEnvironment } from "../support/sharedPostgresEnvironment";
import {
  createTestItem,
  createTestPlayer,
  createTestPlayerItem,
  createTestUser,
  setPlayerDungeonRun,
} from "../support/testFixtures";

/**
 * The boss's awakening Growl (loot-system follow-up) — always fires on
 * reveal (no longer a 50/50 gate), breaking 0-50% of the player's
 * remaining POTs (rounded up, smallest stack first), leaving bandages/
 * antidotes/equipped gear untouched. Exercised via ContinueDungeonUseCase
 * with a player already at their last dungeon step (tier 1 = 1 step total),
 * so the very next Continue reveals the boss. The materialized boss always
 * has ambush_chance 0, so the only real rng call here is the Growl's own
 * break-percent roll.
 */
describe("The Growl (integration)", () => {
  let sql: SQL;

  beforeAll(async () => {
    const env = await getSharedPostgresEnvironment();
    sql = new SQL(env.connectionUri);
  }, 120_000);

  afterAll(async () => {
    await sql.close();
  });

  it("always narrates on boss reveal and breaks POTs at a high roll, leaving bandages/gear untouched", async () => {
    const userId = await createTestUser(sql);
    const playerId = await createTestPlayer(sql, userId, { level: 12 });
    await setPlayerDungeonRun(sql, playerId, 1, 1, 1);

    const potId = await createTestItem(sql, { name: "Growl Test Potion", hpRestore: 50 });
    const potPlayerItemId = await createTestPlayerItem(sql, playerId, potId, { quantity: 4 });
    const bandageId = await createTestItem(sql, { name: "Growl Test Bandage" });
    const bandagePlayerItemId = await createTestPlayerItem(sql, playerId, bandageId);
    const helmetId = await createTestItem(sql, { name: "Growl Test Helmet", slot: "helmet" });
    const helmetPlayerItemId = await createTestPlayerItem(sql, playerId, helmetId, {
      equippedSlot: "helmet",
    });

    // roll1=1 (ambush check <= 0 always fails regardless), roll2=50 (break percent).
    const uc = buildUseCases(sql, new FakeRng([1, 50]));

    const result = await uc.continueDungeonUseCase.execute({ playerId });

    expect(result.outcome).toBe("ongoing");
    expect(result.message).toContain("Growl");

    const potAfter = await uc.playerItemRepository.findById(potPlayerItemId);
    // total=4, 50% -> ceil(2) = 2 broken, leaving quantity 2.
    expect(potAfter?.quantity).toBe(2);
    expect(await uc.playerItemRepository.findById(bandagePlayerItemId)).not.toBeNull();
    expect(await uc.playerItemRepository.findById(helmetPlayerItemId)).not.toBeNull();
  });

  it("breaks nothing at a 0% roll, but still narrates the reveal", async () => {
    const userId = await createTestUser(sql);
    const playerId = await createTestPlayer(sql, userId, { level: 12 });
    await setPlayerDungeonRun(sql, playerId, 1, 1, 1);

    const potId = await createTestItem(sql, { name: "Growl Test Potion 2", hpRestore: 50 });
    const potPlayerItemId = await createTestPlayerItem(sql, playerId, potId, { quantity: 2 });

    const uc = buildUseCases(sql, new FakeRng([1, 0]));

    const result = await uc.continueDungeonUseCase.execute({ playerId });

    expect(result.outcome).toBe("ongoing");
    expect(result.message).toContain("Growl");
    expect((await uc.playerItemRepository.findById(potPlayerItemId))?.quantity).toBe(2);
  });
});
