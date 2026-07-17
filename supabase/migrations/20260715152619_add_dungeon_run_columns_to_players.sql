-- Dungeon run progress now lives on the player, not the battle row — the
-- new step model ends (and deletes) the battle after every single kill
-- (step monster or boss), showing a Continue/Exit choice each time, so
-- "which step am I on" has to survive the gap between one kill and the
-- next fight starting. Null = no dungeon run currently awaiting a
-- Continue/Exit decision. Set at /dungeon/start, advanced by
-- /dungeon/continue, cleared on boss kill, player death, or /dungeon/exit.
alter table players
  add column dungeon_run_tier smallint check (dungeon_run_tier in (1, 2, 3)),
  add column dungeon_run_step smallint check (dungeon_run_step >= 1),
  add column dungeon_run_total_steps smallint check (dungeon_run_total_steps >= 1);
