import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { SQL } from "bun";
import { ZERO_ATTRIBUTE_BONUSES } from "@/domain/shared/Attributes";
import { buildUseCases } from "../support/buildUseCases";
import { FakeRng } from "../support/FakeRng";
import { getSharedPostgresEnvironment } from "../support/sharedPostgresEnvironment";
import { createTestItem } from "../support/testFixtures";

describe("ListItemsUseCase (integration)", () => {
  let sql: SQL;

  beforeAll(async () => {
    const env = await getSharedPostgresEnvironment();
    sql = new SQL(env.connectionUri);
  }, 120_000);

  afterAll(async () => {
    await sql.close();
  });

  it("returns the full item catalog with id/name/slot/rarity", async () => {
    const itemId = await createTestItem(sql, {
      name: "Catalog Test Helm",
      slot: "helmet",
      rarity: "rare",
    });
    const uc = buildUseCases(sql, new FakeRng([1]));

    const catalog = await uc.listItemsUseCase.execute();

    const entry = catalog.find((item) => item.id === itemId);
    expect(entry).toEqual({
      id: itemId,
      name: "Catalog Test Helm",
      slot: "helmet",
      rarity: "rare",
      setName: null,
      attributeBonuses: ZERO_ATTRIBUTE_BONUSES,
    });
  });

  it("returns setName for a set piece", async () => {
    const itemId = await createTestItem(sql, {
      name: "Catalog Test Iron Helm",
      slot: "helmet",
      rarity: "uncommon",
      setName: "iron",
    });
    const uc = buildUseCases(sql, new FakeRng([1]));

    const catalog = await uc.listItemsUseCase.execute();

    expect(catalog.find((item) => item.id === itemId)?.setName).toBe("iron");
  });

  it("returns the item's nonzero attribute bonuses", async () => {
    const itemId = await createTestItem(sql, {
      name: "Catalog Test Bonus Sword",
      slot: "weapon",
      strength: 3,
      luck: -1,
    });
    const uc = buildUseCases(sql, new FakeRng([1]));

    const catalog = await uc.listItemsUseCase.execute();

    const entry = catalog.find((item) => item.id === itemId);
    expect(entry?.attributeBonuses.strength).toBe(3);
    expect(entry?.attributeBonuses.luck).toBe(-1);
  });
});

describe("GetItemRarityColorsUseCase (integration)", () => {
  let sql: SQL;

  beforeAll(async () => {
    const env = await getSharedPostgresEnvironment();
    sql = new SQL(env.connectionUri);
  }, 120_000);

  afterAll(async () => {
    await sql.close();
  });

  it("returns a color for every rarity tier", async () => {
    const uc = buildUseCases(sql, new FakeRng([1]));

    const colors = uc.getItemRarityColorsUseCase.execute();

    expect(colors).toEqual({
      basic: "white",
      common: "gray",
      uncommon: "green",
      rare: "blue",
      very_rare: "purple",
      legendary: "gold",
      unique: "red",
    });
  });
});
