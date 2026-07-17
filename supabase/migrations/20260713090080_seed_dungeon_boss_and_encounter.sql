-- The one dungeon boss (plan3 §2c/§7): the Dragon. base_hp/base_intelligence/
-- base_max_stamina/description as specified by the user; the other five
-- attributes flat at 20 (a caster boss, not a physical one). monster_type
-- 'normal' — magic-based, not poisonous. Drop pools start empty (no
-- legendary-rarity items exist in the catalog yet). monster_image is the
-- real art asset, served by apps/web from its public/ folder.
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
  '/Dragao_boss_dungeon.png',
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

-- Gatekeeper/boss pairing: SNAKE (an existing wild monster) reused as the
-- dungeon's gatekeeper. gatekeeper_monster_id is dropped later by
-- drop_gatekeeper_from_dungeon_encounters.sql once each dungeon step draws a
-- random catalog monster instead of always refighting one fixed gatekeeper —
-- this insert must keep matching what already ran against the live database
-- (this migration predates that redesign), so a fresh migration replay
-- doesn't violate the not-null constraint that still exists at this point
-- in migration history.
insert into dungeon_encounters (id, gatekeeper_monster_id, dungeon_boss_id)
select gen_random_uuid(), g.id, b.id
from dungeon_bosses b, monsters g
where b.name = 'Dragon' and g.name = 'SNAKE'
on conflict do nothing;
