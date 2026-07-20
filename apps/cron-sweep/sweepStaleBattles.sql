-- Deletes every battle (dungeon or ordinary) older than 2 days — abandoned
-- sessions nobody ever came back to finish. Run daily by the
-- aldryon-sweep-stale-battles Render Cron Job (render.yaml), via psql.
--
-- A stale *dungeon* battle needs its player's dungeon-run state cleared
-- first, or dungeonRunTier/Step/TotalSteps stays parked forever, blocking
-- them from ever starting a new run even though the old one is gone (same
-- class of dangling-state bug fixed for death/flee — plans/plan4.md §15).

update players
set dungeon_run_tier = null, dungeon_run_step = null, dungeon_run_total_steps = null
where id in (
  select player_id from battles
  where dungeon_tier is not null and created_at < now() - interval '2 days'
);

delete from battles where created_at < now() - interval '2 days';
