-- Three monster special attacks (is_special, charge_turns >= 1 — plan2 §3f):
-- pure-debuff/status specials, multiplier ~0 since their value is the
-- effect, not direct damage. Like every attack, seed data tunable later.
--
-- Fear (-50% Force) and Magic Aura Blast (-50% Intelligence): a percentage
-- stat-decay debuff on the player, held at 50% for 2 rounds then recovering
-- 10 points a round (50/50/40/30/20/10 -> back to normal) — the decay
-- schedule itself lives in the domain, not the DB.
insert into monster_attacks (id, name, stamina_cost, multiplier, scaling_attribute, applies_effect, is_special, charge_turns)
values (gen_random_uuid(), 'Fear', 40, 0, 'force', 'fear', true, 1)
on conflict (name) do nothing;

insert into monster_attacks (id, name, stamina_cost, multiplier, scaling_attribute, applies_effect, is_special, charge_turns)
values (gen_random_uuid(), 'Magic Aura Blast', 40, 0, 'intelligence', 'magic_aura_blast', true, 1)
on conflict (name) do nothing;

-- Stun: the player loses their next 2 turns entirely (no action, only the
-- passive +5 Stamina regen) — the monster keeps acting normally meanwhile.
insert into monster_attacks (id, name, stamina_cost, multiplier, scaling_attribute, applies_effect, is_special, charge_turns)
values (gen_random_uuid(), 'Stun', 40, 0, 'force', 'stun', true, 1)
on conflict (name) do nothing;
