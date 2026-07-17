-- Combat-balance follow-up: HIT's 0.4 multiplier, combined with the
-- original `defender_level * defender_stat` defense term, made basic
-- attacks land 0 damage against almost any monster once either side had a
-- non-trivial level/attribute. HIT moves to a full 1.0 multiplier here (the
-- defense-formula half of the fix lives in DamageCalculator.ts, not the
-- DB). Every other damage-dealing attack (BURN SPELL 1.5, Dragon Breath
-- 1.2) already sits above 1 — untouched. The three pure-debuff monster
-- specials (Fear, Magic Aura Blast, Stun) and REVEAL SPELL intentionally
-- keep a 0 multiplier — their value is the status effect/reveal, not
-- direct damage, and giving them real damage on top was never the ask.
update attacks set multiplier = 1 where name = 'HIT';
update monster_attacks set multiplier = 1 where name = 'HIT';
