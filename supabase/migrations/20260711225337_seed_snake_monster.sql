-- The one playable monster from day one (plan2 §7/§10): forest region,
-- 1000 HP, all six attributes = 10, poisonous (so it poisons via the innate
-- on-hit Luck-difference roll, plan2 §6a). monster_image is a self-contained
-- SVG-circle data: URI placeholder — used whenever a real CDN PNG isn't set
-- yet, so the front-end always has something to render. Just the shared HIT
-- attack is enough to be playable (plan2 §7).
insert into monsters (
  id, name, description, region, monster_image, hp, xp_gain, level,
  force, dexterity, agility, intelligence, vitality, luck, monster_type,
  ambush_chance
)
values (
  gen_random_uuid(),
  'SNAKE',
  'A coiled forest snake, fangs glistening with venom.',
  'forest',
  'data:image/svg+xml,%3Csvg xmlns=''http://www.w3.org/2000/svg'' viewBox=''0 0 100 100''%3E%3Ccircle cx=''50'' cy=''50'' r=''45'' fill=''%2359a14f''/%3E%3C/svg%3E',
  1000,
  500,
  5,
  10, 10, 10, 10, 10, 10,
  'poisonous',
  10
)
on conflict (name) do nothing;

insert into monster_movesets (monster_id, monster_attack_id)
select m.id, a.id
from monsters m, monster_attacks a
where m.name = 'SNAKE' and a.name = 'HIT'
on conflict do nothing;
