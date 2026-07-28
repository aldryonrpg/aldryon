import { describe, expect, it } from "bun:test";
import { Monster } from "@/domain/monster/Monster";
import type { MonsterAttack } from "@/domain/monster/MonsterAttack";
import type { AttributeValues } from "@/domain/shared/Attributes";
import type { MonsterAttackRepository } from "@/usecase/monster/MonsterAttackRepository";
import { MonsterCatalogCache } from "@/usecase/monster/MonsterCatalogCache";
import type { MonsterRepository } from "@/usecase/monster/MonsterRepository";

const ATTRIBUTES: AttributeValues = {
  strength: 5,
  dexterity: 5,
  agility: 5,
  intelligence: 5,
  vitality: 5,
  luck: 5,
};

function makeMonster(overrides: Partial<{ hp: number }> = {}): Monster {
  return Monster.create({
    id: "monster-1",
    name: "Test Slime",
    description: "test",
    region: "mountain",
    monsterImage: "/x.png",
    hp: overrides.hp ?? 100,
    xpGain: 10,
    level: 1,
    maxStamina: 100,
    attributes: ATTRIBUTES,
    monsterType: "normal",
    drops: [],
    exclusiveDrops: [],
    legendaryDrops: [],
    ambushChance: 0,
  });
}

class CountingMonsterRepository implements MonsterRepository {
  calls = 0;
  constructor(private monster: Monster) {}
  async findById() {
    this.calls++;
    return this.monster;
  }
  async findByName() {
    return this.monster;
  }
  async findAllByRegion() {
    return [this.monster];
  }
  async findAllExcludingMaterializedBosses() {
    return [this.monster];
  }
  async create(monster: Monster) {
    return monster;
  }
  async update(monster: Monster) {
    return monster;
  }
  async findUpdatedAtByIds() {
    return {};
  }
  async deleteStaleDungeonBossRows() {}
  setMonster(monster: Monster) {
    this.monster = monster;
  }
}

class FakeMonsterAttackRepository implements MonsterAttackRepository {
  async findById() {
    return null;
  }
  async findMovesetByMonsterId(): Promise<MonsterAttack[]> {
    return [];
  }
  async copyDungeonBossMoveset() {}
}

describe("MonsterCatalogCache.evict", () => {
  it("re-fetches from the repository after eviction instead of serving the stale cached row", async () => {
    const original = makeMonster({ hp: 100 });
    const repository = new CountingMonsterRepository(original);
    const cache = new MonsterCatalogCache(repository, new FakeMonsterAttackRepository());

    const first = await cache.getMonster("monster-1");
    expect(first?.hp).toBe(100);
    expect(repository.calls).toBe(1);

    const second = await cache.getMonster("monster-1");
    expect(second?.hp).toBe(100);
    expect(repository.calls).toBe(1);

    const updated = makeMonster({ hp: 250 });
    repository.setMonster(updated);
    cache.evict("monster-1");

    const third = await cache.getMonster("monster-1");
    expect(third?.hp).toBe(250);
    expect(repository.calls).toBe(2);
  });
});
