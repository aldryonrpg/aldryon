import type { DungeonBoss } from "@/domain/dungeon/DungeonBoss";
import { DUNGEON_CONFIG } from "@/domain/dungeon/dungeonConfig";
import { scaleDungeonBossStats } from "@/domain/dungeon/scaleDungeonBossStats";
import { Monster } from "@/domain/monster/Monster";
import { msUntilNextUtcMidnight, TtlCache } from "@/domain/shared/TtlCache";
import type { DungeonBossRepository } from "@/usecase/dungeon/DungeonBossRepository";
import type { MonsterAttackRepository } from "@/usecase/monster/MonsterAttackRepository";
import type { MonsterRepository } from "@/usecase/monster/MonsterRepository";

// A dedicated region, excluded from MonsterRegionSchema (the wild-battle-
// selectable set) specifically so materialized boss rows can never be
// rolled into an ordinary /battle/start region encounter — see
// domain/monster/Monster.ts's MonsterRegion doc comment.
const MATERIALIZED_BOSS_REGION = "dungeon" as const;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

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
 * "Choosing" today's boss is a deterministic function of the date, not
 * random or cached state: `daysSinceEpoch(now) % bosses.length` indexes into
 * `dungeonBossRepository.findAll()`'s stable (name-ordered) list. Every
 * process/replica computes this independently and always agrees — no
 * coordination needed, and with more than one boss it never repeats two
 * days in a row (a fixed cycle through all of them). The in-memory cache
 * here is purely a per-process perf optimization on top of that — it is
 * never the source of truth for which boss is active, so it doesn't matter
 * that different replicas' caches aren't shared or that they don't survive
 * a restart.
 */
export class DungeonBossOfTheDayUseCase {
  private readonly cache: TtlCache<TierBosses>;

  constructor(
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
    const bosses = await this.dungeonBossRepository.findAll();
    if (bosses.length === 0) throw new Error("No dungeon bosses configured");

    const dayIndex = Math.floor(this.now() / MS_PER_DAY) % bosses.length;
    const dungeonBoss = bosses[dayIndex];
    if (!dungeonBoss) throw new Error("Dungeon boss rotation index out of range");

    const [tier1, tier2, tier3] = await Promise.all([
      this.materializeOrReuseTier(dungeonBoss, 1),
      this.materializeOrReuseTier(dungeonBoss, 2),
      this.materializeOrReuseTier(dungeonBoss, 3),
    ]);

    // Retire any previous day's (or previous boss's) materialized rows now
    // that today's three are confirmed to exist — safe under concurrent
    // replicas since this never touches the current boss's own rows.
    await this.monsterRepository.deleteStaleDungeonBossRows(dungeonBoss.name);

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
