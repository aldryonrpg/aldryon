import { BloomFilter } from "@/domain/shared/BloomFilter";

const EXPECTED_PLAYERS = 100_000;
const FALSE_POSITIVE_RATE = 0.01;

/**
 * Fast-path hint for player-name uniqueness (see UpdatePlayerNameUseCase):
 * "definitely free" skips a DB round trip, "maybe taken" falls back to a
 * `findByName` lookup. Never the source of truth — a Postgres unique index
 * on `lower(player_name)` is (see PostgresPlayerRepository.update). Names
 * are compared case-insensitively, so everything is lowercased before
 * touching the underlying filter.
 */
export class PlayerNameCache {
  private readonly filter = new BloomFilter(EXPECTED_PLAYERS, FALSE_POSITIVE_RATE);

  /** Seeds the filter at boot with every name already in use (main.ts). */
  load(names: string[]): void {
    for (const name of names) this.filter.add(name.toLowerCase());
  }

  mightBeTaken(name: string): boolean {
    return this.filter.mightContain(name.toLowerCase());
  }

  markTaken(name: string): void {
    this.filter.add(name.toLowerCase());
  }
}
