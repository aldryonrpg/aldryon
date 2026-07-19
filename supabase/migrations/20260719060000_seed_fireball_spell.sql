-- A second Intelligence-scaled offensive player spell alongside BURN SPELL
-- (which is reserved as the player's one DoT — Fireball deals no
-- over-the-top damage, applies_effect stays null): 20 Stamina, x2
-- multiplier (a real burst nuke — compare HIT's x1.0), gated behind >=30
-- Intelligence, same req_intelligence-only pattern as REVEAL SPELL.
insert into attacks (
  id, name, stamina_cost, multiplier, scaling_attribute, min_level, req_intelligence
)
values (
  gen_random_uuid(), 'FIREBALL SPELL', 20, 2, 'intelligence', 1, 30
)
on conflict (name) do nothing;
