import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { SQL } from "bun";
import { PostgresAuthIdentityResolver } from "@/infrastructure/persistence/PostgresAuthIdentityResolver";
import { AuthIdentityCache } from "@/usecase/auth/AuthIdentityCache";
import { getSharedPostgresEnvironment } from "../support/sharedPostgresEnvironment";
import { createTestPlayer, createTestUser } from "../support/testFixtures";

describe("PostgresAuthIdentityResolver / AuthIdentityCache (integration)", () => {
  let sql: SQL;
  let resolver: PostgresAuthIdentityResolver;

  beforeAll(async () => {
    const env = await getSharedPostgresEnvironment();
    sql = new SQL(env.connectionUri);
    resolver = new PostgresAuthIdentityResolver(sql);
  }, 120_000);

  afterAll(async () => {
    await sql.close();
  });

  describe("PostgresAuthIdentityResolver", () => {
    it("returns null for an identity with no user at all", async () => {
      const result = await resolver.resolve("no-such-identity");
      expect(result).toBeNull();
    });

    it("returns null when the user exists but has no player yet (first-ever login)", async () => {
      const userId = await createTestUser(sql);

      const result = await resolver.resolve(`test-auth-${userId}`);

      expect(result).toBeNull();
    });

    it("resolves playerId and isVip in one query once both rows exist", async () => {
      const userId = await createTestUser(sql, { isVip: true });
      const playerId = await createTestPlayer(sql, userId);

      const result = await resolver.resolve(`test-auth-${userId}`);

      expect(result).toEqual({ playerId, isVip: true });
    });
  });

  describe("AuthIdentityCache", () => {
    it("caches a resolved identity so a later DB change isn't reflected until the TTL expires", async () => {
      const userId = await createTestUser(sql, { isVip: false });
      const playerId = await createTestPlayer(sql, userId);
      const externalAuthId = `test-auth-${userId}`;
      const cache = new AuthIdentityCache(resolver);

      const first = await cache.resolve(externalAuthId);
      expect(first).toEqual({ playerId, isVip: false });

      // Deleting the player row would make a fresh resolver.resolve() call
      // return null — the cache still returning the original value proves
      // this second call never touched the DB.
      await sql`delete from players where id = ${playerId}`;
      const second = await cache.resolve(externalAuthId);

      expect(second).toEqual({ playerId, isVip: false });
    });

    it("falls through to the resolver for an identity it hasn't cached yet", async () => {
      const userId = await createTestUser(sql, { isVip: true });
      const playerId = await createTestPlayer(sql, userId);
      const cache = new AuthIdentityCache(resolver);

      const result = await cache.resolve(`test-auth-${userId}`);

      expect(result).toEqual({ playerId, isVip: true });
    });
  });
});
