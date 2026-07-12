-- HIT for everyone (plan2 §3e/§10): a free fallback attack, 0 stamina,
-- multiplier 0.4 (~40% of a normal strike), present in every moveset so
-- nobody is ever locked out of acting. Physical, so it scales with Force.
insert into attacks (id, name, stamina_cost, multiplier, scaling_attribute, min_level)
values (gen_random_uuid(), 'HIT', 0, 0.4, 'force', 1)
on conflict (name) do nothing;

insert into monster_attacks (id, name, stamina_cost, multiplier, scaling_attribute, is_special, charge_turns)
values (gen_random_uuid(), 'HIT', 0, 0.4, 'force', false, 0)
on conflict (name) do nothing;
