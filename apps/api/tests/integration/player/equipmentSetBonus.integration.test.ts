import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { SQL } from "bun";
import { computeEffectiveAttributes } from "@/usecase/player/effectiveAttributes";
import { buildUseCases } from "../support/buildUseCases";
import { FakeRng } from "../support/FakeRng";
import { getSharedPostgresEnvironment } from "../support/sharedPostgresEnvironment";
import {
  createTestItem,
  createTestPlayer,
  createTestPlayerItem,
  createTestUser,
} from "../support/testFixtures";

/**
 * Wearing all 6 non-weapon slots (helmet/armor/boots/gloves/necklace/
 * bracelet-or-ring) from the same set grants a flat +2 to every attribute,
 * on top of each piece's own individual bonus — but only once the set is
 * fully complete, never for partial credit.
 */
describe("Equipment set completion bonus (integration)", () => {
  let sql: SQL;

  beforeAll(async () => {
    const env = await getSharedPostgresEnvironment();
    sql = new SQL(env.connectionUri);
  }, 120_000);

  afterAll(async () => {
    await sql.close();
  });

  async function seedSetPiece(
    setName: string,
    slot: string,
    attribute: "strength" | "dexterity" | "agility" | "intelligence" | "vitality" | "luck",
  ) {
    return createTestItem(sql, {
      name: `Test ${setName} ${slot} ${Bun.randomUUIDv7()}`,
      slot,
      setName,
      [attribute]: 1,
    });
  }

  it("grants +2 to every attribute once all 6 slots share the same set", async () => {
    const userId = await createTestUser(sql);
    const playerId = await createTestPlayer(sql, userId, {
      strength: 1,
      dexterity: 1,
      agility: 1,
      intelligence: 1,
      vitality: 1,
      luck: 1,
    });
    const uc = buildUseCases(sql, new FakeRng([1]));

    const pieces = [
      { slot: "helmet", attribute: "vitality" as const },
      { slot: "body", attribute: "vitality" as const },
      { slot: "boots", attribute: "agility" as const },
      { slot: "gloves", attribute: "dexterity" as const },
      { slot: "necklace", attribute: "luck" as const },
      { slot: "bracelet", attribute: "strength" as const },
    ];

    for (const piece of pieces) {
      const itemId = await seedSetPiece("testset", piece.slot, piece.attribute);
      const playerItemId = await createTestPlayerItem(sql, playerId, itemId);
      await uc.equipItemUseCase.execute({ playerId, playerItemId });
    }

    const player = await uc.playerRepository.findById(playerId);
    if (!player) throw new Error("Player not found");
    const effective = await computeEffectiveAttributes(
      player,
      uc.playerItemRepository,
      uc.itemRepository,
      uc.setAttributeBonus,
    );

    // Each slot's own +1 plus the flat +2 set-completion bonus; helmet and
    // body both add +1 vitality, so vitality gets +2 (individual) + 2 (set).
    expect(effective.strength).toBe(1 + 1 + 2);
    expect(effective.dexterity).toBe(1 + 1 + 2);
    expect(effective.agility).toBe(1 + 1 + 2);
    expect(effective.intelligence).toBe(1 + 0 + 2);
    expect(effective.vitality).toBe(1 + 2 + 2);
    expect(effective.luck).toBe(1 + 1 + 2);
  });

  it("grants no bonus at all for 5 of 6 slots (no partial credit)", async () => {
    const userId = await createTestUser(sql);
    const playerId = await createTestPlayer(sql, userId, {
      strength: 1,
      dexterity: 1,
      agility: 1,
      intelligence: 1,
      vitality: 1,
      luck: 1,
    });
    const uc = buildUseCases(sql, new FakeRng([1]));

    const pieces = [
      { slot: "helmet", attribute: "vitality" as const },
      { slot: "body", attribute: "vitality" as const },
      { slot: "boots", attribute: "agility" as const },
      { slot: "gloves", attribute: "dexterity" as const },
      { slot: "necklace", attribute: "luck" as const },
      // bracelet deliberately omitted
    ];

    for (const piece of pieces) {
      const itemId = await seedSetPiece("testset2", piece.slot, piece.attribute);
      const playerItemId = await createTestPlayerItem(sql, playerId, itemId);
      await uc.equipItemUseCase.execute({ playerId, playerItemId });
    }

    const player = await uc.playerRepository.findById(playerId);
    if (!player) throw new Error("Player not found");
    const effective = await computeEffectiveAttributes(
      player,
      uc.playerItemRepository,
      uc.itemRepository,
      uc.setAttributeBonus,
    );

    expect(effective.strength).toBe(1);
    expect(effective.vitality).toBe(1 + 2);
    expect(effective.intelligence).toBe(1);
  });

  it("grants no bonus when 6 slots are filled but from two different sets", async () => {
    const userId = await createTestUser(sql);
    const playerId = await createTestPlayer(sql, userId, {
      strength: 1,
      dexterity: 1,
      agility: 1,
      intelligence: 1,
      vitality: 1,
      luck: 1,
    });
    const uc = buildUseCases(sql, new FakeRng([1]));

    const helmetId = await seedSetPiece("mixedA", "helmet", "vitality");
    const bodyId = await seedSetPiece("mixedB", "body", "intelligence");
    const bootsId = await seedSetPiece("mixedA", "boots", "agility");
    const glovesId = await seedSetPiece("mixedA", "gloves", "dexterity");
    const necklaceId = await seedSetPiece("mixedA", "necklace", "luck");
    const braceletId = await seedSetPiece("mixedA", "bracelet", "strength");

    for (const itemId of [helmetId, bodyId, bootsId, glovesId, necklaceId, braceletId]) {
      const playerItemId = await createTestPlayerItem(sql, playerId, itemId);
      await uc.equipItemUseCase.execute({ playerId, playerItemId });
    }

    const player = await uc.playerRepository.findById(playerId);
    if (!player) throw new Error("Player not found");
    const effective = await computeEffectiveAttributes(
      player,
      uc.playerItemRepository,
      uc.itemRepository,
      uc.setAttributeBonus,
    );

    // Only individual bonuses apply — the body slot's different set name
    // breaks the "all 6 slots share one set" rule, so no +2 anywhere.
    expect(effective.vitality).toBe(1 + 1);
    expect(effective.intelligence).toBe(1 + 1);
    expect(effective.strength).toBe(1 + 1);
  });
});
