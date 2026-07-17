-- The dungeon boss's basic (non-special) attack. The only existing basic
-- monster attack, HIT, is Force-scaled (20260711225330) — the Dragon's
-- attacks are all Intelligence-based, so it needs its own basic attack
-- rather than reusing HIT. Same stamina cost/multiplier convention as HIT.
insert into monster_attacks (id, name, stamina_cost, multiplier, scaling_attribute, is_special, charge_turns)
values (gen_random_uuid(), 'Dragon Breath', 10, 1.2, 'intelligence', false, 0)
on conflict (name) do nothing;
