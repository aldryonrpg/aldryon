-- Mirrors monster_movesets exactly, just keyed off dungeon_bosses (plan3
-- §2c). Copied into monster_movesets at materialization time, once per tier.
create table if not exists dungeon_boss_movesets (
  dungeon_boss_id uuid not null references dungeon_bosses (id) on delete cascade,
  monster_attack_id uuid not null references monster_attacks (id) on delete cascade,
  primary key (dungeon_boss_id, monster_attack_id)
);
