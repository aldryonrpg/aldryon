-- Daily dungeon attempt tracking (plan3 §2f). Two nullable slots, not one,
-- because VIP gets 2 attempts/day vs. normal's 1 — a single
-- last_dungeon_attempt_at column could only ever express one. Both stored in
-- UTC; a slot from a previous UTC day simply doesn't count today, so there's
-- no explicit "reset" step.
alter table players
  add column dungeon_attempt_1 timestamptz,
  add column dungeon_attempt_2 timestamptz;
