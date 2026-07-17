import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { SQL } from "bun";
import { ZERO_ATTRIBUTE_BONUSES } from "@/domain/shared/Attributes";
import { buildUseCases } from "../support/buildUseCases";
import { FakeRng } from "../support/FakeRng";
import { getSharedPostgresEnvironment } from "../support/sharedPostgresEnvironment";
import {
  createTestItem,
  createTestPlayer,
  createTestPlayerItem,
  createTestUser,
} from "../support/testFixtures";

describe("GetPlayerProfileUseCase (integration)", () => {
  let sql: SQL;

  beforeAll(async () => {
    const env = await getSharedPostgresEnvironment();
    sql = new SQL(env.connectionUri);
  }, 120_000);

  afterAll(async () => {
    await sql.close();
  });

  it("returns profile fields, equipped items (incl. bracelet), and bag contents", async () => {
    const userId = await createTestUser(sql);
    const playerId = await createTestPlayer(sql, userId, { gold: 50, level: 3, xp: 120 });
    const uc = buildUseCases(sql, new FakeRng([1]));

    const helmetId = await createTestItem(sql, { name: "Profile Test Helm", slot: "helmet" });
    const helmetPlayerItemId = await createTestPlayerItem(sql, playerId, helmetId);
    await uc.equipItemUseCase.execute({ playerId, playerItemId: helmetPlayerItemId });

    const ringId = await createTestItem(sql, { name: "Profile Test Ring", slot: "bracelet" });
    const ringPlayerItemId = await createTestPlayerItem(sql, playerId, ringId);
    await uc.equipItemUseCase.execute({ playerId, playerItemId: ringPlayerItemId });

    const potionId = await createTestItem(sql, { name: "Profile Test Potion", hpRestore: 50 });
    await createTestPlayerItem(sql, playerId, potionId, { quantity: 3 });

    const profile = await uc.getPlayerProfileUseCase.execute({ playerId });

    expect(profile.gold).toBe(50);
    expect(profile.level).toBe(3);
    expect(profile.xp).toBe(120);
    expect(profile.lastDeathAt).toBeNull();
    expect(profile.equipped.helmet).toEqual({
      playerItemId: helmetPlayerItemId,
      itemId: helmetId,
      name: "Profile Test Helm",
      rarity: "common",
      setName: null,
      attributeBonuses: ZERO_ATTRIBUTE_BONUSES,
    });
    expect(profile.equipped.bracelet).toEqual({
      playerItemId: ringPlayerItemId,
      itemId: ringId,
      name: "Profile Test Ring",
      rarity: "common",
      setName: null,
      attributeBonuses: ZERO_ATTRIBUTE_BONUSES,
    });
    expect(profile.equipped.boots).toBeNull();
    expect(profile.bag).toEqual([
      {
        id: expect.any(String),
        itemId: potionId,
        name: "Profile Test Potion",
        quantity: 3,
        slot: null,
        rarity: "common",
        setName: null,
        attributeBonuses: ZERO_ATTRIBUTE_BONUSES,
        value: 10,
      },
    ]);
  });

  it("reports attributeBonuses from equipped items, without touching base attributes", async () => {
    const userId = await createTestUser(sql);
    const playerId = await createTestPlayer(sql, userId, { strength: 5, intelligence: 5 });
    const uc = buildUseCases(sql, new FakeRng([1]));

    const swordId = await createTestItem(sql, {
      name: "Profile Test Sword",
      slot: "weapon",
      strength: 3,
    });
    const swordPlayerItemId = await createTestPlayerItem(sql, playerId, swordId);
    await uc.equipItemUseCase.execute({ playerId, playerItemId: swordPlayerItemId });

    const profile = await uc.getPlayerProfileUseCase.execute({ playerId });

    expect(profile.attributes.strength).toBe(5);
    expect(profile.attributeBonuses.strength).toBe(3);
    expect(profile.attributeBonuses.intelligence).toBe(0);
  });

  it("adds the +2 all-attribute set bonus to attributeBonuses once a full set is equipped", async () => {
    const userId = await createTestUser(sql);
    const playerId = await createTestPlayer(sql, userId);
    const uc = buildUseCases(sql, new FakeRng([1]));

    const pieces: {
      slot: string;
      attribute: "strength" | "vitality" | "agility" | "dexterity" | "luck";
    }[] = [
      { slot: "helmet", attribute: "vitality" },
      { slot: "body", attribute: "vitality" },
      { slot: "boots", attribute: "agility" },
      { slot: "gloves", attribute: "dexterity" },
      { slot: "necklace", attribute: "luck" },
      { slot: "bracelet", attribute: "strength" },
    ];
    for (const piece of pieces) {
      const itemId = await createTestItem(sql, {
        name: `Profile Test Set ${piece.slot} ${Bun.randomUUIDv7()}`,
        slot: piece.slot,
        setName: "profileTestSet",
        [piece.attribute]: 1,
      });
      const playerItemId = await createTestPlayerItem(sql, playerId, itemId);
      await uc.equipItemUseCase.execute({ playerId, playerItemId });
    }

    const profile = await uc.getPlayerProfileUseCase.execute({ playerId });

    expect(profile.attributeBonuses.strength).toBe(1 + 2);
    expect(profile.attributeBonuses.intelligence).toBe(2);
  });

  it("surfaces the player's last death time when they have one", async () => {
    const userId = await createTestUser(sql);
    const lastDeathAt = new Date();
    const playerId = await createTestPlayer(sql, userId, { lastDeathAt });
    const uc = buildUseCases(sql, new FakeRng([1]));

    const profile = await uc.getPlayerProfileUseCase.execute({ playerId });

    expect(profile.lastDeathAt).toBe(lastDeathAt.toISOString());
  });

  it("reports 0/null Dungeon Slayer standing for a player who has never killed the tier-3 boss", async () => {
    const userId = await createTestUser(sql);
    const playerId = await createTestPlayer(sql, userId);
    const uc = buildUseCases(sql, new FakeRng([1]));

    const profile = await uc.getPlayerProfileUseCase.execute({ playerId });

    expect(profile.dungeonSlayerKills).toBe(0);
    expect(profile.dungeonSlayerLastKillAt).toBeNull();
  });

  it("reports the caller's own Dungeon Slayer kill count and last-kill time", async () => {
    const userId = await createTestUser(sql);
    const playerId = await createTestPlayer(sql, userId);
    const uc = buildUseCases(sql, new FakeRng([1]));

    const now = new Date("2026-07-13T12:00:00.000Z");
    await uc.dungeonSlayerRankingRepository.incrementKill(playerId, now);
    await uc.dungeonSlayerRankingRepository.incrementKill(playerId, now);

    const profile = await uc.getPlayerProfileUseCase.execute({ playerId });

    expect(profile.dungeonSlayerKills).toBe(2);
    expect(profile.dungeonSlayerLastKillAt).toBe(now.toISOString());
  });
});
