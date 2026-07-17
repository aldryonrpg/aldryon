-- Display color per rarity tier (plan3 Store follow-up) — item names
-- always render in their rarity's color. Seeded here as the canonical
-- source; apps/api mirrors it as a static domain constant
-- (domain/item/itemRarityColors.ts) rather than joining this table on
-- every item read, since it's static reference data that essentially never
-- changes — this table is the record of what was seeded/intended, kept in
-- sync with that constant by hand.
create table if not exists item_rarity_colors (
  rarity item_rarity primary key,
  color text not null
);

insert into item_rarity_colors (rarity, color) values
  ('basic', 'white'),
  ('common', 'gray'),
  ('uncommon', 'green'),
  ('rare', 'blue'),
  ('very_rare', 'purple'),
  ('legendary', 'gold'),
  ('unique', 'red')
on conflict (rarity) do nothing;
