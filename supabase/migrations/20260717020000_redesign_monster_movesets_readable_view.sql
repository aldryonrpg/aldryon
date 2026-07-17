-- Redesign of monster_movesets_readable (game-content readability follow-
-- up): one row per attack-pairing was awkward to eyeball a monster's whole
-- kit at a glance — this replaces it with one row per MONSTER, its core
-- stats, and two jsonb arrays (normal_attacks / special_attacks, each
-- carrying every field of the attacks they list) so "does this monster
-- have 0/1/2 specials, and what are they" is a single glance, not a scroll
-- through repeated monster rows.
drop view if exists monster_movesets_readable;

create view monster_movesets_readable as
select
  m.name as monster_name,
  m.region as monster_region,
  m.monster_type,
  m.hp as monster_hp,
  m.xp_gain as monster_xp,
  coalesce(
    jsonb_agg(
      jsonb_build_object(
        'name', ma.name,
        'staminaCost', ma.stamina_cost,
        'multiplier', ma.multiplier,
        'scalingAttribute', ma.scaling_attribute,
        'appliesEffect', ma.applies_effect
      )
      order by ma.name
    ) filter (where ma.id is not null and not ma.is_special),
    '[]'::jsonb
  ) as normal_attacks,
  coalesce(
    jsonb_agg(
      jsonb_build_object(
        'name', ma.name,
        'staminaCost', ma.stamina_cost,
        'multiplier', ma.multiplier,
        'scalingAttribute', ma.scaling_attribute,
        'appliesEffect', ma.applies_effect,
        'chargeTurns', ma.charge_turns
      )
      order by ma.name
    ) filter (where ma.id is not null and ma.is_special),
    '[]'::jsonb
  ) as special_attacks
from monsters m
left join monster_movesets mm on mm.monster_id = m.id
left join monster_attacks ma on ma.id = mm.monster_attack_id
group by m.id, m.name, m.region, m.monster_type, m.hp, m.xp_gain
order by m.name;
