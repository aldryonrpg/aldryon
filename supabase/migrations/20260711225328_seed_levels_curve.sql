-- 20-row exponential XP curve (plan2 §6b): level 1 = 0 XP, level 20 = the
-- 1,000,000 cap. xp_required(level) = ceil(1_000_000 * (1.1^(level-1) - 1) /
-- (1.1^19 - 1)) — this formula only lives here in the seeder; the game reads
-- the table. Growth is a tunable proposal (plan2 §10 "Open").
insert into levels (level, xp_required) values
  (1, 0),
  (2, 19547),
  (3, 41049),
  (4, 64701),
  (5, 90718),
  (6, 119336),
  (7, 150817),
  (8, 185445),
  (9, 223536),
  (10, 265437),
  (11, 311527),
  (12, 362227),
  (13, 417996),
  (14, 479343),
  (15, 546824),
  (16, 621053),
  (17, 702705),
  (18, 792522),
  (19, 891322),
  (20, 1000000)
on conflict (level) do nothing;
