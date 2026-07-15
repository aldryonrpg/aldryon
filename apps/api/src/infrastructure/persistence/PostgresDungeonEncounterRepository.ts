import type { SQL } from "bun";
import { DungeonEncounter } from "@/domain/dungeon/DungeonEncounter";
import type { DungeonEncounterRepository } from "@/usecase/dungeon/DungeonEncounterRepository";

interface DungeonEncounterRow {
  id: string;
  dungeon_boss_id: string;
}

function toDomain(row: DungeonEncounterRow): DungeonEncounter {
  return DungeonEncounter.create({
    id: row.id,
    dungeonBossId: row.dungeon_boss_id,
  });
}

export class PostgresDungeonEncounterRepository implements DungeonEncounterRepository {
  constructor(private readonly sql: SQL) {}

  async findOne(): Promise<DungeonEncounter | null> {
    const rows = await this.sql<DungeonEncounterRow[]>`select * from dungeon_encounters limit 1`;
    return rows[0] ? toDomain(rows[0]) : null;
  }
}
