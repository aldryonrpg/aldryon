-- Combat-balance follow-up: every regular monster's HP was in the
-- 1000-3000 range, which (combined with the HIT/defense-formula rebalance
-- in the previous migration) made kills take far too many turns to be fun.
-- Already applied directly on the live Supabase project by the user —
-- this migration is the historical record so a fresh replay matches
-- production: every monster to 150 HP, except Dark Wolf (the forest
-- region's tougher counterpart to Wolf) to 300.
update monsters set hp = 150 where name <> 'DARK WOLF';
update monsters set hp = 300 where name = 'DARK WOLF';
