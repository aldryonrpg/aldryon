-- Monster attributes are hidden from the player by default (rendered "??"
-- client-side, but actually never sent for an unrevealed key — the server
-- omits it entirely rather than trusting the client to hide it). Name,
-- description, image, and HP always stay visible; monster Stamina is never
-- sent to the client at all, revealed or not.
alter table battles add column revealed_monster_attributes jsonb not null default '[]';

-- REVEAL SPELL: an Intelligence-gated player spell (10 Stamina, no direct
-- damage — its value is the information) that reveals one random
-- not-yet-known monster attribute per successful cast.
alter table attacks add column reveals_random_monster_attribute boolean not null default false;

insert into attacks (
  id, name, stamina_cost, multiplier, scaling_attribute, min_level,
  req_intelligence, reveals_random_monster_attribute
)
values (
  gen_random_uuid(), 'REVEAL SPELL', 10, 0, 'intelligence', 1, 30, true
)
on conflict (name) do nothing;

-- Knowledge Potion: a Bag-usable consumable that reveals every monster
-- attribute at once, no attribute gate (unlike REVEAL SPELL).
alter table items add column reveals_all_monster_attributes boolean not null default false;

insert into items (id, name, description, value, rarity, reveals_all_monster_attributes)
values (
  gen_random_uuid(), 'Knowledge Potion',
  'A shimmering draught that lays bare every one of a foe''s attributes.',
  200, 'uncommon', true
)
on conflict (name) do nothing;
