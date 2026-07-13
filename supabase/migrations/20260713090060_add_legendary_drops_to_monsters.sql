-- Materialized dungeon bosses are real monsters rows (plan3 §2c), so they
-- need a third drop pool too. Empty for every ordinary monster outside a
-- dungeon — the kill-settlement drop roll just rolls a third pool that
-- happens to always be empty there.
alter table monsters
  add column legendary_drops jsonb not null default '[]'::jsonb;
