-- Mirrors monster_movesets_special_limit (20260711225321) exactly, just
-- keyed off dungeon_boss_movesets instead — a dungeon boss's moveset is
-- copied into monster_movesets at materialization time
-- (copyDungeonBossMoveset), so a boss with >2 specials already seeded here
-- would otherwise only fail much later, at that copy step, instead of at
-- the actual bad insert. This is the DB-level defense-in-depth half of the
-- new admin "special attacks" picker (0-2 special attacks per boss) — the
-- usecase layer (SetDungeonBossSpecialAttacksUseCase) is the other half.
create function enforce_dungeon_boss_special_moveset_limit() returns trigger as $$
declare
  is_new_attack_special boolean;
  existing_special_count integer;
begin
  select is_special into is_new_attack_special
  from monster_attacks
  where id = new.monster_attack_id;

  if is_new_attack_special then
    select count(*) into existing_special_count
    from dungeon_boss_movesets dbm
    join monster_attacks ma on ma.id = dbm.monster_attack_id
    where dbm.dungeon_boss_id = new.dungeon_boss_id and ma.is_special;

    if existing_special_count >= 2 then
      raise exception 'Dungeon boss % already has 2 special attacks in its moveset', new.dungeon_boss_id
        using errcode = '23514'; -- check_violation, same convention as the monster-side trigger
    end if;
  end if;

  return new;
end;
$$ language plpgsql;

create trigger dungeon_boss_movesets_special_limit
  before insert on dungeon_boss_movesets
  for each row
  execute function enforce_dungeon_boss_special_moveset_limit();
