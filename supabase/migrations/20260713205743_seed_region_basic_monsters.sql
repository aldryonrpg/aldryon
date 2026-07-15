-- One basic monster per remaining region (plan2 §3c/§7 pattern, same as
-- SNAKE): all six attributes at 15, monster_type 'normal' so they bleed on
-- hit (not poisonous), just the shared HIT attack in their moveset. Dark
-- Wolf is Wolf's forest-region counterpart with everything doubled (30
-- attributes, 2x hp/xp_gain/level) per explicit request.
insert into monsters (
  id, name, description, region, monster_image, hp, xp_gain, level,
  force, dexterity, agility, intelligence, vitality, luck, monster_type,
  ambush_chance
)
values
  (
    gen_random_uuid(),
    'WOLF',
    'A lean grey wolf stalking the forest edge, ready to lunge.',
    'forest',
    'data:image/svg+xml,%3Csvg xmlns=''http://www.w3.org/2000/svg'' viewBox=''0 0 100 100''%3E%3Ccircle cx=''50'' cy=''50'' r=''45'' fill=''%238a8a8a''/%3E%3C/svg%3E',
    1500,
    750,
    8,
    15, 15, 15, 15, 15, 15,
    'normal',
    10
  ),
  (
    gen_random_uuid(),
    'DARK WOLF',
    'A monstrous black-furred wolf, twice the size and fury of its kin.',
    'forest',
    'data:image/svg+xml,%3Csvg xmlns=''http://www.w3.org/2000/svg'' viewBox=''0 0 100 100''%3E%3Ccircle cx=''50'' cy=''50'' r=''45'' fill=''%232b2b2b''/%3E%3C/svg%3E',
    3000,
    1500,
    16,
    30, 30, 30, 30, 30, 30,
    'normal',
    10
  ),
  (
    gen_random_uuid(),
    'SKELETON GUARD',
    'A rattling skeleton bound to guard the ancient ruins.',
    'ruins',
    'data:image/svg+xml,%3Csvg xmlns=''http://www.w3.org/2000/svg'' viewBox=''0 0 100 100''%3E%3Ccircle cx=''50'' cy=''50'' r=''45'' fill=''%23e0dcc8''/%3E%3C/svg%3E',
    1500,
    750,
    8,
    15, 15, 15, 15, 15, 15,
    'normal',
    10
  ),
  (
    gen_random_uuid(),
    'ORC SOLDIER',
    'A hardened orc soldier patrolling the mountain pass.',
    'mountain',
    'data:image/svg+xml,%3Csvg xmlns=''http://www.w3.org/2000/svg'' viewBox=''0 0 100 100''%3E%3Ccircle cx=''50'' cy=''50'' r=''45'' fill=''%235b6b3f''/%3E%3C/svg%3E',
    1500,
    750,
    8,
    15, 15, 15, 15, 15, 15,
    'normal',
    10
  ),
  (
    gen_random_uuid(),
    'BANDIT SOLDIER',
    'An armed bandit soldier lying in wait to ambush travelers.',
    'bandit',
    'data:image/svg+xml,%3Csvg xmlns=''http://www.w3.org/2000/svg'' viewBox=''0 0 100 100''%3E%3Ccircle cx=''50'' cy=''50'' r=''45'' fill=''%238b5a2b''/%3E%3C/svg%3E',
    1500,
    750,
    8,
    15, 15, 15, 15, 15, 15,
    'normal',
    10
  ),
  (
    gen_random_uuid(),
    'SEWER RAT',
    'A bloated rat scurrying through the fetid sewage tunnels.',
    'sewage',
    'data:image/svg+xml,%3Csvg xmlns=''http://www.w3.org/2000/svg'' viewBox=''0 0 100 100''%3E%3Ccircle cx=''50'' cy=''50'' r=''45'' fill=''%236b7a4f''/%3E%3C/svg%3E',
    1500,
    750,
    8,
    15, 15, 15, 15, 15, 15,
    'normal',
    10
  )
on conflict (name) do nothing;

insert into monster_movesets (monster_id, monster_attack_id)
select m.id, a.id
from monsters m, monster_attacks a
where m.name in (
  'WOLF', 'DARK WOLF', 'SKELETON GUARD', 'ORC SOLDIER', 'BANDIT SOLDIER', 'SEWER RAT'
) and a.name = 'HIT'
on conflict do nothing;
