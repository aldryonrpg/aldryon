import type { SQL } from "bun";
import type { LevelRow } from "@/domain/level/LevelCurve";
import type { LevelRepository } from "@/usecase/level/LevelRepository";

interface LevelTableRow {
  level: number;
  xp_required: number;
}

export class PostgresLevelRepository implements LevelRepository {
  constructor(private readonly sql: SQL) {}

  async findAll(): Promise<LevelRow[]> {
    const rows = await this.sql<LevelTableRow[]>`select * from levels order by level asc`;
    return rows.map((row) => ({ level: row.level, xpRequired: row.xp_required }));
  }
}
