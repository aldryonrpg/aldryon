import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { SQL } from "bun";
import { CannotDestroyEquippedItemError, PlayerItemNotFoundError } from "@/usecase/player/errors";
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

describe("DestroyBagItemUseCase (integration)", () => {
  let sql: SQL;

  beforeAll(async () => {
    const env = await getSharedPostgresEnvironment();
    sql = new SQL(env.connectionUri);
  }, 120_000);

  afterAll(async () => {
    await sql.close();
  });

  it("destroys an unequipped bag item", async () => {
    const userId = await createTestUser(sql);
    const playerId = await createTestPlayer(sql, userId);
    const itemId = await createTestItem(sql, { name: "Destroy Test Junk" });
    const playerItemId = await createTestPlayerItem(sql, playerId, itemId);
    const uc = buildUseCases(sql, new FakeRng([1]));

    await uc.destroyBagItemUseCase.execute({ playerId, playerItemId });

    expect(await uc.playerItemRepository.findById(playerItemId)).toBeNull();
  });

  it("rejects an item that doesn't belong to the player", async () => {
    const ownerUserId = await createTestUser(sql);
    const ownerPlayerId = await createTestPlayer(sql, ownerUserId);
    const otherUserId = await createTestUser(sql);
    const otherPlayerId = await createTestPlayer(sql, otherUserId);
    const itemId = await createTestItem(sql, { name: "Destroy Test Not Yours" });
    const playerItemId = await createTestPlayerItem(sql, ownerPlayerId, itemId);
    const uc = buildUseCases(sql, new FakeRng([1]));

    await expectRejection(
      uc.destroyBagItemUseCase.execute({ playerId: otherPlayerId, playerItemId }),
      PlayerItemNotFoundError,
    );
  });

  it("rejects destroying an equipped item", async () => {
    const userId = await createTestUser(sql);
    const playerId = await createTestPlayer(sql, userId);
    const itemId = await createTestItem(sql, { name: "Destroy Test Helmet", slot: "helmet" });
    const playerItemId = await createTestPlayerItem(sql, playerId, itemId, {
      equippedSlot: "helmet",
    });
    const uc = buildUseCases(sql, new FakeRng([1]));

    await expectRejection(
      uc.destroyBagItemUseCase.execute({ playerId, playerItemId }),
      CannotDestroyEquippedItemError,
    );
  });

  it("releases global ownership when destroying a unique item, so it can be dropped again", async () => {
    const userId = await createTestUser(sql);
    const playerId = await createTestPlayer(sql, userId);
    const itemId = await createTestItem(sql, { name: "Destroy Test Unique", rarity: "unique" });
    await seedOwnershipClaim(sql, itemId, playerId);
    const playerItemId = await createTestPlayerItem(sql, playerId, itemId);
    const uc = buildUseCases(sql, new FakeRng([1]));

    await uc.destroyBagItemUseCase.execute({ playerId, playerItemId });

    const ownership = await sql<
      { current_owner_player_id: string | null }[]
    >`select current_owner_player_id from unique_item_ownership where item_id = ${itemId}`;
    expect(ownership[0]?.current_owner_player_id).toBeNull();
  });
});

async function seedOwnershipClaim(sql: SQL, itemId: string, playerId: string): Promise<void> {
  await sql`
    insert into unique_item_ownership (item_id, current_owner_player_id, owner_history)
    values (${itemId}, ${playerId}, '[]'::jsonb)
  `;
}
