-- dungeon_boss_monster_id is no longer needed: the old model swapped the
-- boss into an already-live battle mid-fight; the new step model instead
-- creates a *fresh* battle row (via /dungeon/continue) that already points
-- monster_id straight at the materialized boss row once the boss fight
-- begins — there's no mid-battle swap left to track.
-- dungeon_is_boss_fight is the new discriminator settleTurn needs: "was the
-- monster just killed in THIS battle the tier's boss" (for the dungeon
-- slayer ranking upsert), since every kill now fully settles its own battle
-- rather than only the final one in a longer chain.
alter table battles
  drop column dungeon_boss_monster_id,
  add column dungeon_is_boss_fight boolean not null default false;
