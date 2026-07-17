-- Dragon Blade: the Dragon's exclusive unique drop (loot-system follow-up).
-- +5 Force, +5 Intelligence, a one-handed weapon. dropRate 1000 means
-- 1000/1000 under the legendary pool's per-mille scale (chance =
-- dropRate/1000) — a guaranteed drop, specifically so the "kill it twice,
-- confirm it drops exactly once" ownership-uniqueness test is deterministic
-- rather than needing thousands of kills to ever observe it.
insert into items (id, name, description, value, rarity, slot, force, intelligence)
values (
  gen_random_uuid(),
  'Dragon Blade',
  'Forged from the Dragon''s own fang. Hums with ancient, singular power.',
  10000,
  'unique',
  'weapon',
  5,
  5
)
on conflict (name) do nothing;

update dungeon_bosses
set legendary_drops = jsonb_build_array(
  jsonb_build_object(
    'itemId', (select id from items where name = 'Dragon Blade'),
    'dropRate', 1000
  )
)
where name = 'Dragon' and legendary_drops = '[]'::jsonb;
