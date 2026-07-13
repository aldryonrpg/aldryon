import type { DungeonEncounter } from "@/domain/dungeon/DungeonEncounter";

/** Port implemented by infrastructure (Postgres). Exactly one row exists
 * today (plan3 §2c) — one gatekeeper/boss pairing covers all 3 tiers. */
export interface DungeonEncounterRepository {
  findOne(): Promise<DungeonEncounter | null>;
}
