import type { Monster, MonsterRegion } from "@/domain/monster/Monster";

/** Port implemented by infrastructure (Postgres) for monster catalog reads. */
export interface MonsterRepository {
  findById(id: string): Promise<Monster | null>;
  findAllByRegion(region: MonsterRegion): Promise<Monster[]>;
}
