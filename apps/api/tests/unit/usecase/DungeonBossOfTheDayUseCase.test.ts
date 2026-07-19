import { describe, expect, it } from "bun:test";
import type { DungeonBoss } from "@/domain/dungeon/DungeonBoss";
import type { Monster } from "@/domain/monster/Monster";
import type { AttributeValues } from "@/domain/shared/Attributes";
import { DungeonBossOfTheDayUseCase } from "@/usecase/dungeon/DungeonBossOfTheDayUseCase";
import type { DungeonBossRepository } from "@/usecase/dungeon/DungeonBossRepository";
import type { MonsterAttackRepository } from "@/usecase/monster/MonsterAttackRepository";
import type { MonsterRepository } from "@/usecase/monster/MonsterRepository";

const BASE_ATTRIBUTES: AttributeValues = {
  strength: 10,
  dexterity: 10,
  agility: 10,
  intelligence: 10,
  vitality: 10,
  luck: 10,
};

function makeBoss(name: string): DungeonBoss {
  return {
    id: name,
    name,
    description: "test",
    monsterImage: "/x.png",
    monsterType: "normal",
    baseHp: 100,
    baseXpGain: 50,
    baseMaxStamina: 100,
    baseAttributes: BASE_ATTRIBUTES,
    drops: [],
    exclusiveDrops: [],
    legendaryDrops: [],
  } as unknown as DungeonBoss;
}

class FakeDungeonBossRepository implements DungeonBossRepository {
  constructor(private readonly bosses: DungeonBoss[]) {}
  async findById(id: string) {
    return this.bosses.find((b) => b.id === id) ?? null;
  }
  async findAll() {
    return [...this.bosses];
  }
}

class FakeMonsterRepository implements MonsterRepository {
  byName = new Map<string, Monster>();
  deleteCalls: string[] = [];
  async findById(id: string) {
    return [...this.byName.values()].find((m) => m.id === id) ?? null;
  }
  async findByName(name: string) {
    return this.byName.get(name) ?? null;
  }
  async findAllByRegion() {
    return [];
  }
  async findAllExcludingMaterializedBosses() {
    return [];
  }
  async create(monster: Monster) {
    this.byName.set(monster.name, monster);
    return monster;
  }
  async deleteStaleDungeonBossRows(currentBossName: string) {
    this.deleteCalls.push(currentBossName);
    const prefix = `${currentBossName} — Tier `;
    for (const name of [...this.byName.keys()]) {
      if (!name.startsWith(prefix)) this.byName.delete(name);
    }
  }
}

class FakeMonsterAttackRepository implements MonsterAttackRepository {
  async findById() {
    return null;
  }
  async findMovesetByMonsterId() {
    return [];
  }
  async copyDungeonBossMoveset() {}
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

describe("DungeonBossOfTheDayUseCase — deterministic date-based rotation", () => {
  it("always resolves to the same boss on the same day, with a single boss", async () => {
    const bossRepo = new FakeDungeonBossRepository([makeBoss("Dragon")]);
    const uc = new DungeonBossOfTheDayUseCase(
      bossRepo,
      new FakeMonsterRepository(),
      new FakeMonsterAttackRepository(),
      () => Date.UTC(2026, 0, 15, 12, 0, 0),
    );

    const boss = await uc.getBossForTier(1);
    expect(boss.name).toBe("Dragon — Tier 1");
  });

  it("picks a different boss on a different day once more than one exists", async () => {
    // Two bosses, ordered as findAll() (Postgres impl orders by name asc)
    // would: Alpha, Bravo. dayIndex = floor(now/MS_PER_DAY) % 2.
    const bosses = [makeBoss("Alpha"), makeBoss("Bravo")];
    let now = 0;

    const dayA = new DungeonBossOfTheDayUseCase(
      new FakeDungeonBossRepository(bosses),
      new FakeMonsterRepository(),
      new FakeMonsterAttackRepository(),
      () => now,
    );
    const dayIndexA = Math.floor(now / MS_PER_DAY) % 2;
    const bossA = await dayA.getBossForTier(1);
    expect(bossA.name).toBe(`${bosses[dayIndexA]?.name} — Tier 1`);

    // Advance by exactly one day — a fresh use case instance (fresh cache),
    // same underlying deterministic formula.
    now += MS_PER_DAY;
    const dayB = new DungeonBossOfTheDayUseCase(
      new FakeDungeonBossRepository(bosses),
      new FakeMonsterRepository(),
      new FakeMonsterAttackRepository(),
      () => now,
    );
    const dayIndexB = Math.floor(now / MS_PER_DAY) % 2;
    const bossB = await dayB.getBossForTier(1);
    expect(bossB.name).toBe(`${bosses[dayIndexB]?.name} — Tier 1`);

    // With exactly 2 bosses, consecutive days always land on different ones.
    expect(bossA.name).not.toBe(bossB.name);
  });

  it("every process/replica computes the same answer independently — no shared state needed", async () => {
    const bosses = [makeBoss("Alpha"), makeBoss("Bravo"), makeBoss("Charlie")];
    const now = Date.UTC(2026, 5, 1, 8, 0, 0);

    // Two entirely separate use-case instances (own cache, own fake repos —
    // simulating two Render replicas that never talk to each other).
    const replicaA = new DungeonBossOfTheDayUseCase(
      new FakeDungeonBossRepository(bosses),
      new FakeMonsterRepository(),
      new FakeMonsterAttackRepository(),
      () => now,
    );
    const replicaB = new DungeonBossOfTheDayUseCase(
      new FakeDungeonBossRepository(bosses),
      new FakeMonsterRepository(),
      new FakeMonsterAttackRepository(),
      () => now,
    );

    const bossFromA = await replicaA.getBossForTier(2);
    const bossFromB = await replicaB.getBossForTier(2);

    expect(bossFromA.name).toBe(bossFromB.name);
  });

  it("retires yesterday's materialized rows once today's are confirmed", async () => {
    const monsterRepo = new FakeMonsterRepository();
    const uc = new DungeonBossOfTheDayUseCase(
      new FakeDungeonBossRepository([makeBoss("Dragon")]),
      monsterRepo,
      new FakeMonsterAttackRepository(),
      () => Date.UTC(2026, 0, 15),
    );

    await uc.getBossForTier(1);

    expect(monsterRepo.deleteCalls).toHaveLength(1);
    expect(monsterRepo.deleteCalls[0]).toBe("Dragon");
  });
});
