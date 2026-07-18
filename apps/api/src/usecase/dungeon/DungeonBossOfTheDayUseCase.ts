import type { DungeonBoss } from "@/domain/dungeon/DungeonBoss";
import { DUNGEON_CONFIG } from "@/domain/dungeon/dungeonConfig";
import { scaleDungeonBossStats } from "@/domain/dungeon/scaleDungeonBossStats";
import { Monster } from "@/domain/monster/Monster";
import { msUntilNextUtcMidnight, TtlCache } from "@/domain/shared/TtlCache";
import type { DungeonBossRepository } from "@/usecase/dungeon/DungeonBossRepository";
import type { DungeonEncounterRepository } from "@/usecase/dungeon/DungeonEncounterRepository";
import type { MonsterAttackRepository } from "@/usecase/monster/MonsterAttackRepository";
import type { MonsterRepository } from "@/usecase/monster/MonsterRepository";

// Materialized dungeon-boss monster rows need a region to satisfy the
// monsters table's NOT NULL constraint, even though they're never reached
// via an ordinary /battle/start region roll. Picked once, arbitrarily;
// thematically fits a Dragon.
const MATERIALIZED_BOSS_REGION = "mountain" as const;

type TierBosses = Record<1 | 2 | 3, Monster>;

/**
 * Picks the single dungeon boss active "today" and materializes all 3
 * tier-scaled monster rows for it up front, caching the full set in memory
 * until exactly the next UTC midnight — every dungeon-boss reveal for the
 * rest of the day, across every player and every tier, reuses the same
 * cached rows instead of re-querying/re-materializing per request. There's
 * no scheduler driving the refresh — it's purely lazy: whichever request
 * happens to land first after midnight pays the one-time cost of
 * re-materializing (idempotent — see materializeOrReuseTier) and re-caches
 * for the rest of the new day.
 *
 * "Choosing" today's boss is currently just `dungeonEncounterRepository
 * .findOne()` (plan3 §2c's one pairing row, which never rotates on its
 * own) — there's only ever been one seeded boss, so this always resolves
 * to the same one. The seam lives here specifically so a future daily
 * rotation across a pool of bosses only has to change this one lookup,
 * without touching any battle/turn usecase that consumes the result.
 */
export class DungeonBossOfTheDayUseCase {
  private readonly cache: TtlCache<TierBosses>;

  constructor(
    private readonly dungeonEncounterRepository: DungeonEncounterRepository,
    private readonly dungeonBossRepository: DungeonBossRepository,
    private readonly monsterRepository: MonsterRepository,
    private readonly monsterAttackRepository: MonsterAttackRepository,
    private readonly now: () => number = Date.now,
  ) {
    // The 24h ctor arg is just a fallback default; every real `.set()`
    // below passes its own end-of-day override.
    this.cache = new TtlCache<TierBosses>(24 * 60 * 60 * 1000, now);
  }

  async getBossForTier(tier: 1 | 2 | 3): Promise<Monster> {
    const cached = this.cache.get();
    if (cached) return cached[tier];

    const bosses = await this.materializeAllTiers();
    this.cache.set(bosses, msUntilNextUtcMidnight(this.now));
    return bosses[tier];
  }

  private async materializeAllTiers(): Promise<TierBosses> {
    const encounter = await this.dungeonEncounterRepository.findOne();
    if (!encounter) throw new Error("No dungeon encounter configured");

    const dungeonBoss = await this.dungeonBossRepository.findById(encounter.dungeonBossId);
    if (!dungeonBoss) throw new Error("Dungeon boss not found");

    const [tier1, tier2, tier3] = await Promise.all([
      this.materializeOrReuseTier(dungeonBoss, 1),
      this.materializeOrReuseTier(dungeonBoss, 2),
      this.materializeOrReuseTier(dungeonBoss, 3),
    ]);
    return { 1: tier1, 2: tier2, 3: tier3 };
  }

  private async materializeOrReuseTier(
    dungeonBoss: DungeonBoss,
    tier: 1 | 2 | 3,
  ): Promise<Monster> {
    // Materialize-or-reuse: idempotent by name, one row ever per tier (plan3 §2c).
    const materializedName = `${dungeonBoss.name} — Tier ${tier}`;
    const existing = await this.monsterRepository.findByName(materializedName);
    if (existing) return existing;

    const scaled = scaleDungeonBossStats(
      {
        hp: dungeonBoss.baseHp,
        xpGain: dungeonBoss.baseXpGain,
        attributes: dungeonBoss.baseAttributes,
      },
      tier,
    );
    const bossMonster = await this.monsterRepository.create(
      Monster.create({
        id: Bun.randomUUIDv7(),
        name: materializedName,
        description: dungeonBoss.description,
        region: MATERIALIZED_BOSS_REGION,
        monsterImage: dungeonBoss.monsterImage,
        hp: scaled.hp,
        xpGain: scaled.xpGain,
        level: DUNGEON_CONFIG.tierBossLevel[tier],
        maxStamina: dungeonBoss.baseMaxStamina,
        attributes: scaled.attributes,
        monsterType: dungeonBoss.monsterType,
        drops: dungeonBoss.drops,
        exclusiveDrops: dungeonBoss.exclusiveDrops,
        legendaryDrops: dungeonBoss.legendaryDrops,
        ambushChance: 0,
      }),
    );
    await this.monsterAttackRepository.copyDungeonBossMoveset(dungeonBoss.id, bossMonster.id);
    return bossMonster;
  }
}
