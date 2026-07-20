import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { SQL } from "bun";
import { Battle } from "@/domain/battle/Battle";
import { maxHp } from "@/domain/battle/battleConfig";
import { computeDamage } from "@/domain/battle/services/DamageCalculator";
import {
  InvalidBagItemError,
  InvalidLootPickError,
  NoActiveBattleError,
  NoPendingLootError,
} from "@/usecase/battle/errors";
import { buildUseCases } from "../support/buildUseCases";
import { expectRejection } from "../support/expectRejection";
import { FakeRng } from "../support/FakeRng";
import { getSharedPostgresEnvironment } from "../support/sharedPostgresEnvironment";
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
  let sql: SQL;

  beforeAll(async () => {
    const env = await getSharedPostgresEnvironment();
    sql = new SQL(env.connectionUri);
  }, 120_000);

  afterAll(async () => {
    await sql.close();
  });

  async function setupBattle(overrides: {
    playerAgility?: number;
    monsterAgility?: number;
    playerHp?: number;
    playerStrength?: number;
    monsterStrength?: number;
    playerLuck?: number;
    monsterLuck?: number;
    monsterType?: "normal" | "poisonous";
  }) {
    const userId = await createTestUser(sql);
    const playerId = await createTestPlayer(sql, userId, {
      agility: overrides.playerAgility ?? 1,
      strength: overrides.playerStrength ?? 10,
      luck: overrides.playerLuck ?? 1,
    });
    const monsterId = await createTestMonster(sql, {
      agility: overrides.monsterAgility ?? 1,
      strength: overrides.monsterStrength ?? 1,
      luck: overrides.monsterLuck ?? 1,
      monsterType: overrides.monsterType ?? "normal",
    });
    const attackId = await createTestMonsterAttack(sql, { staminaCost: 0, multiplier: 1 });
    await linkMonsterMoveset(sql, monsterId, attackId);

    const playerMaxHp = maxHp(1, overrides.playerStrength ?? 10);
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
      monsterAttackWeights: {},
      statusCooldownRoundsLeft: 0,
      dungeonIsBossFight: false,
      revealedMonsterAttributes: [],
      dungeonTier: null,
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
        monsterStrength: 20,
        playerHp: 500,
      });
      const uc = buildUseCases(sql, new FakeRng([1]));
      await uc.battleRepository.create(battle);

      const result = await uc.runFromBattleUseCase.execute({ playerId });

      expect(result.outcome).toBe("fled");
      expect(result.monsterAttack?.hit).toBe(true);
      expect(result.playerStatus.currentHp).toBeLessThan(500);
    });

    it("can inflict the monster's innate effect on a parting hit (normal combat math applies)", async () => {
      const { playerId, battle } = await setupBattle({
        playerAgility: 1,
        monsterAgility: 10,
        monsterStrength: 20,
        playerHp: 500,
        monsterLuck: 25,
        playerLuck: 1,
        monsterType: "poisonous",
      });
      // Only the effect-proc roll is consumed (the parting hit itself never
      // rolls to-hit) — roll=20 lands against a 24-point Luck lead.
      const uc = buildUseCases(sql, new FakeRng([20]));
      await uc.battleRepository.create(battle);

      const result = await uc.runFromBattleUseCase.execute({ playerId });

      expect(result.outcome).toBe("fled");
      expect(result.monsterAttack?.hit).toBe(true);
      // DoT procs carry no narrative message in this codebase's convention
      // (only Fear/Magic Aura Blast/Stun do — see effectAppliedMessage) —
      // effectApplied is the actual assertion this test exists to cover.
      expect(result.monsterAttack?.effectApplied).toBe("poison");
    });

    it("triggers the death settlement when a fatal parting hit lands", async () => {
      const { playerId, battle } = await setupBattle({
        playerAgility: 1,
        monsterAgility: 10,
        monsterStrength: 50,
        playerHp: 1,
        playerStrength: 1,
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

      await expectRejection(uc.runFromBattleUseCase.execute({ playerId }), NoActiveBattleError);
    });
  });

  describe("UseBagItemUseCase", () => {
    it("heals HP from a POT, capped at max HP, and consumes the item", async () => {
      const { playerId, battle, playerMaxHp } = await setupBattle({ playerHp: maxHp(1, 10) - 10 });
      const potId = await createTestItem(sql, { name: "Test Pot", hpRestore: 9999 });
      const playerItemId = await createTestPlayerItem(sql, playerId, potId, { quantity: 1 });

      // Attack selection is deterministic (only one moveset entry), so the
      // single rng value below is the monster's effect-proc roll; 50 fails
      // it (diff 0) so no bleed lands — but the monster still lands its own
      // direct attack this same turn, chipping the just-healed max back down
      // (a landed hit always deals at least 1 damage — combat-balance
      // follow-up).
      const uc = buildUseCases(sql, new FakeRng([50]));
      await uc.battleRepository.create(battle);

      const result = await uc.useBagItemUseCase.execute({ playerId, playerItemId });

      const expectedMonsterDamage = computeDamage({
        attackMultiplier: 1, // the moveset's Test Attack
        attackerScalingValue: 1, // monster strength
        staminaCost: 0,
        defenderLevel: 1, // player level
        defenderScalingValue: 10, // player's HIT-scaling attribute (strength)
      });
      expect(result.playerStatus.currentHp).toBe(playerMaxHp - expectedMonsterDamage);
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

      // 50 fails the monster's effect-proc roll (diff 0), so a fresh bleed
      // doesn't land right after the bandage clears the old one.
      const uc = buildUseCases(sql, new FakeRng([50]));
      await uc.battleRepository.create(battleWithBleed);

      await uc.useBagItemUseCase.execute({ playerId, playerItemId });

      const battleAfter = await uc.battleRepository.findByPlayerId(playerId);
      expect(battleAfter?.playerEffects.some((e) => e.type === "dot" && e.kind === "bleed")).toBe(
        false,
      );
    });

    it("stacks unlimited repeated bleed procs, then clears all of them with a single bandage", async () => {
      const { playerId, battle } = await setupBattle({ playerHp: 500 });
      const [bandage] = await sql<
        { id: string }[]
      >`select id from items where name = 'bandage' limit 1`;
      const playerItemId = await createTestPlayerItem(sql, playerId, bandage.id, { quantity: 1 });

      const battleWithStackedBleed = Battle.create({
        ...battle.toProps(),
        playerEffects: [
          { type: "dot", kind: "bleed", damagePerRound: 3, counterItemId: bandage.id },
          { type: "dot", kind: "bleed", damagePerRound: 3, counterItemId: bandage.id },
          { type: "dot", kind: "bleed", damagePerRound: 3, counterItemId: bandage.id },
        ],
      });

      // 50 fails the monster's effect-proc roll (diff 0), so no new bleed
      // lands right after the bandage clears all three stacked ones.
      const uc = buildUseCases(sql, new FakeRng([50]));
      await uc.battleRepository.create(battleWithStackedBleed);

      await uc.useBagItemUseCase.execute({ playerId, playerItemId });

      const battleAfter = await uc.battleRepository.findByPlayerId(playerId);
      expect(
        battleAfter?.playerEffects.filter((e) => e.type === "dot" && e.kind === "bleed"),
      ).toEqual([]);
    });

    it("rejects an item with no consumable use", async () => {
      const { playerId, battle } = await setupBattle({});
      const uselessItemId = await createTestItem(sql, { name: "Useless Trinket" });
      const playerItemId = await createTestPlayerItem(sql, playerId, uselessItemId, {
        quantity: 1,
      });

      const uc = buildUseCases(sql, new FakeRng([1]));
      await uc.battleRepository.create(battle);

      await expectRejection(
        uc.useBagItemUseCase.execute({ playerId, playerItemId }),
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
      await sql`update players set pending_loot = ${[itemId]}::jsonb where id = ${playerId}`;

      const uc = buildUseCases(sql, new FakeRng([1]));
      const result = await uc.claimLootUseCase.execute({ playerId, picks: [itemId] });

      expect(result.claimed).toEqual([itemId]);
      expect(result.rejected).toEqual([]);

      const player = await uc.playerRepository.findById(playerId);
      expect(player?.pendingLoot).toEqual([]);
    });

    it("rejects a pick that doesn't fit a full bag, but leaves it pending", async () => {
      const userId = await createTestUser(sql);
      const playerId = await createTestPlayer(sql, userId);
      const itemId = await createTestItem(sql, { name: "Overflow Item" });
      await sql`update players set pending_loot = ${[itemId]}::jsonb where id = ${playerId}`;

      for (let i = 0; i < 20; i++) {
        const fillerId = await createTestItem(sql, { name: `Filler ${i}-${playerId}` });
        await createTestPlayerItem(sql, playerId, fillerId, { quantity: 1 });
      }

      const uc = buildUseCases(sql, new FakeRng([1]));
      const result = await uc.claimLootUseCase.execute({ playerId, picks: [itemId] });

      expect(result.claimed).toEqual([]);
      expect(result.rejected).toHaveLength(1);

      const player = await uc.playerRepository.findById(playerId);
      expect(player?.pendingLoot).toEqual([itemId]);
    });

    it("accepts a VIP's 21st stack, where the same bag would reject a normal player", async () => {
      const userId = await createTestUser(sql);
      const playerId = await createTestPlayer(sql, userId, { isVip: true });
      const itemId = await createTestItem(sql, { name: "VIP Overflow Item" });
      await sql`update players set pending_loot = ${[itemId]}::jsonb where id = ${playerId}`;

      for (let i = 0; i < 20; i++) {
        const fillerId = await createTestItem(sql, { name: `VIP Filler ${i}-${playerId}` });
        await createTestPlayerItem(sql, playerId, fillerId, { quantity: 1 });
      }

      const uc = buildUseCases(sql, new FakeRng([1]));
      const result = await uc.claimLootUseCase.execute({ playerId, picks: [itemId] });

      expect(result.claimed).toEqual([itemId]);
      expect(result.rejected).toEqual([]);

      const player = await uc.playerRepository.findById(playerId);
      expect(player?.pendingLoot).toEqual([]);
    });

    it("still rejects a VIP's 26th stack — the 25-slot cap is a hard ceiling", async () => {
      const userId = await createTestUser(sql);
      const playerId = await createTestPlayer(sql, userId, { isVip: true });
      const itemId = await createTestItem(sql, { name: "VIP Full Bag Item" });
      await sql`update players set pending_loot = ${[itemId]}::jsonb where id = ${playerId}`;

      for (let i = 0; i < 25; i++) {
        const fillerId = await createTestItem(sql, { name: `VIP Full Filler ${i}-${playerId}` });
        await createTestPlayerItem(sql, playerId, fillerId, { quantity: 1 });
      }

      const uc = buildUseCases(sql, new FakeRng([1]));
      const result = await uc.claimLootUseCase.execute({ playerId, picks: [itemId] });

      expect(result.claimed).toEqual([]);
      expect(result.rejected).toHaveLength(1);

      const player = await uc.playerRepository.findById(playerId);
      expect(player?.pendingLoot).toEqual([itemId]);
    });

    it("throws when there is no pending loot", async () => {
      const userId = await createTestUser(sql);
      const playerId = await createTestPlayer(sql, userId);
      const uc = buildUseCases(sql, new FakeRng([1]));

      await expectRejection(
        uc.claimLootUseCase.execute({ playerId, picks: [] }),
        NoPendingLootError,
      );
    });

    it("throws when a pick isn't part of the current loot offer", async () => {
      const userId = await createTestUser(sql);
      const playerId = await createTestPlayer(sql, userId);
      const itemId = await createTestItem(sql, { name: "Offered Item" });
      const otherItemId = await createTestItem(sql, { name: "Not Offered" });
      await sql`update players set pending_loot = ${[itemId]}::jsonb where id = ${playerId}`;

      const uc = buildUseCases(sql, new FakeRng([1]));

      await expectRejection(
        uc.claimLootUseCase.execute({ playerId, picks: [otherItemId] }),
        InvalidLootPickError,
      );
    });
  });

  describe("ClaimLootUseCase — POT special slot (small/medium/big share one cap)", () => {
    async function potIds(sql: SQL) {
      const uc = buildUseCases(sql, new FakeRng([1]));
      const [small, medium, big] = await Promise.all([
        uc.itemRepository.findByName("small pot"),
        uc.itemRepository.findByName("medium pot"),
        uc.itemRepository.findByName("big pot"),
      ]);
      if (!small || !medium || !big)
        throw new Error("Seeded POT items not found — did migrations run?");
      return { smallId: small.id, mediumId: medium.id, bigId: big.id };
    }

    it("claims a mix of all 3 POT types up to the combined POT_LIMIT (5), each its own stack", async () => {
      const { smallId, mediumId, bigId } = await potIds(sql);
      const userId = await createTestUser(sql);
      const playerId = await createTestPlayer(sql, userId);
      const picks = [smallId, smallId, mediumId, mediumId, bigId];
      await sql`update players set pending_loot = ${picks}::jsonb where id = ${playerId}`;

      const uc = buildUseCases(sql, new FakeRng([1]));
      const result = await uc.claimLootUseCase.execute({ playerId, picks });

      expect(result.claimed).toEqual(picks);
      expect(result.rejected).toEqual([]);

      const playerItems = await uc.playerItemRepository.findByPlayerId(playerId);
      const bySmall = playerItems.find((pi) => pi.itemId === smallId);
      const byMedium = playerItems.find((pi) => pi.itemId === mediumId);
      const byBig = playerItems.find((pi) => pi.itemId === bigId);
      expect(bySmall?.quantity).toBe(2);
      expect(byMedium?.quantity).toBe(2);
      expect(byBig?.quantity).toBe(1);
    });

    it("rejects a different POT type once the combined total already sits at the cap", async () => {
      const { smallId, mediumId } = await potIds(sql);
      const userId = await createTestUser(sql);
      const playerId = await createTestPlayer(sql, userId);
      await createTestPlayerItem(sql, playerId, smallId, { quantity: 5 });
      await sql`update players set pending_loot = ${[mediumId]}::jsonb where id = ${playerId}`;

      const uc = buildUseCases(sql, new FakeRng([1]));
      const result = await uc.claimLootUseCase.execute({
        playerId,
        picks: [mediumId],
      });

      expect(result.claimed).toEqual([]);
      expect(result.rejected).toEqual([
        { itemId: mediumId, reason: "POT slot is full (max 5 combined)" },
      ]);
    });

    it("rejects once a mix across types already sums to the cap", async () => {
      const { smallId, mediumId, bigId } = await potIds(sql);
      const userId = await createTestUser(sql);
      const playerId = await createTestPlayer(sql, userId);
      await createTestPlayerItem(sql, playerId, smallId, { quantity: 3 });
      await createTestPlayerItem(sql, playerId, mediumId, { quantity: 2 });
      await sql`update players set pending_loot = ${[bigId]}::jsonb where id = ${playerId}`;

      const uc = buildUseCases(sql, new FakeRng([1]));
      const result = await uc.claimLootUseCase.execute({ playerId, picks: [bigId] });

      expect(result.claimed).toEqual([]);
      expect(result.rejected).toHaveLength(1);
    });

    it("POTs don't count against the ordinary 20-slot bag capacity", async () => {
      const { smallId } = await potIds(sql);
      const userId = await createTestUser(sql);
      const playerId = await createTestPlayer(sql, userId);
      for (let i = 0; i < 20; i++) {
        const fillerId = await createTestItem(sql, { name: `POT-test Filler ${i}-${playerId}` });
        await createTestPlayerItem(sql, playerId, fillerId, { quantity: 1 });
      }
      await sql`update players set pending_loot = ${[smallId]}::jsonb where id = ${playerId}`;

      const uc = buildUseCases(sql, new FakeRng([1]));
      const result = await uc.claimLootUseCase.execute({
        playerId,
        picks: [smallId],
      });

      expect(result.claimed).toEqual([smallId]);
      expect(result.rejected).toEqual([]);
    });
  });
});
