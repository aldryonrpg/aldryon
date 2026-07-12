import type { LevelRow } from "@/domain/level/LevelCurve";

/** Port implemented by infrastructure (Postgres) for the level/XP curve catalog. */
export interface LevelRepository {
  findAll(): Promise<LevelRow[]>;
}
