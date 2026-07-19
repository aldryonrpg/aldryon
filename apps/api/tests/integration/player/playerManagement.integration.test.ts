import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { AllocateAttributePointsRequestSchema } from "@aldryon/dtos";
import { SQL } from "bun";
import {
  InsufficientAttributePointsError,
  ItemNotEquippableError,
  PlayerNameTakenError,
} from "@/usecase/player/errors";
import { buildUseCases } from "../support/buildUseCases";
import { expectRejection } from "../support/expectRejection";
import { FakeRng } from "../support/FakeRng";
import { getSharedPostgresEnvironment } from "../support/sharedPostgresEnvironment";
import {
  createTestItem,
  createTestPlayer,
  createTestPlayerItem,
  createTestUser,
} from "../support/testFixtures";

describe("Player management use cases (integration)", () => {
  let sql: SQL;

  beforeAll(async () => {
    const env = await getSharedPostgresEnvironment();
    sql = new SQL(env.connectionUri);
  }, 120_000);

  afterAll(async () => {
    await sql.close();
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

      await expectRejection(
        uc.updatePlayerNameUseCase.execute({ playerId, playerName: "no" }),
        Error,
      );
    });

    it("rejects a name already taken by another player, case-insensitively", async () => {
      const uc = buildUseCases(sql, new FakeRng([1]));

      const firstUserId = await createTestUser(sql);
      const firstPlayerId = await createTestPlayer(sql, firstUserId);
      await uc.updatePlayerNameUseCase.execute({
        playerId: firstPlayerId,
        playerName: "TakenNameHero",
      });

      const secondUserId = await createTestUser(sql);
      const secondPlayerId = await createTestPlayer(sql, secondUserId);

      await expectRejection(
        uc.updatePlayerNameUseCase.execute({
          playerId: secondPlayerId,
          playerName: "takennamehero",
        }),
        PlayerNameTakenError,
      );
    });

    it("allows a player to re-save their own current name", async () => {
      const userId = await createTestUser(sql);
      const playerId = await createTestPlayer(sql, userId);
      const uc = buildUseCases(sql, new FakeRng([1]));
      await uc.updatePlayerNameUseCase.execute({ playerId, playerName: "SameNameHero" });

      const result = await uc.updatePlayerNameUseCase.execute({
        playerId,
        playerName: "SameNameHero",
      });

      expect(result.playerName).toBe("SameNameHero");
    });

    it("frees a name immediately so another player can claim it after a rename", async () => {
      const uc = buildUseCases(sql, new FakeRng([1]));

      const firstUserId = await createTestUser(sql);
      const firstPlayerId = await createTestPlayer(sql, firstUserId);
      await uc.updatePlayerNameUseCase.execute({ playerId: firstPlayerId, playerName: "OldName1" });
      await uc.updatePlayerNameUseCase.execute({ playerId: firstPlayerId, playerName: "NewName1" });

      const secondUserId = await createTestUser(sql);
      const secondPlayerId = await createTestPlayer(sql, secondUserId);

      const result = await uc.updatePlayerNameUseCase.execute({
        playerId: secondPlayerId,
        playerName: "OldName1",
      });

      expect(result.playerName).toBe("OldName1");
    });
  });

  describe("AllocateAttributePointsRequestSchema", () => {
    it("accepts a partial allocations object naming only some of the 6 attributes", () => {
      // Regression: z.record with an enum key schema requires every enum key
      // to be present in Zod 4, which rejected the real client's partial
      // {strength: 1} payloads with "Malformed allocation request" — fixed
      // by switching to z.partialRecord.
      const result = AllocateAttributePointsRequestSchema.safeParse({
        allocations: { strength: 1 },
      });
      expect(result.success).toBe(true);
    });

    it("rejects a key that isn't a real attribute", () => {
      const result = AllocateAttributePointsRequestSchema.safeParse({
        allocations: { notAnAttribute: 1 },
      });
      expect(result.success).toBe(false);
    });
  });

  describe("AllocateAttributePointsUseCase", () => {
    it("spends points and increments base attributes", async () => {
      const userId = await createTestUser(sql);
      const playerId = await createTestPlayer(sql, userId, { attributePoints: 10, strength: 5 });
      const uc = buildUseCases(sql, new FakeRng([1]));

      const result = await uc.allocateAttributePointsUseCase.execute({
        playerId,
        allocations: { strength: 3, luck: 2 },
      });

      expect(result.attributes.strength).toBe(8);
      expect(result.attributes.luck).toBe(3);
      expect(result.attributePoints).toBe(5);
    });

    it("rejects an allocation that overspends the available points", async () => {
      const userId = await createTestUser(sql);
      const playerId = await createTestPlayer(sql, userId, { attributePoints: 2 });
      const uc = buildUseCases(sql, new FakeRng([1]));

      await expectRejection(
        uc.allocateAttributePointsUseCase.execute({ playerId, allocations: { strength: 3 } }),
        InsufficientAttributePointsError,
      );
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

      await expectRejection(
        uc.equipItemUseCase.execute({ playerId, playerItemId: greatswordPlayerItemId }),
        ItemNotEquippableError,
      );
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

      await expectRejection(
        uc.equipItemUseCase.execute({ playerId, playerItemId: daggerPlayerItemId }),
        ItemNotEquippableError,
      );
    });

    it("equips a bracelet/ring into its own dedicated slot (plan3 §3)", async () => {
      const userId = await createTestUser(sql);
      const playerId = await createTestPlayer(sql, userId);
      const ringId = await createTestItem(sql, { name: "Ruby Ring", slot: "bracelet" });
      const playerItemId = await createTestPlayerItem(sql, playerId, ringId);
      const uc = buildUseCases(sql, new FakeRng([1]));

      const result = await uc.equipItemUseCase.execute({ playerId, playerItemId });

      expect(result.playerItem.equippedSlot).toBe("bracelet");
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
