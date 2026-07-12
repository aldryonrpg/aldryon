import type { MonsterAttack } from "@/domain/monster/MonsterAttack";

/** Port implemented by infrastructure (Postgres) for monster attacks + movesets. */
export interface MonsterAttackRepository {
  findById(id: string): Promise<MonsterAttack | null>;
  findMovesetByMonsterId(monsterId: string): Promise<MonsterAttack[]>;
}
