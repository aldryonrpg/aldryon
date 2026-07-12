import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { SQL } from "bun";
import { Battle } from "@/domain/battle/Battle";
import { maxHp } from "@/domain/battle/battleConfig";
import {
  InvalidBagItemError,
  InvalidLootPickError,
  NoActiveBattleError,
  NoPendingLootError,
} from "@/usecase/battle/errors";
import { buildUseCases } from "../support/buildUseCases";
import { FakeRng } from "../support/FakeRng";
import { type PostgresEnvironment, startPostgresEnvironment } from "../support/postgresEnvironment";
import {
  createTestItem,
  createTestMonster,
  createTestMonsterAttack,
  createTestPlayer,
  createTestPlayerItem,
  createTestUser,
  linkMonsterMoveset,
} from "../support/testFixtures";

describe("Run / Bag / Rest / Loot use cases (integration)", () => {
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

  async function setupBattle(overrides: {
    playerAgility?: number;
    monsterAgility?: number;
    playerHp?: number;
    playerForce?: number;
  }) {
    const userId = await createTestUser(sql);
    const playerId = await createTestPlayer(sql, userId, {
      agility: overrides.playerAgility ?? 1,
      force: overrides.playerForce ?? 10,
    });
    const monsterId = await createTestMonster(sql, {
      agility: overrides.monsterAgility ?? 1,
      force: 1,
    });
    const attackId = await createTestMonsterAttack(sql, { staminaCost: 0, multiplier: 1 });
    await linkMonsterMoveset(sql, monsterId, attackId);

    const playerMaxHp = maxHp(1, overrides.playerForce ?? 10);
    const battle = Battle.create({
      id: Bun.randomUUIDv7(),
      playerId,
      monsterId,
      playerCurrentHp: overrides.playerHp ?? playerMaxHp,
      playerCurrentStamina: 10,
      monsterCurrentHp: 100,
      monsterCurrentStamina: 10,
      round: 1,
      playerEffects: [],
      monsterEffects: [],
      monsterChargingAttackId: null,
      chargeRoundsLeft: 0,
    });

    return { playerId, monsterId, battle, playerMaxHp };
  }

  describe("RunFromBattleUseCase", () => {
    it("escapes cleanly when the player's Agility is not lower than the monster's", async () => {
      const { playerId, battle } = await setupBattle({ playerAgility: 5, monsterAgility: 5 });
      const uc = buildUseCases(sql, new FakeRng([1]));
      await uc.battleRepository.create(battle);

      const result = await uc.runFromBattleUseCase.execute({ playerId });

      expect(result.outcome).toBe("fled");
      expect(result.monsterAttack).toBeNull();
      expect(await uc.battleRepository.findByPlayerId(playerId)).toBeNull();

      const player = await uc.playerRepository.findById(playerId);
      expect(player?.lastRunAt).not.toBeNull();
    });

    it("takes a parting hit when the monster is faster, but still escapes if it survives", async () => {
      const { playerId, battle } = await setupBattle({
        playerAgility: 1,
        monsterAgility: 10,
        playerHp: 500,
      });
      const uc = buildUseCases(sql, new FakeRng([1]));
      await uc.battleRepository.create(battle);

      const result = await uc.runFromBattleUseCase.execute({ playerId });

      expect(result.outcome).toBe("fled");
      expect(result.monsterAttack?.hit).toBe(true);
      expect(result.playerStatus.currentHp).toBeLessThan(500);
    });

    it("triggers the death settlement when a fatal parting hit lands", async () => {
      const { playerId, battle } = await setupBattle({
        playerAgility: 1,
        monsterAgility: 10,
        playerHp: 1,
        playerForce: 1,
      });
      await sql`update players set xp = 1000 where id = ${playerId}`;
      const uc = buildUseCases(sql, new FakeRng([1]));
      await uc.battleRepository.create(battle);

      const result = await uc.runFromBattleUseCase.execute({ playerId });

      expect(result.outcome).toBe("lost");
      const player = await uc.playerRepository.findById(playerId);
      expect(player?.xp).toBe(990);
      expect(player?.lastDeathAt).not.toBeNull();
    });

    it("404s when the player has no active battle", async () => {
      const userId = await createTestUser(sql);
      const playerId = await createTestPlayer(sql, userId);
      const uc = buildUseCases(sql, new FakeRng([1]));

      await expect(uc.runFromBattleUseCase.execute({ playerId })).rejects.toBeInstanceOf(
        NoActiveBattleError,
      );
    });
  });

  describe("UseBagItemUseCase", () => {
    it("heals HP from a POT, capped at max HP, and consumes the item", async () => {
      const { playerId, battle, playerMaxHp } = await setupBattle({ playerHp: maxHp(1, 10) - 10 });
      const potId = await createTestItem(sql, { name: "Test Pot", hpRestore: 9999 });
      const playerItemId = await createTestPlayerItem(sql, playerId, potId, { quantity: 1 });

      const uc = buildUseCases(sql, new FakeRng([0, 50]));
      await uc.battleRepository.create(battle);

      const result = await uc.useBagItemUseCase.execute({ playerId, playerItemId });

      expect(result.playerStatus.currentHp).toBe(playerMaxHp);
      expect(await uc.playerItemRepository.findById(playerItemId)).toBeNull();
    });

    it("cures bleed with a bandage by matching counterItemId", async () => {
      const { playerId, battle } = await setupBattle({ playerHp: 500 });
      // Look up the seeded bandage item so its id matches the DoT's counterItemId convention.
      const [bandage] = await sql<
        { id: string }[]
      >`select id from items where name = 'bandage' limit 1`;
      const playerItemId = await createTestPlayerItem(sql, playerId, bandage.id, { quantity: 1 });

      const battleWithBleed = Battle.create({
        ...battle.toProps(),
        playerEffects: [
          { type: "dot", kind: "bleed", damagePerRound: 3, counterItemId: bandage.id },
        ],
      });

      const uc = buildUseCases(sql, new FakeRng([0, 50]));
      await uc.battleRepository.create(battleWithBleed);

      await uc.useBagItemUseCase.execute({ playerId, playerItemId });

      const battleAfter = await uc.battleRepository.findByPlayerId(playerId);
      expect(battleAfter?.playerEffects.some((e) => e.type === "dot" && e.kind === "bleed")).toBe(
        false,
      );
    });

    it("rejects an item with no consumable use", async () => {
      const { playerId, battle } = await setupBattle({});
      const uselessItemId = await createTestItem(sql, { name: "Useless Trinket" });
      const playerItemId = await createTestPlayerItem(sql, playerId, uselessItemId, {
        quantity: 1,
      });

      const uc = buildUseCases(sql, new FakeRng([1]));
      await uc.battleRepository.create(battle);

      await expect(uc.useBagItemUseCase.execute({ playerId, playerItemId })).rejects.toBeInstanceOf(
        InvalidBagItemError,
      );
    });
  });

  describe("RestUseCase", () => {
    it("recovers 15 stamina (capped at max) and still lets the monster act", async () => {
      const { playerId, battle } = await setupBattle({});
      const uc = buildUseCases(sql, new FakeRng([0, 50]));
      await uc.battleRepository.create(battle);

      const result = await uc.restUseCase.execute({ playerId });

      expect(result.playerStatus.currentStamina).toBe(25); // min(maxStamina, 10 + 15)
      expect(result.outcome).toBe("ongoing");
    });
  });

  describe("ClaimLootUseCase", () => {
    it("claims a pick that fits into the bag", async () => {
      const userId = await createTestUser(sql);
      const playerId = await createTestPlayer(sql, userId);
      const itemId = await createTestItem(sql, { name: "Claimable Item" });
      await sql`update players set pending_loot = ${JSON.stringify([itemId])}::jsonb where id = ${playerId}`;

      const uc = buildUseCases(sql, new FakeRng([1]));
      const result = await uc.claimLootUseCase.execute({ playerId, isVip: false, picks: [itemId] });

      expect(result.claimed).toEqual([itemId]);
      expect(result.rejected).toEqual([]);

      const player = await uc.playerRepository.findById(playerId);
      expect(player?.pendingLoot).toEqual([]);
    });

    it("rejects a pick that doesn't fit a full bag, but leaves it pending", async () => {
      const userId = await createTestUser(sql);
      const playerId = await createTestPlayer(sql, userId);
      const itemId = await createTestItem(sql, { name: "Overflow Item" });
      await sql`update players set pending_loot = ${JSON.stringify([itemId])}::jsonb where id = ${playerId}`;

      for (let i = 0; i < 20; i++) {
        const fillerId = await createTestItem(sql, { name: `Filler ${i}-${playerId}` });
        await createTestPlayerItem(sql, playerId, fillerId, { quantity: 1 });
      }

      const uc = buildUseCases(sql, new FakeRng([1]));
      const result = await uc.claimLootUseCase.execute({ playerId, isVip: false, picks: [itemId] });

      expect(result.claimed).toEqual([]);
      expect(result.rejected).toHaveLength(1);

      const player = await uc.playerRepository.findById(playerId);
      expect(player?.pendingLoot).toEqual([itemId]);
    });

    it("throws when there is no pending loot", async () => {
      const userId = await createTestUser(sql);
      const playerId = await createTestPlayer(sql, userId);
      const uc = buildUseCases(sql, new FakeRng([1]));

      await expect(
        uc.claimLootUseCase.execute({ playerId, isVip: false, picks: [] }),
      ).rejects.toBeInstanceOf(NoPendingLootError);
    });

    it("throws when a pick isn't part of the current loot offer", async () => {
      const userId = await createTestUser(sql);
      const playerId = await createTestPlayer(sql, userId);
      const itemId = await createTestItem(sql, { name: "Offered Item" });
      const otherItemId = await createTestItem(sql, { name: "Not Offered" });
      await sql`update players set pending_loot = ${JSON.stringify([itemId])}::jsonb where id = ${playerId}`;

      const uc = buildUseCases(sql, new FakeRng([1]));

      await expect(
        uc.claimLootUseCase.execute({ playerId, isVip: false, picks: [otherItemId] }),
      ).rejects.toBeInstanceOf(InvalidLootPickError);
    });
  });
});
