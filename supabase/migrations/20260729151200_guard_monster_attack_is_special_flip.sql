-- The two existing "at most 2 special attacks" triggers
-- (monster_movesets_special_limit, dungeon_boss_movesets_special_limit) only
-- fire BEFORE INSERT on their respective join tables. Neither catches this:
-- an attack is linked as a normal attack (is_special = false) to a monster
-- and/or dungeon boss, then later PATCH /admin/monster-attacks/:id flips
-- that same monster_attacks row's is_special to true — that UPDATE never
-- touches monster_movesets/dungeon_boss_movesets, so the INSERT-only
-- triggers never re-fire, and a monster or boss can silently end up with 3+
-- "special" attacks with nothing catching it. Only the false -> true
-- transition needs guarding: flipping special -> normal can only ever
-- decrease a moveset's special count, which can never violate the cap.
create function enforce_monster_attack_is_special_flip() returns trigger as $$
declare
  offending_monster_id uuid;
  offending_boss_id uuid;
begin
  select mm.monster_id into offending_monster_id
  from monster_movesets mm
  where mm.monster_attack_id = new.id
    and (
      select count(*)
      from monster_movesets mm2
      join monster_attacks ma2 on ma2.id = mm2.monster_attack_id
      where mm2.monster_id = mm.monster_id and ma2.is_special
    ) > 2
  limit 1;

  if offending_monster_id is not null then
    raise exception 'Cannot mark monster attack % as special: monster % would then have more than 2 special attacks in its moveset', new.id, offending_monster_id
      using errcode = '23514'; -- check_violation, same convention as the two sibling triggers
  end if;

  select dbm.dungeon_boss_id into offending_boss_id
  from dungeon_boss_movesets dbm
  where dbm.monster_attack_id = new.id
    and (
      select count(*)
      from dungeon_boss_movesets dbm2
      join monster_attacks ma2 on ma2.id = dbm2.monster_attack_id
      where dbm2.dungeon_boss_id = dbm.dungeon_boss_id and ma2.is_special
    ) > 2
  limit 1;

  if offending_boss_id is not null then
    raise exception 'Cannot mark monster attack % as special: dungeon boss % would then have more than 2 special attacks in its moveset', new.id, offending_boss_id
      using errcode = '23514';
  end if;

  return new;
end;
$$ language plpgsql;

create trigger monster_attacks_is_special_flip_guard
  after update of is_special on monster_attacks
  for each row
  when (new.is_special and not old.is_special)
  execute function enforce_monster_attack_is_special_flip();
