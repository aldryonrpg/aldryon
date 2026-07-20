import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { SQL } from "bun";
import type { DungeonBoss } from "@/domain/dungeon/DungeonBoss";
import { PostgresDungeonBossRepository } from "@/infrastructure/persistence/PostgresDungeonBossRepository";
import { DungeonBossOfTheDayUseCase } from "@/usecase/dungeon/DungeonBossOfTheDayUseCase";
import type { DungeonBossRepository } from "@/usecase/dungeon/DungeonBossRepository";
import { buildUseCases } from "../support/buildUseCases";
import { bossNameForDay, nowForBoss } from "../support/dungeonBossRotation";
import { FakeRng } from "../support/FakeRng";
import { getSharedPostgresEnvironment } from "../support/sharedPostgresEnvironment";

/** Counts calls so a test can prove a cache hit never touches the upstream
 * repo, without mutating the shared migration-seeded boss row (other test
 * files depend on it staying intact). */
class CountingDungeonBossRepository implements DungeonBossRepository {
  calls = 0;
  constructor(private readonly real: DungeonBossRepository) {}
  async findById(id: string): Promise<DungeonBoss | null> {
    return this.real.findById(id);
  }
  async findAll(): Promise<DungeonBoss[]> {
    this.calls += 1;
    return this.real.findAll();
  }
}

describe("DungeonBossOfTheDayUseCase (integration)", () => {
  let sql: SQL;

  beforeAll(async () => {
    const env = await getSharedPostgresEnvironment();
    sql = new SQL(env.connectionUri);
  }, 120_000);

  afterAll(async () => {
    await sql.close();
  });

  it("materializes all 3 tiers up front from a single call for one of them", async () => {
    const base = buildUseCases(sql, new FakeRng([0]));
    const bosses = await new PostgresDungeonBossRepository(sql).findAll();
    const now = nowForBoss(bosses, "Dragon");
    const uc = new DungeonBossOfTheDayUseCase(
      base.dungeonBossRepository,
      base.monsterRepository,
      base.monsterAttackRepository,
      () => now,
    );

    const tier1 = await uc.getBossForTier(1);
    expect(tier1.name).toBe("Dragon — Tier 1");

    // Never asked for tier 2/3 yet — they should already exist in the DB
    // from that one call, not be materialized lazily on first request.
    const tier2Row = await base.monsterRepository.findByName("Dragon — Tier 2");
    const tier3Row = await base.monsterRepository.findByName("Dragon — Tier 3");
    expect(tier2Row).not.toBeNull();
    expect(tier3Row).not.toBeNull();
  });

  it("materializes into the dedicated 'dungeon' region, never a wild-battle-selectable one", async () => {
    const base = buildUseCases(sql, new FakeRng([0]));
    const bosses = await new PostgresDungeonBossRepository(sql).findAll();
    const now = nowForBoss(bosses, "Dragon");
    const uc = new DungeonBossOfTheDayUseCase(
      base.dungeonBossRepository,
      base.monsterRepository,
      base.monsterAttackRepository,
      () => now,
    );

    await uc.getBossForTier(1);

    // The real bug this guards against: a materialized boss row landing in
    // one of the 5 wild regions and being rolled into an ordinary
    // /battle/start encounter there.
    for (const region of ["mountain", "forest", "bandit", "sewage", "ruins"] as const) {
      const wildMonsters = await base.monsterRepository.findAllByRegion(region);
      expect(wildMonsters.some((m) => m.name.includes("— Tier"))).toBe(false);
    }

    const dungeonRegionMonsters = await base.monsterRepository.findAllByRegion("dungeon");
    expect(dungeonRegionMonsters.some((m) => m.name === "Dragon — Tier 1")).toBe(true);
  });

  it("serves every tier from the in-memory cache without re-querying the boss repo", async () => {
    const base = buildUseCases(sql, new FakeRng([0]));
    const bosses = await new PostgresDungeonBossRepository(sql).findAll();
    const now = nowForBoss(bosses, "Dragon");
    const countingBossRepo = new CountingDungeonBossRepository(base.dungeonBossRepository);
    const uc = new DungeonBossOfTheDayUseCase(
      countingBossRepo,
      base.monsterRepository,
      base.monsterAttackRepository,
      () => now,
    );

    const tier1First = await uc.getBossForTier(1);
    expect(countingBossRepo.calls).toBe(1);

    // Same tier again, and the other two tiers — all served from the one
    // cached set, no further upstream lookups.
    const tier1Again = await uc.getBossForTier(1);
    const tier2 = await uc.getBossForTier(2);
    const tier3 = await uc.getBossForTier(3);

    expect(countingBossRepo.calls).toBe(1);
    expect(tier1Again.id).toBe(tier1First.id);
    expect(tier2.name).toBe("Dragon — Tier 2");
    expect(tier3.name).toBe("Dragon — Tier 3");
  });

  it("refreshes exactly at the next UTC midnight, not a moment before", async () => {
    const base = buildUseCases(sql, new FakeRng([0]));
    const bosses = await new PostgresDungeonBossRepository(sql).findAll();
    const countingBossRepo = new CountingDungeonBossRepository(base.dungeonBossRepository);

    let now = Date.UTC(2026, 0, 15, 12, 0, 0); // 2026-01-15T12:00:00Z
    const uc = new DungeonBossOfTheDayUseCase(
      countingBossRepo,
      base.monsterRepository,
      base.monsterAttackRepository,
      () => now,
    );

    await uc.getBossForTier(1);
    expect(countingBossRepo.calls).toBe(1);

    // 1 ms before midnight — still cached.
    now = Date.UTC(2026, 0, 15, 23, 59, 59, 999);
    await uc.getBossForTier(2);
    expect(countingBossRepo.calls).toBe(1);

    // Exactly at midnight — cache has expired, re-fetches. With more than
    // one boss in the catalog the rotation index legitimately changes
    // across a real day boundary (consecutive days are never the same
    // index mod bosses.length once length > 1), so this asserts against
    // whichever boss production's own rotation formula would pick for the
    // new day — not assuming it's still the same one as before midnight.
    now = Date.UTC(2026, 0, 16, 0, 0, 0, 0);
    const refreshed = await uc.getBossForTier(3);
    expect(countingBossRepo.calls).toBe(2);
    expect(refreshed.name).toBe(`${bossNameForDay(bosses, now)} — Tier 3`);
  });
});
