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
  constraint monster_attacks_effect_counter_pair
    check ((applies_effect is null) = (counter_item_id is null))
);

-- Common attacks (bite, claw) are shared across monsters; some monsters get
-- special attacks via the same join.
create table if not exists monster_movesets (
  monster_id uuid not null references monsters (id) on delete cascade,
  monster_attack_id uuid not null references monster_attacks (id) on delete cascade,
  primary key (monster_id, monster_attack_id)
);
