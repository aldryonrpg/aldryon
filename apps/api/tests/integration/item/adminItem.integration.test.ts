import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { SQL } from "bun";
import { DuplicateItemNameError, ItemNotFoundError } from "@/usecase/item/errors";
import { buildUseCases } from "../support/buildUseCases";
import { expectRejection } from "../support/expectRejection";
import { FakeRng } from "../support/FakeRng";
import { getSharedPostgresEnvironment } from "../support/sharedPostgresEnvironment";
import { createTestItem } from "../support/testFixtures";

describe("ListItemsForAdminUseCase (integration)", () => {
  let sql: SQL;

  beforeAll(async () => {
    const env = await getSharedPostgresEnvironment();
    sql = new SQL(env.connectionUri);
  }, 120_000);

  afterAll(async () => {
    await sql.close();
  });

  it("returns every item, including a freshly created one (happy path)", async () => {
    const itemId = await createTestItem(sql);
    const uc = buildUseCases(sql, new FakeRng([1]));

    const items = await uc.listItemsForAdminUseCase.execute();

    expect(items.some((i) => i.id === itemId)).toBe(true);
  });
});

describe("CreateItemUseCase (integration)", () => {
  let sql: SQL;

  beforeAll(async () => {
    const env = await getSharedPostgresEnvironment();
    sql = new SQL(env.connectionUri);
  }, 120_000);

  afterAll(async () => {
    await sql.close();
  });

  it("creates a new item (happy path)", async () => {
    const uc = buildUseCases(sql, new FakeRng([1]));
    const name = `Admin Created Item ${Bun.randomUUIDv7()}`;

    const item = await uc.createItemUseCase.execute({
      name,
      description: "created via admin",
      value: 250,
      rarity: "rare",
      slot: "helmet",
      attributeBonuses: {
        strength: 2,
        dexterity: 0,
        agility: 0,
        intelligence: 0,
        vitality: 1,
        luck: -1,
      },
      hpRestore: null,
      revealsAllMonsterAttributes: false,
      setName: null,
      storePurchasable: true,
      itemImage: "/items/test-helm.png",
      isPermanent: false,
    });

    expect(item.name).toBe(name);
    expect(item.value).toBe(250);
    expect(item.slot).toBe("helmet");
    expect(item.attributeBonuses.luck).toBe(-1);
    expect(item.itemImage).toBe("/items/test-helm.png");

    const persisted = await uc.itemRepository.findById(item.id);
    expect(persisted?.name).toBe(name);
  });

  it("rejects a duplicate item name (edge case)", async () => {
    const existingId = await createTestItem(sql);
    const existingRows = await sql`select name from items where id = ${existingId}`;
    const existingName = existingRows[0].name as string;
    const uc = buildUseCases(sql, new FakeRng([1]));

    await expectRejection(
      uc.createItemUseCase.execute({
        name: existingName,
        description: "duplicate attempt",
        value: 10,
        rarity: "common",
        slot: null,
        attributeBonuses: {
          strength: 0,
          dexterity: 0,
          agility: 0,
          intelligence: 0,
          vitality: 0,
          luck: 0,
        },
        hpRestore: null,
        revealsAllMonsterAttributes: false,
        setName: null,
        storePurchasable: true,
        itemImage: null,
        isPermanent: false,
      }),
      DuplicateItemNameError,
    );
  });
});

describe("UpdateItemUseCase (integration)", () => {
  let sql: SQL;

  beforeAll(async () => {
    const env = await getSharedPostgresEnvironment();
    sql = new SQL(env.connectionUri);
  }, 120_000);

  afterAll(async () => {
    await sql.close();
  });

  it("patches a subset of fields and leaves the rest untouched (happy path)", async () => {
    const itemId = await createTestItem(sql, { value: 50, itemImage: null });
    const uc = buildUseCases(sql, new FakeRng([1]));
    const before = await uc.itemRepository.findById(itemId);
    if (!before) throw new Error("test setup: item not found");

    const updated = await uc.updateItemUseCase.execute({
      id: itemId,
      value: 999,
      itemImage: "/items/updated.png",
    });

    expect(updated.value).toBe(999);
    expect(updated.itemImage).toBe("/items/updated.png");
    expect(updated.name).toBe(before.name);
  });

  it("rejects patching an item id that doesn't exist (edge case)", async () => {
    const uc = buildUseCases(sql, new FakeRng([1]));

    await expectRejection(
      uc.updateItemUseCase.execute({ id: Bun.randomUUIDv7(), value: 999 }),
      ItemNotFoundError,
    );
  });

  it("rejects renaming an item to another item's existing name (edge case)", async () => {
    const otherId = await createTestItem(sql);
    const otherRows = await sql`select name from items where id = ${otherId}`;
    const otherName = otherRows[0].name as string;
    const itemId = await createTestItem(sql);
    const uc = buildUseCases(sql, new FakeRng([1]));

    await expectRejection(
      uc.updateItemUseCase.execute({ id: itemId, name: otherName }),
      DuplicateItemNameError,
    );
  });

  it("refreshes the repository's own per-id cache so a cached read sees the patched value immediately", async () => {
    const itemId = await createTestItem(sql, { value: 100 });
    const uc = buildUseCases(sql, new FakeRng([1]));

    const cachedBeforePatch = await uc.itemRepository.findById(itemId);
    expect(cachedBeforePatch?.value).toBe(100);

    await uc.updateItemUseCase.execute({ id: itemId, value: 777 });

    const cachedAfterPatch = await uc.itemRepository.findById(itemId);
    expect(cachedAfterPatch?.value).toBe(777);
  });
});
