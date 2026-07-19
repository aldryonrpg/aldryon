-- Player names are now unique, case-insensitively (app-layer decision: a
-- Bloom filter fast-path skips a DB round trip when a name is obviously
-- free, but this index is the actual source of truth — see
-- UpdatePlayerNameUseCase / PostgresPlayerRepository.update). Partial on
-- `is not null` so the existing "null until the player picks one" state
-- keeps allowing any number of unnamed players.
create unique index if not exists players_player_name_lower_unique_idx
  on players (lower(player_name))
  where player_name is not null;
