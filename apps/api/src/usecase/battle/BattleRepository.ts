import type { Battle } from "@/domain/battle/Battle";

/** Port implemented by infrastructure (Postgres) for battle persistence. */
export interface BattleRepository {
  findByPlayerId(playerId: string): Promise<Battle | null>;
  create(battle: Battle): Promise<Battle>;
  update(battle: Battle): Promise<Battle>;
  deleteByPlayerId(playerId: string): Promise<void>;
  /** Caps `monster_current_hp` down to `newMaxHp` for every currently active
   * battle against this monster (plan9 follow-up: an admin lowering a
   * monster's hp mid-fight, e.g. 100 -> 50 while a battle sits at 80/100,
   * would otherwise leave that battle showing 80/50 until it happens to
   * take enough damage). Never raises it — a `least()`, so patching a
   * monster's hp *up*, or patching some other field entirely, is a no-op
   * here. Affects 0 rows in the overwhelmingly common case (no one
   * currently fighting that exact monster), so this is safe to call
   * unconditionally after every successful monster update. */
  clampMonsterCurrentHp(monsterId: string, newMaxHp: number): Promise<void>;
}
