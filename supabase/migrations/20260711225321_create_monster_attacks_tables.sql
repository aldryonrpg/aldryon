-- Monster attack catalog + moveset join (plan2 §3f). Monster attacks share
-- the combat columns with player attacks but have no level/attribute gating
-- and add special-attack mechanics (charge turns).
create table if not exists monster_attacks (
  id uuid primary key,
  name text not null unique,
  stamina_cost integer not null check (stamina_cost >= 0),
  multiplier numeric not null,
  scaling_attribute attack_scaling not null,
  applies_effect battle_effect_kind,
  counter_item_id uuid references items (id),
  is_special boolean not null default false,
  -- Specials need at least one turn of rest to charge.
  charge_turns integer not null default 0 check (charge_turns >= 1 or not is_special),
  created_at timestamptz not null default now(),
  -- A counter item implies an effect to cure, but not every effect has a
  -- counter item: bleed/poison do (bandage/antidote), but fear/
  -- magic_aura_blast/stun just decay/expire on their own (plan2 §6a, and the
  -- Fear/Magic Aura Blast/Stun specials).
  constraint monster_attacks_counter_implies_effect
    check (counter_item_id is null or applies_effect is not null)
);

-- Common attacks (bite, claw) are shared across monsters; some monsters get
-- special attacks via the same join.
create table if not exists monster_movesets (
  monster_id uuid not null references monsters (id) on delete cascade,
  monster_attack_id uuid not null references monster_attacks (id) on delete cascade,
  primary key (monster_id, monster_attack_id)
);

-- A monster's moveset holds at most 2 special attacks (added later, once the
-- AI's "an affordable special always wins" rule — README "Combat math" →
-- Monster attack selection — made unlimited specials a real design risk: a
-- monster with many specials could otherwise almost never throw a normal
-- attack). Expressed as a BEFORE INSERT trigger rather than a CHECK, since
-- "count of related rows matching a condition" needs cross-row visibility a
-- single-row CHECK can't see.
create function enforce_monster_special_moveset_limit() returns trigger as $$
declare
  is_new_attack_special boolean;
  existing_special_count integer;
begin
  select is_special into is_new_attack_special
  from monster_attacks
  where id = new.monster_attack_id;

  if is_new_attack_special then
    select count(*) into existing_special_count
    from monster_movesets mm
    join monster_attacks ma on ma.id = mm.monster_attack_id
    where mm.monster_id = new.monster_id and ma.is_special;

    if existing_special_count >= 2 then
      raise exception 'Monster % already has 2 special attacks in its moveset', new.monster_id
        using errcode = '23514'; -- check_violation, so callers can catch it the same way as other CHECKs
    end if;
  end if;

  return new;
end;
$$ language plpgsql;

create trigger monster_movesets_special_limit
  before insert on monster_movesets
  for each row
  execute function enforce_monster_special_moveset_limit();
