-- The player's single DoT attack (plan2 §7/§10): requires >=50 Intelligence,
-- costs 50 Stamina (affordable from level 6, max Stamina = 20 + 5*level),
-- applies `burn` (Intelligence-scaled, no counter item — monsters have no
-- bag). Multiplier is seed data, tunable later like every attack.
insert into attacks (
  id, name, stamina_cost, multiplier, scaling_attribute, applies_effect,
  min_level, req_intelligence
)
values (
  gen_random_uuid(), 'BURN SPELL', 50, 1.5, 'intelligence', 'burn',
  1, 50
)
on conflict (name) do nothing;
