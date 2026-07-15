import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { SQL } from "bun";
import {
  BagFullError,
  InsufficientGoldError,
  ItemNotPurchasableError,
} from "@/usecase/store/errors";
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

describe("Store (integration)", () => {
  let sql: SQL;

  beforeAll(async () => {
    const env = await getSharedPostgresEnvironment();
    sql = new SQL(env.connectionUri);
  }, 120_000);

  afterAll(async () => {
    await sql.close();
  });

  describe("ListStoreItemsUseCase", () => {
    it("lists the seeded small pot with its catalog value as the price", async () => {
      const uc = buildUseCases(sql, new FakeRng([1]));
      const listing = await uc.listStoreItemsUseCase.execute();

      const smallPot = listing.find((entry) => entry.name === "small pot");
      expect(smallPot).toEqual({
        id: expect.any(String),
        name: "small pot",
        description: expect.any(String),
        price: 25,
        slot: null,
        rarity: "common",
        rarityColor: "gray",
        hpRestore: 50,
        category: "consumable",
      });
    });

    it("lists Basic Helmet as gear, not consumable", async () => {
      const uc = buildUseCases(sql, new FakeRng([1]));
      const listing = await uc.listStoreItemsUseCase.execute();

      const helmet = listing.find((entry) => entry.name === "Basic Helmet");
      expect(helmet?.category).toBe("gear");
      expect(helmet?.rarity).toBe("basic");
      expect(helmet?.rarityColor).toBe("white");
    });

    it("excludes rare and legendary items", async () => {
      const rareId = await createTestItem(sql, { name: "Store Test Rare Item", rarity: "rare" });
      const legendaryId = await createTestItem(sql, {
        name: "Store Test Legendary Item",
        rarity: "legendary",
      });
      const uc = buildUseCases(sql, new FakeRng([1]));

      const listing = await uc.listStoreItemsUseCase.execute();

      expect(listing.some((entry) => entry.id === rareId)).toBe(false);
      expect(listing.some((entry) => entry.id === legendaryId)).toBe(false);
    });
  });

  describe("PurchaseItemUseCase", () => {
    it("buys an item, deducting gold and adding it to the bag", async () => {
      const userId = await createTestUser(sql);
      const playerId = await createTestPlayer(sql, userId, { gold: 100 });
      const uc = buildUseCases(sql, new FakeRng([1]));
      const smallPot = await uc.itemRepository.findByName("small pot");
      if (!smallPot) throw new Error("Seeded small pot not found");

      const result = await uc.purchaseItemUseCase.execute({
        playerId,
        isVip: false,
        itemId: smallPot.id,
      });

      expect(result.gold).toBe(75);
      expect(result.playerItem.quantity).toBe(1);

      const player = await uc.playerRepository.findById(playerId);
      expect(player?.gold).toBe(75);
    });

    it("stacks a second purchase of the same item onto the existing quantity", async () => {
      const userId = await createTestUser(sql);
      const playerId = await createTestPlayer(sql, userId, { gold: 100 });
      const uc = buildUseCases(sql, new FakeRng([1]));
      const bandage = await uc.itemRepository.findByName("bandage");
      if (!bandage) throw new Error("Seeded bandage not found");

      await uc.purchaseItemUseCase.execute({ playerId, isVip: false, itemId: bandage.id });
      const second = await uc.purchaseItemUseCase.execute({
        playerId,
        isVip: false,
        itemId: bandage.id,
      });

      expect(second.playerItem.quantity).toBe(2);
      expect(second.gold).toBe(0); // 100 - 50 - 50
    });

    it("rejects when the player can't afford it", async () => {
      const userId = await createTestUser(sql);
      const playerId = await createTestPlayer(sql, userId, { gold: 10 });
      const uc = buildUseCases(sql, new FakeRng([1]));
      const smallPot = await uc.itemRepository.findByName("small pot");
      if (!smallPot) throw new Error("Seeded small pot not found");

      await expectRejection(
        uc.purchaseItemUseCase.execute({ playerId, isVip: false, itemId: smallPot.id }),
        InsufficientGoldError,
      );

      const player = await uc.playerRepository.findById(playerId);
      expect(player?.gold).toBe(10);
    });

    it("rejects buying a rare or legendary item — the store never sells them", async () => {
      const userId = await createTestUser(sql);
      const playerId = await createTestPlayer(sql, userId, { gold: 100000 });
      const rareId = await createTestItem(sql, { name: "Purchase Test Rare Item", rarity: "rare" });
      const uc = buildUseCases(sql, new FakeRng([1]));

      await expectRejection(
        uc.purchaseItemUseCase.execute({ playerId, isVip: false, itemId: rareId }),
        ItemNotPurchasableError,
      );
    });

    it("buys a normal gear item (Basic Helmet), which can then be equipped", async () => {
      const userId = await createTestUser(sql);
      const playerId = await createTestPlayer(sql, userId, { gold: 100 });
      const uc = buildUseCases(sql, new FakeRng([1]));
      const helmet = await uc.itemRepository.findByName("Basic Helmet");
      if (!helmet) throw new Error("Seeded Basic Helmet not found");

      const purchase = await uc.purchaseItemUseCase.execute({
        playerId,
        isVip: false,
        itemId: helmet.id,
      });
      expect(purchase.gold).toBe(70);
      expect(purchase.playerItem.equippedSlot).toBeNull();

      const equipped = await uc.equipItemUseCase.execute({
        playerId,
        playerItemId: purchase.playerItem.id,
      });
      expect(equipped.playerItem.equippedSlot).toBe("helmet");
    });

    it("rejects once the combined POT cap is already full, leaving gold untouched", async () => {
      const userId = await createTestUser(sql);
      const playerId = await createTestPlayer(sql, userId, { gold: 1000 });
      const uc = buildUseCases(sql, new FakeRng([1]));
      const smallPot = await uc.itemRepository.findByName("small pot");
      if (!smallPot) throw new Error("Seeded small pot not found");
      await createTestPlayerItem(sql, playerId, smallPot.id, { quantity: 5 });

      await expectRejection(
        uc.purchaseItemUseCase.execute({ playerId, isVip: false, itemId: smallPot.id }),
        BagFullError,
      );

      const player = await uc.playerRepository.findById(playerId);
      expect(player?.gold).toBe(1000);
    });
  });
});
