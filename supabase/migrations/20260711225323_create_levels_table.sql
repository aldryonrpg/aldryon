-- XP-per-level catalog (plan2 §3g). The curve lives here, not as a formula
-- hardcoded in the app — seeded exponentially, tunable in the DB afterward.
create table if not exists levels (
  level integer primary key check (level >= 1),
  xp_required integer not null unique check (xp_required >= 0 and xp_required <= 1000000)
);
