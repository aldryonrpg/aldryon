import type { Monster, MonsterRegion } from "@/domain/monster/Monster";

/** Port implemented by infrastructure (Postgres) for monster catalog reads
 * and — since a dungeon boss materializes into a real monsters row on first
 * use (plan3 §2c) — the one write path that needs. */
export interface MonsterRepository {
  findById(id: string): Promise<Monster | null>;
  findByName(name: string): Promise<Monster | null>;
  findAllByRegion(region: MonsterRegion): Promise<Monster[]>;
  create(monster: Monster): Promise<Monster>;
}
