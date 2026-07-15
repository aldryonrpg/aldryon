-- Force and Strength have always meant the same Fighter attribute in this
-- game's design (the original store-gear seed migration already called it
-- "a small Force bonus ('Strength')") — a naming split between the schema/
-- code (force) and the game's own flavor text (Strength) that's now
-- resolved in favor of Strength everywhere: schema, enum, domain, DTOs, and
-- UI all renamed together. Earlier migrations that created/seeded these
-- columns under the name "force" are left as-is (historically accurate to
-- what actually ran) — this is the one place the rename happens.
alter table players rename column force to strength;
alter table monsters rename column force to strength;
alter table items rename column force to strength;
alter table dungeon_bosses rename column base_force to base_strength;
alter table attacks rename column req_force to req_strength;
alter type attack_scaling rename value 'force' to 'strength';
