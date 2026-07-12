import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { SQL } from "bun";
import { InsufficientAttributePointsError, ItemNotEquippableError } from "@/usecase/player/errors";
import { buildUseCases } from "../support/buildUseCases";
import { FakeRng } from "../support/FakeRng";
import { type PostgresEnvironment, startPostgresEnvironment } from "../support/postgresEnvironment";
import {
  createTestItem,
  createTestPlayer,
  createTestPlayerItem,
  createTestUser,
} from "../support/testFixtures";

describe("Player management use cases (integration)", () => {
  let env: PostgresEnvironment;
  let sql: SQL;

  beforeAll(async () => {
    env = await startPostgresEnvironment();
    sql = new SQL(env.connectionUri);
  }, 120_000);

  afterAll(async () => {
    await sql.close();
    await env.stop();
  });

  describe("GetOrCreatePlayerUseCase", () => {
    it("creates a player on first entry and reuses it on repeat calls", async () => {
      const userId = await createTestUser(sql);
      const uc = buildUseCases(sql, new FakeRng([1]));

      const first = await uc.getOrCreatePlayerUseCase.execute({ userId });
      const second = await uc.getOrCreatePlayerUseCase.execute({ userId });

      expect(first.player.id).toBe(second.player.id);
      expect(first.player.attributePoints).toBe(10);
      expect(first.player.playerName).toBeNull();
    });
  });

  describe("UpdatePlayerNameUseCase", () => {
    it("sets the player's on-screen name", async () => {
      const userId = await createTestUser(sql);
      const playerId = await createTestPlayer(sql, userId);
      const uc = buildUseCases(sql, new FakeRng([1]));

      const result = await uc.updatePlayerNameUseCase.execute({
        playerId,
        playerName: "DragonSlayer99",
      });

      expect(result.playerName).toBe("DragonSlayer99");
      const player = await uc.playerRepository.findById(playerId);
      expect(player?.playerName).toBe("DragonSlayer99");
    });

    it("rejects a name that fails the 5-40 alphanumeric constraint", async () => {
      const userId = await createTestUser(sql);
      const playerId = await createTestPlayer(sql, userId);
      const uc = buildUseCases(sql, new FakeRng([1]));

      await expect(
        uc.updatePlayerNameUseCase.execute({ playerId, playerName: "no" }),
      ).rejects.toThrow();
    });
  });

  describe("AllocateAttributePointsUseCase", () => {
    it("spends points and increments base attributes", async () => {
      const userId = await createTestUser(sql);
      const playerId = await createTestPlayer(sql, userId, { attributePoints: 10, force: 5 });
      const uc = buildUseCases(sql, new FakeRng([1]));

      const result = await uc.allocateAttributePointsUseCase.execute({
        playerId,
        allocations: { force: 3, luck: 2 },
      });

      expect(result.attributes.force).toBe(8);
      expect(result.attributes.luck).toBe(3);
      expect(result.attributePoints).toBe(5);
    });

    it("rejects an allocation that overspends the available points", async () => {
      const userId = await createTestUser(sql);
      const playerId = await createTestPlayer(sql, userId, { attributePoints: 2 });
      const uc = buildUseCases(sql, new FakeRng([1]));

      await expect(
        uc.allocateAttributePointsUseCase.execute({ playerId, allocations: { force: 3 } }),
      ).rejects.toBeInstanceOf(InsufficientAttributePointsError);
    });
  });

  describe("EquipItemUseCase / UnequipItemUseCase", () => {
    it("equips gear into its direct slot", async () => {
      const userId = await createTestUser(sql);
      const playerId = await createTestPlayer(sql, userId);
      const helmetId = await createTestItem(sql, { name: "Iron Helm", slot: "helmet" });
      const playerItemId = await createTestPlayerItem(sql, playerId, helmetId);
      const uc = buildUseCases(sql, new FakeRng([1]));

      const result = await uc.equipItemUseCase.execute({ playerId, playerItemId });

      expect(result.playerItem.equippedSlot).toBe("helmet");
    });

    it("enforces the two-handed weapon rule: requires both hands empty", async () => {
      const userId = await createTestUser(sql);
      const playerId = await createTestPlayer(sql, userId);
      const daggerId = await createTestItem(sql, { name: "Dagger", slot: "weapon" });
      const daggerPlayerItemId = await createTestPlayerItem(sql, playerId, daggerId);
      const uc = buildUseCases(sql, new FakeRng([1]));
      await uc.equipItemUseCase.execute({ playerId, playerItemId: daggerPlayerItemId });

      const greatswordId = await createTestItem(sql, {
        name: "Greatsword",
        slot: "two_handed_weapon",
      });
      const greatswordPlayerItemId = await createTestPlayerItem(sql, playerId, greatswordId);

      await expect(
        uc.equipItemUseCase.execute({ playerId, playerItemId: greatswordPlayerItemId }),
      ).rejects.toBeInstanceOf(ItemNotEquippableError);
    });

    it("equipping a two-handed weapon occupies weapon_1 and blocks weapon_2", async () => {
      const userId = await createTestUser(sql);
      const playerId = await createTestPlayer(sql, userId);
      const greatswordId = await createTestItem(sql, {
        name: "Greatsword 2",
        slot: "two_handed_weapon",
      });
      const greatswordPlayerItemId = await createTestPlayerItem(sql, playerId, greatswordId);
      const uc = buildUseCases(sql, new FakeRng([1]));

      const result = await uc.equipItemUseCase.execute({
        playerId,
        playerItemId: greatswordPlayerItemId,
      });
      expect(result.playerItem.equippedSlot).toBe("weapon_1");

      const daggerId = await createTestItem(sql, { name: "Off-hand Dagger", slot: "weapon" });
      const daggerPlayerItemId = await createTestPlayerItem(sql, playerId, daggerId);

      await expect(
        uc.equipItemUseCase.execute({ playerId, playerItemId: daggerPlayerItemId }),
      ).rejects.toBeInstanceOf(ItemNotEquippableError);
    });

    it("unequips an item back to the bag", async () => {
      const userId = await createTestUser(sql);
      const playerId = await createTestPlayer(sql, userId);
      const bootsId = await createTestItem(sql, { name: "Leather Boots", slot: "boots" });
      const playerItemId = await createTestPlayerItem(sql, playerId, bootsId);
      const uc = buildUseCases(sql, new FakeRng([1]));
      await uc.equipItemUseCase.execute({ playerId, playerItemId });

      const result = await uc.unequipItemUseCase.execute({ playerId, playerItemId });

      expect(result.playerItem.equippedSlot).toBeNull();
    });
  });
});
