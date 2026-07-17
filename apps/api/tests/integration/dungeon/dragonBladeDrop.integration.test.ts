import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { SQL } from "bun";
import { Battle } from "@/domain/battle/Battle";
import { maxHp } from "@/domain/battle/battleConfig";
import { buildUseCases } from "../support/buildUseCases";
import { FakeRng } from "../support/FakeRng";
import { getSharedPostgresEnvironment } from "../support/sharedPostgresEnvironment";
import { createTestPlayer, createTestUser, setPlayerDungeonRun } from "../support/testFixtures";

/**
 * End-to-end: the Dragon's exclusive unique drop, Dragon Blade, is seeded
 * at dropRate 1000 (guaranteed under the legendary pool's per-mille scale)
 * specifically so this ownership-uniqueness guarantee is deterministic to
 * test — kill the materialized tier-1 Dragon once and confirm Dragon Blade
 * drops; kill it again (a second player, same materialized boss row) and
 * confirm it does NOT drop a second time, proving the atomic ownership
 * claim actually holds.
 */
describe("Dragon Blade unique drop (integration)", () => {
  let sql: SQL;

  beforeAll(async () => {
    const env = await getSharedPostgresEnvironment();
    sql = new SQL(env.connectionUri);
  }, 120_000);

  afterAll(async () => {
    await sql.close();
  });

  async function materializedDragonTier1(sql: SQL) {
    const setupUserId = await createTestUser(sql);
    const setupPlayerId = await createTestPlayer(sql, setupUserId, { level: 12 });
    await setPlayerDungeonRun(sql, setupPlayerId, 1, 1, 1);
    const uc = buildUseCases(sql, new FakeRng([1, 0]));
    const result = await uc.continueDungeonUseCase.execute({ playerId: setupPlayerId });
    await uc.battleRepository.deleteByPlayerId(setupPlayerId);
    if (!result.monster) throw new Error("Boss materialization failed");
    return result.monster.id;
  }

  async function oneHitKillBattle(playerId: string, bossMonsterId: string) {
    const playerMaxHp = maxHp(1, 20);
    return Battle.create({
      id: Bun.randomUUIDv7(),
      playerId,
      monsterId: bossMonsterId,
      playerCurrentHp: playerMaxHp,
      playerCurrentStamina: 10,
      monsterCurrentHp: 1,
      monsterCurrentStamina: 200,
      round: 1,
      playerEffects: [],
      monsterEffects: [],
      monsterChargingAttackId: null,
      chargeRoundsLeft: 0,
      monsterAttackWeights: {},
      statusCooldownRoundsLeft: 0,
      dungeonTier: 1,
      dungeonIsBossFight: true,
      revealedMonsterAttributes: [],
    });
  }

  it("drops Dragon Blade on the first kill, and claims global ownership", async () => {
    const bossMonsterId = await materializedDragonTier1(sql);
    const dragonBlade = await sql<
      { id: string }[]
    >`select id from items where name = 'Dragon Blade' limit 1`;
    const dragonBladeId = dragonBlade[0]?.id;
    if (!dragonBladeId) throw new Error("Seeded Dragon Blade item not found — did migrations run?");

    const userId = await createTestUser(sql);
    // dexterity=20 matches the Dragon's own -> hit chance (dex/dex)*100=100,
    // guaranteed hit with zero rng consumed for the strike itself. strength is
    // absurdly high so HIT's damage clears the Dragon's defense (level 10 *
    // its stance's scaling attribute, up to intelligence 50 = 500) no matter
    // which of its 3 moveset attacks resolves as its defensive stance.
    const playerId = await createTestPlayer(sql, userId, {
      level: 12,
      dexterity: 20,
      strength: 5000,
    });
    const battle = await oneHitKillBattle(playerId, bossMonsterId);
    // roll1=1 (legendary pool dropRate check, always succeeds at dropRate
    // 1000), roll2=0 (winner-index pick, the only success).
    const uc = buildUseCases(sql, new FakeRng([1, 0]));
    await uc.battleRepository.create(battle);

    const result = await uc.attackUseCase.execute({ playerId, attackName: "HIT" });

    expect(result.outcome).toBe("won");
    expect(result.lootOffer).toContain(dragonBladeId);

    const ownership = await sql<
      { current_owner_player_id: string | null }[]
    >`select current_owner_player_id from unique_item_ownership where item_id = ${dragonBladeId}`;
    expect(ownership[0]?.current_owner_player_id).toBe(playerId);
  });

  it("does not drop a second time once already owned", async () => {
    const bossMonsterId = await materializedDragonTier1(sql);
    const dragonBlade = await sql<
      { id: string }[]
    >`select id from items where name = 'Dragon Blade' limit 1`;
    const dragonBladeId = dragonBlade[0]?.id;
    if (!dragonBladeId) throw new Error("Seeded Dragon Blade item not found — did migrations run?");

    // Guarantee it's already owned by someone (independent of the previous
    // test's execution order within this file).
    const priorOwnerUserId = await createTestUser(sql);
    const priorOwnerPlayerId = await createTestPlayer(sql, priorOwnerUserId);
    await sql`
      insert into unique_item_ownership (item_id, current_owner_player_id, owner_history)
      values (${dragonBladeId}, ${priorOwnerPlayerId}, '[]'::jsonb)
      on conflict (item_id) do update set current_owner_player_id = excluded.current_owner_player_id
      where unique_item_ownership.current_owner_player_id is null
    `;

    const userId = await createTestUser(sql);
    const playerId = await createTestPlayer(sql, userId, {
      level: 12,
      dexterity: 20,
      strength: 5000,
    });
    const battle = await oneHitKillBattle(playerId, bossMonsterId);
    const uc = buildUseCases(sql, new FakeRng([1, 0]));
    await uc.battleRepository.create(battle);

    const result = await uc.attackUseCase.execute({ playerId, attackName: "HIT" });

    expect(result.outcome).toBe("won");
    expect(result.lootOffer).not.toContain(dragonBladeId);
  });
});
