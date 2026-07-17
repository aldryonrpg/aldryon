-- Read-only convenience view for browsing monster movesets in the Supabase
-- table/SQL editor — joins the monster_movesets pairing table back to
-- human-readable monster/attack names instead of raw UUIDs (game-content
-- readability follow-up, sized for a catalog expected to grow to 2000+
-- monsters / 100+ attacks). Purely a read-side aid: no application code
-- queries this. A plain view, not materialized — no refresh step, always
-- reflects live data, and the underlying table stays small enough (a few
-- thousand rows even at 2000 monsters × ~5 attacks each) that a live join
-- is cheap, especially with the index below.
create view monster_movesets_readable as
select
  m.name as monster_name,
  m.region,
  ma.name as attack_name,
  ma.is_special,
  ma.multiplier,
  ma.stamina_cost,
  ma.scaling_attribute,
  ma.applies_effect
from monster_movesets mm
join monsters m on m.id = mm.monster_id
join monster_attacks ma on ma.id = mm.monster_attack_id
order by m.name, ma.is_special desc, ma.name;

-- monster_movesets' composite primary key (monster_id, monster_attack_id)
-- already indexes monster_id (its leftmost column) — the common "this
-- monster's moveset" lookup direction. This adds the missing reverse
-- index on monster_attack_id: needed so the FK's own "on delete cascade"
-- (deleting/replacing an attack) doesn't sequential-scan the whole table,
-- and for any future "which monsters use this attack" query, once the
-- catalog is at the 2000+ monster / 100+ attack size being planned for.
create index monster_movesets_attack_id_idx on monster_movesets (monster_attack_id);
