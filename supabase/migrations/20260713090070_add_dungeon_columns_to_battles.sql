-- The two-phase dungeon fight (gatekeeper -> boss) is one battles row with
-- nullable columns that trigger an in-place phase transition on gatekeeper
-- death (plan3 §2d), not a second battle row or a new state machine. Both
-- null for every ordinary battle. Tier is locked in at /dungeon/start rather
-- than re-derived from the player's level at the transition moment, so a
-- level-up mid-fight (from the gatekeeper's own XP) doesn't change which
-- boss the player faces partway through the same run.
alter table battles
  add column dungeon_boss_monster_id uuid references monsters (id),
  add column dungeon_tier smallint check (dungeon_tier in (1, 2, 3));
