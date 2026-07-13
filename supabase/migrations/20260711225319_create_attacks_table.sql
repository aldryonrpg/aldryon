-- Player attack catalog (plan2 §3e). Every attack is DB seed data, tuned
-- later in the DB — never hardcoded. Attack identity is its unique `name`,
-- the key the client POSTs back to /battle/attack (plan2 §10).
create table if not exists attacks (
  id uuid primary key,
  name text not null unique,
  -- 0 is allowed for genuinely free attacks; HIT itself costs 1 (plan2 §10).
  stamina_cost integer not null check (stamina_cost >= 0),
  -- One multiplier, used both offensively and defensively (plan2 §6).
  multiplier numeric not null,
  scaling_attribute attack_scaling not null,
  -- On the player side there is exactly ONE such attack: BURN SPELL.
  applies_effect battle_effect_kind,
  -- Player-inflicted burn has no counter (monsters have no bag) — no CHECK
  -- pairing applies_effect/counter_item_id here, unlike monster_attacks.
  counter_item_id uuid references items (id),
  min_level integer not null default 1,
  req_force integer not null default 1,
  req_dexterity integer not null default 1,
  req_agility integer not null default 1,
  req_intelligence integer not null default 1,
  req_vitality integer not null default 1,
  req_luck integer not null default 1,
  created_at timestamptz not null default now()
);
