import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { SQL } from "bun";
import type { DungeonBoss } from "@/domain/dungeon/DungeonBoss";
import type { DungeonEncounter } from "@/domain/dungeon/DungeonEncounter";
import { DungeonBossOfTheDayUseCase } from "@/usecase/dungeon/DungeonBossOfTheDayUseCase";
import type { DungeonBossRepository } from "@/usecase/dungeon/DungeonBossRepository";
import type { DungeonEncounterRepository } from "@/usecase/dungeon/DungeonEncounterRepository";
import { buildUseCases } from "../support/buildUseCases";
import { FakeRng } from "../support/FakeRng";
import { getSharedPostgresEnvironment } from "../support/sharedPostgresEnvironment";

/** Counts calls so a test can prove a cache hit never touches the upstream
 * repos, without mutating the shared migration-seeded encounter/boss rows
 * (other test files depend on those staying intact). */
class CountingDungeonEncounterRepository implements DungeonEncounterRepository {
  calls = 0;
  constructor(private readonly real: DungeonEncounterRepository) {}
  async findOne(): Promise<DungeonEncounter | null> {
    this.calls += 1;
    return this.real.findOne();
  }
}

class CountingDungeonBossRepository implements DungeonBossRepository {
  calls = 0;
  constructor(private readonly real: DungeonBossRepository) {}
  async findById(id: string): Promise<DungeonBoss | null> {
    this.calls += 1;
    return this.real.findById(id);
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
    const uc = new DungeonBossOfTheDayUseCase(
      base.dungeonEncounterRepository,
      base.dungeonBossRepository,
      base.monsterRepository,
      base.monsterAttackRepository,
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

  it("serves every tier from the in-memory cache without re-querying the encounter/boss repos", async () => {
    const base = buildUseCases(sql, new FakeRng([0]));
    const countingEncounterRepo = new CountingDungeonEncounterRepository(
      base.dungeonEncounterRepository,
    );
    const countingBossRepo = new CountingDungeonBossRepository(base.dungeonBossRepository);
    const uc = new DungeonBossOfTheDayUseCase(
      countingEncounterRepo,
      countingBossRepo,
      base.monsterRepository,
      base.monsterAttackRepository,
    );

    const tier1First = await uc.getBossForTier(1);
    expect(countingEncounterRepo.calls).toBe(1);
    expect(countingBossRepo.calls).toBe(1);

    // Same tier again, and the other two tiers — all served from the one
    // cached set, no further upstream lookups.
    const tier1Again = await uc.getBossForTier(1);
    const tier2 = await uc.getBossForTier(2);
    const tier3 = await uc.getBossForTier(3);

    expect(countingEncounterRepo.calls).toBe(1);
    expect(countingBossRepo.calls).toBe(1);
    expect(tier1Again.id).toBe(tier1First.id);
    expect(tier2.name).toBe("Dragon — Tier 2");
    expect(tier3.name).toBe("Dragon — Tier 3");
  });

  it("refreshes exactly at the next UTC midnight, not a moment before", async () => {
    const base = buildUseCases(sql, new FakeRng([0]));
    const countingEncounterRepo = new CountingDungeonEncounterRepository(
      base.dungeonEncounterRepository,
    );
    const countingBossRepo = new CountingDungeonBossRepository(base.dungeonBossRepository);

    let now = Date.UTC(2026, 0, 15, 12, 0, 0); // 2026-01-15T12:00:00Z
    const uc = new DungeonBossOfTheDayUseCase(
      countingEncounterRepo,
      countingBossRepo,
      base.monsterRepository,
      base.monsterAttackRepository,
      () => now,
    );

    await uc.getBossForTier(1);
    expect(countingEncounterRepo.calls).toBe(1);

    // 1 ms before midnight — still cached.
    now = Date.UTC(2026, 0, 15, 23, 59, 59, 999);
    await uc.getBossForTier(2);
    expect(countingEncounterRepo.calls).toBe(1);

    // Exactly at midnight — cache has expired, re-fetches (idempotent
    // materialize-or-reuse still returns the same DB row).
    now = Date.UTC(2026, 0, 16, 0, 0, 0, 0);
    const refreshed = await uc.getBossForTier(3);
    expect(countingEncounterRepo.calls).toBe(2);
    expect(countingBossRepo.calls).toBe(2);
    expect(refreshed.name).toBe("Dragon — Tier 3");
  });
});
