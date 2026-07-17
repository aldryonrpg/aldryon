-- `users.username` predates the migrated schema entirely — it was never
-- created by any migration in this repo (the on-screen name has always
-- lived on `players.player_name`, kept deliberately separate from
-- auth/profile concerns), yet it still exists on the live table from
-- pre-migration manual setup. No application code has ever read or
-- written it. `if exists` since it's not something our own history
-- guarantees is there.
alter table users drop column if exists username;
