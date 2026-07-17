import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { SQL } from "bun";
import { ZERO_ATTRIBUTE_BONUSES } from "@/domain/shared/Attributes";
import { PlayerItemNotFoundError } from "@/usecase/player/errors";
import {
  BagFullError,
  CannotSellEquippedItemError,
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
        hpRestore: 50,
        category: "consumable",
        setName: null,
        itemImage: null,
        attributeBonuses: ZERO_ATTRIBUTE_BONUSES,
      });
    });

    it("lists Basic Helmet as gear, not consumable, tagged with the leather set", async () => {
      const uc = buildUseCases(sql, new FakeRng([1]));
      const listing = await uc.listStoreItemsUseCase.execute();

      const helmet = listing.find((entry) => entry.name === "Basic Helmet");
      expect(helmet?.category).toBe("gear");
      expect(helmet?.rarity).toBe("basic");
      expect(helmet?.setName).toBe("leather");
    });

    it("excludes rare and legendary items", async () => {
      const rareId = await createTestItem(sql, {
        name: "Store Test Rare Item",
        rarity: "rare",
        storePurchasable: false,
      });
      const legendaryId = await createTestItem(sql, {
        name: "Store Test Legendary Item",
        rarity: "legendary",
        storePurchasable: false,
      });
      const uc = buildUseCases(sql, new FakeRng([1]));

      const listing = await uc.listStoreItemsUseCase.execute();

      expect(listing.some((entry) => entry.id === rareId)).toBe(false);
      expect(listing.some((entry) => entry.id === legendaryId)).toBe(false);
    });

    it("returns itemImage when the item has one, null otherwise", async () => {
      const withImageId = await createTestItem(sql, {
        name: "Store Test Item With Image",
        itemImage: "https://example.com/sword.png",
      });
      const withoutImageId = await createTestItem(sql, { name: "Store Test Item No Image" });
      const uc = buildUseCases(sql, new FakeRng([1]));

      const listing = await uc.listStoreItemsUseCase.execute();

      expect(listing.find((entry) => entry.id === withImageId)?.itemImage).toBe(
        "https://example.com/sword.png",
      );
      expect(listing.find((entry) => entry.id === withoutImageId)?.itemImage).toBeNull();
    });

    it("excludes an otherwise store-eligible rarity when storePurchasable is false (e.g. a set tier)", async () => {
      const ironHelmetId = await createTestItem(sql, {
        name: "Store Test Iron Helmet",
        rarity: "uncommon",
        setName: "iron",
        storePurchasable: false,
      });
      const uc = buildUseCases(sql, new FakeRng([1]));

      const listing = await uc.listStoreItemsUseCase.execute();

      expect(listing.some((entry) => entry.id === ironHelmetId)).toBe(false);
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
      const rareId = await createTestItem(sql, {
        name: "Purchase Test Rare Item",
        rarity: "rare",
        storePurchasable: false,
      });
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

  describe("SellItemUseCase", () => {
    it("sells an item, crediting gold and removing it from the bag", async () => {
      const userId = await createTestUser(sql);
      const playerId = await createTestPlayer(sql, userId, { gold: 0 });
      const itemId = await createTestItem(sql, { name: "Sell Test Sword", value: 40 });
      const playerItemId = await createTestPlayerItem(sql, playerId, itemId);
      const uc = buildUseCases(sql, new FakeRng([1]));

      const result = await uc.sellItemUseCase.execute({ playerId, playerItemId });

      expect(result.gold).toBe(40);
      const player = await uc.playerRepository.findById(playerId);
      expect(player?.gold).toBe(40);
      expect(await uc.playerItemRepository.findById(playerItemId)).toBeNull();
    });

    it("sells a stacked quantity for value * quantity", async () => {
      const userId = await createTestUser(sql);
      const playerId = await createTestPlayer(sql, userId, { gold: 0 });
      const itemId = await createTestItem(sql, { name: "Sell Test Potion", value: 25 });
      const playerItemId = await createTestPlayerItem(sql, playerId, itemId, { quantity: 3 });
      const uc = buildUseCases(sql, new FakeRng([1]));

      const result = await uc.sellItemUseCase.execute({ playerId, playerItemId });

      expect(result.gold).toBe(75);
    });

    it("rejects selling an equipped item, leaving gold untouched", async () => {
      const userId = await createTestUser(sql);
      const playerId = await createTestPlayer(sql, userId, { gold: 0 });
      const itemId = await createTestItem(sql, {
        name: "Sell Test Helmet",
        slot: "helmet",
        value: 40,
      });
      const playerItemId = await createTestPlayerItem(sql, playerId, itemId);
      const uc = buildUseCases(sql, new FakeRng([1]));
      await uc.equipItemUseCase.execute({ playerId, playerItemId });

      await expectRejection(
        uc.sellItemUseCase.execute({ playerId, playerItemId }),
        CannotSellEquippedItemError,
      );

      const player = await uc.playerRepository.findById(playerId);
      expect(player?.gold).toBe(0);
    });

    it("404s for a playerItemId that doesn't belong to the caller", async () => {
      const ownerUserId = await createTestUser(sql);
      const ownerId = await createTestPlayer(sql, ownerUserId);
      const otherUserId = await createTestUser(sql);
      const otherId = await createTestPlayer(sql, otherUserId);
      const itemId = await createTestItem(sql, { name: "Sell Test Someone Else's Item" });
      const playerItemId = await createTestPlayerItem(sql, ownerId, itemId);
      const uc = buildUseCases(sql, new FakeRng([1]));

      await expectRejection(
        uc.sellItemUseCase.execute({ playerId: otherId, playerItemId }),
        PlayerItemNotFoundError,
      );
    });

    it("releases global ownership when selling a unique item, so it can be dropped again", async () => {
      const userId = await createTestUser(sql);
      const playerId = await createTestPlayer(sql, userId, { gold: 0 });
      const itemId = await createTestItem(sql, {
        name: "Sell Test Unique",
        rarity: "unique",
        value: 500,
      });
      await sql`
        insert into unique_item_ownership (item_id, current_owner_player_id, owner_history)
        values (${itemId}, ${playerId}, '[]'::jsonb)
      `;
      const playerItemId = await createTestPlayerItem(sql, playerId, itemId);
      const uc = buildUseCases(sql, new FakeRng([1]));

      await uc.sellItemUseCase.execute({ playerId, playerItemId });

      const ownership = await sql<
        { current_owner_player_id: string | null }[]
      >`select current_owner_player_id from unique_item_ownership where item_id = ${itemId}`;
      expect(ownership[0]?.current_owner_player_id).toBeNull();
    });
  });
});
