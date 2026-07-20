-- Two new dungeon bosses (plan3 §2c pattern, same shape as the Dragon seed
-- in 20260713090080_seed_dungeon_boss_and_encounter.sql) plus one new
-- exclusive item. Written post-force->strength rename
-- (20260715203618_rename_force_to_strength.sql), so this uses
-- base_strength/strength and scaling_attribute 'strength' throughout --
-- unlike the older migrations it mirrors, which still say base_force/force
-- because they predate the rename and are left historically accurate.

-- Orc Lord: a physical Strength bruiser. Strength explicitly 50, the other
-- five attributes flat at 30. base_hp/base_max_stamina/base_xp_gain match
-- the Dragon row's precedent (not specified otherwise). monster_image is
-- the real art asset already in apps/web/public/dungeon_boss/.
insert into dungeon_bosses (
  id, name, description, monster_image, monster_type,
  base_hp, base_xp_gain, base_max_stamina,
  base_strength, base_dexterity, base_agility, base_intelligence, base_vitality, base_luck,
  drops, exclusive_drops, legendary_drops
)
values (
  gen_random_uuid(),
  'Orc Lord',
  'A hulking warlord who crushed every rival clan beneath his axe. Strength given a name.',
  '/dungeon_boss/Orc_lord.png',
  'normal',
  2000, 5000, 200,
  50, 30, 30, 30, 30, 30,
  '[]'::jsonb, '[]'::jsonb, '[]'::jsonb
)
on conflict (name) do nothing;

-- Dark Dragon: a Strength+Intelligence hybrid -- both explicitly 50, the
-- remaining four attributes flat at 30.
insert into dungeon_bosses (
  id, name, description, monster_image, monster_type,
  base_hp, base_xp_gain, base_max_stamina,
  base_strength, base_dexterity, base_agility, base_intelligence, base_vitality, base_luck,
  drops, exclusive_drops, legendary_drops
)
values (
  gen_random_uuid(),
  'Dark Dragon',
  'A corrupted kin of the Dragon, its flame turned black. Claw and spellwork strike as one.',
  '/dungeon_boss/Dark_Dragon.png',
  'normal',
  2000, 5000, 200,
  50, 30, 30, 50, 30, 30,
  '[]'::jsonb, '[]'::jsonb, '[]'::jsonb
)
on conflict (name) do nothing;

-- Moveset for both: the existing basic HIT + the existing special Stun --
-- no new attack rows needed, both already exist in monster_attacks.
insert into dungeon_boss_movesets (dungeon_boss_id, monster_attack_id)
select b.id, a.id
from dungeon_bosses b, monster_attacks a
where b.name in ('Orc Lord', 'Dark Dragon') and a.name in ('HIT', 'Stun')
on conflict do nothing;

-- The Skull Splitter: Orc Lord's exclusive drop. Two-handed, +4 Strength,
-- very_rare, 2000g. No set_name -- weapons/two-handed weapons are never
-- bound to a set (see 20260715212207_add_equipment_sets.sql).
insert into items (id, name, description, value, rarity, slot, strength)
values (
  gen_random_uuid(),
  'The Skull Splitter',
  'Still wet with the blood of a hundred battles. Too heavy for one hand alone.',
  2000,
  'very_rare',
  'two_handed_weapon',
  4
)
on conflict (name) do nothing;

-- exclusive_drops (not legendary_drops) -- The Skull Splitter is very_rare,
-- not unique, and exclusive_drops is the pool meant for rare-and-above items
-- (see domain/item/Item.ts). dropRate 50/1000 (5%).
-- Guarded on the pool still being empty, same idempotency pattern as the
-- Dragon Blade legendary_drops update.
update dungeon_bosses
set exclusive_drops = jsonb_build_array(
  jsonb_build_object(
    'itemId', (select id from items where name = 'The Skull Splitter'),
    'dropRate', 50
  )
)
where name = 'Orc Lord' and exclusive_drops = '[]'::jsonb;

-- The Dragon row's monster_image has always pointed at a file that doesn't
-- exist anywhere under apps/web/public ('/Dragao_boss_dungeon.png') --
-- fixed up now to the real asset, under the same dungeon_boss/ folder
-- convention the two new bosses above use.
update dungeon_bosses
set monster_image = '/dungeon_boss/Dragon.png'
where name = 'Dragon';
