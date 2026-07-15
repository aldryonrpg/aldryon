-- New players start with 10 in each of the six attributes (raised from 1),
-- matching GetOrCreatePlayerUseCase's own default. Column DEFAULT only
-- applies to future inserts — doesn't touch any existing players row.
alter table players
  alter column force set default 10,
  alter column dexterity set default 10,
  alter column agility set default 10,
  alter column intelligence set default 10,
  alter column vitality set default 10,
  alter column luck set default 10;
