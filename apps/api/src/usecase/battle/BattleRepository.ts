import type { Battle } from "@/domain/battle/Battle";

/** Port implemented by infrastructure (Postgres) for battle persistence. */
export interface BattleRepository {
  findByPlayerId(playerId: string): Promise<Battle | null>;
  create(battle: Battle): Promise<Battle>;
  update(battle: Battle): Promise<Battle>;
  deleteByPlayerId(playerId: string): Promise<void>;
}
