import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { SQL } from "bun";
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
    });
  });
});
