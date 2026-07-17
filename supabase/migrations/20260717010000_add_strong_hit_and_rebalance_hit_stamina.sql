-- Combat-balance follow-up: HIT's Stamina cost moves from 1 to 5 — the
-- same amount both sides passively regen every round (README "Combat
-- math"), so spamming HIT is now sustainable but not free. Both the
-- player and monster copies change together, same as the earlier
-- multiplier rebalance.
update attacks set stamina_cost = 5 where name = 'HIT';
update monster_attacks set stamina_cost = 5 where name = 'HIT';

-- STRONG HIT: a real second Strength-scaling option for players (until now
-- HIT was the only one) — 10 Stamina, x1.5 multiplier, requires 20
-- Strength. Player-only: monsters have no requirement-gated attacks, so
-- there is no monster_attacks counterpart, same as BURN SPELL.
insert into attacks (id, name, stamina_cost, multiplier, scaling_attribute, min_level, req_strength)
values (gen_random_uuid(), 'STRONG HIT', 10, 1.5, 'strength', 1, 20)
on conflict (name) do nothing;
