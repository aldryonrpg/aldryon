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

-- The dungeon's current boss identity (plan3 §2c, loot-system follow-up):
-- each dungeon step now draws a random catalog monster rather than a fixed
-- gatekeeper, so this pairing row only needs to name the boss.
insert into dungeon_encounters (id, dungeon_boss_id)
select gen_random_uuid(), b.id
from dungeon_bosses b
where b.name = 'Dragon'
on conflict do nothing;
