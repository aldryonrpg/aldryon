-- Admin monster edits (plan9 follow-up) clamp monster_current_hp across
-- every battle for a monster_id in one UPDATE — the table has no index on
-- this FK column yet, so back it with one for that WHERE clause.
create index if not exists battles_monster_id_idx on battles (monster_id);
