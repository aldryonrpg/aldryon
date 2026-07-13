-- The one dungeon boss (plan3 §2c/§7): the Dragon. base_hp/base_intelligence/
-- base_max_stamina/description as specified by the user; the other five
-- attributes flat at 20 (a caster boss, not a physical one). monster_type
-- 'normal' — magic-based, not poisonous. Drop pools start empty (no
-- legendary-rarity items exist in the catalog yet). monster_image is a
-- placeholder data: URI, same convention as the seeded Snake, until real art
-- exists.
insert into dungeon_bosses (
  id, name, description, monster_image, monster_type,
  base_hp, base_xp_gain, base_max_stamina,
  base_force, base_dexterity, base_agility, base_intelligence, base_vitality, base_luck,
  drops, exclusive_drops, legendary_drops
)
values (
  gen_random_uuid(),
  'Dragon',
  '200 Year Dragon that you awakened today...',
  'data:image/svg+xml,%3Csvg xmlns=''http://www.w3.org/2000/svg'' viewBox=''0 0 100 100''%3E%3Ccircle cx=''50'' cy=''50'' r=''45'' fill=''%23a1352b''/%3E%3C/svg%3E',
  'normal',
  2000, 5000, 200,
  20, 20, 20, 50, 20, 20,
  '[]'::jsonb, '[]'::jsonb, '[]'::jsonb
)
on conflict (name) do nothing;

-- Moveset: Dragon Breath (basic, Intelligence) + the two existing specials
-- Magic Aura Blast + Stun (already seeded, both is_special — exactly the
-- existing 2-specials-per-moveset cap).
insert into dungeon_boss_movesets (dungeon_boss_id, monster_attack_id)
select b.id, a.id
from dungeon_bosses b, monster_attacks a
where b.name = 'Dragon' and a.name in ('Dragon Breath', 'Magic Aura Blast', 'Stun')
on conflict do nothing;

-- Gatekeeper/boss pairing (plan3 §2c): the existing Snake stands in as the
-- gatekeeper for all 3 tiers, ahead of the materialized Dragon.
insert into dungeon_encounters (id, gatekeeper_monster_id, dungeon_boss_id)
select gen_random_uuid(), m.id, b.id
from monsters m, dungeon_bosses b
where m.name = 'SNAKE' and b.name = 'Dragon'
on conflict do nothing;
