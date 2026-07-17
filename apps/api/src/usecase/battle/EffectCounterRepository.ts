import type { BattleEffectKind } from "@/domain/monster/MonsterAttack";

/** Port implemented by infrastructure (Postgres) for the effect->cure-item lookup. */
export interface EffectCounterRepository {
  findByKind(kind: BattleEffectKind): Promise<string | null>;
}
