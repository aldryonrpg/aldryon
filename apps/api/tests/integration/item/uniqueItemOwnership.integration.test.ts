import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { SQL } from "bun";
import { PostgresUniqueItemOwnershipRepository } from "@/infrastructure/persistence/PostgresUniqueItemOwnershipRepository";
import { getSharedPostgresEnvironment } from "../support/sharedPostgresEnvironment";
import { createTestItem, createTestPlayer, createTestUser } from "../support/testFixtures";

describe("PostgresUniqueItemOwnershipRepository (integration)", () => {
  let sql: SQL;
  let repo: PostgresUniqueItemOwnershipRepository;

  beforeAll(async () => {
    const env = await getSharedPostgresEnvironment();
    sql = new SQL(env.connectionUri);
    repo = new PostgresUniqueItemOwnershipRepository(sql);
  }, 120_000);

  afterAll(async () => {
    await sql.close();
  });

  it("claims a never-before-owned item, then rejects a second concurrent claim", async () => {
    const itemId = await createTestItem(sql, { name: "Unique Test Sword 1", rarity: "unique" });
    const userId1 = await createTestUser(sql);
    const playerId1 = await createTestPlayer(sql, userId1);
    const userId2 = await createTestUser(sql);
    const playerId2 = await createTestPlayer(sql, userId2);

    const firstClaim = await repo.tryClaim(itemId, playerId1, new Date());
    const secondClaim = await repo.tryClaim(itemId, playerId2, new Date());

    expect(firstClaim).toBe(true);
    expect(secondClaim).toBe(false);

    const ownership = await repo.findByItemId(itemId);
    expect(ownership?.currentOwnerPlayerId).toBe(playerId1);
  });

  it("release clears ownership, appending the outgoing owner to history, and allows a new claim", async () => {
    const itemId = await createTestItem(sql, { name: "Unique Test Sword 2", rarity: "unique" });
    const userId1 = await createTestUser(sql);
    const playerId1 = await createTestPlayer(sql, userId1);
    const userId2 = await createTestUser(sql);
    const playerId2 = await createTestPlayer(sql, userId2);

    await repo.tryClaim(itemId, playerId1, new Date());
    await repo.release(itemId, playerId1, new Date());

    const afterRelease = await repo.findByItemId(itemId);
    expect(afterRelease?.currentOwnerPlayerId).toBeNull();
    expect(afterRelease?.ownerHistory).toEqual([
      { playerId: playerId1, timestampOfLastOwnership: expect.any(String) },
    ]);

    const reclaimed = await repo.tryClaim(itemId, playerId2, new Date());
    expect(reclaimed).toBe(true);
  });

  it("release is a no-op when playerId isn't the current owner", async () => {
    const itemId = await createTestItem(sql, { name: "Unique Test Sword 3", rarity: "unique" });
    const userId1 = await createTestUser(sql);
    const playerId1 = await createTestPlayer(sql, userId1);
    const userId2 = await createTestUser(sql);
    const playerId2 = await createTestPlayer(sql, userId2);

    await repo.tryClaim(itemId, playerId1, new Date());
    await repo.release(itemId, playerId2, new Date());

    const ownership = await repo.findByItemId(itemId);
    expect(ownership?.currentOwnerPlayerId).toBe(playerId1);
  });

  it("bounds owner history to the last 5 entries", async () => {
    const itemId = await createTestItem(sql, { name: "Unique Test Sword 4", rarity: "unique" });
    const playerIds: string[] = [];
    for (let i = 0; i < 6; i++) {
      const userId = await createTestUser(sql);
      const playerId = await createTestPlayer(sql, userId);
      playerIds.push(playerId);
      await repo.tryClaim(itemId, playerId, new Date());
      await repo.release(itemId, playerId, new Date());
    }

    const ownership = await repo.findByItemId(itemId);
    expect(ownership?.ownerHistory).toHaveLength(5);
    expect(ownership?.ownerHistory.map((e) => e.playerId)).toEqual(playerIds.slice(1));
  });
});
