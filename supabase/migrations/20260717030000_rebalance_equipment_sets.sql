-- Equipment-sets balance follow-up, decided directly with the user:
--
-- 1. Basic/Leather set gains its missing Ring piece (every other tier
--    already has one — Bracelet gives +1 Strength, Ring gives +1
--    Intelligence, alternatives for the same physical slot). Store-
--    purchasable, since Leather is the only set the store ever sells.
insert into items (
  id, name, description, value, rarity, slot, intelligence,
  set_name, store_purchasable
)
values (
  gen_random_uuid(), 'Basic Ring', 'A ring wrapped in simple leather.', 50,
  'basic', 'bracelet', 1, 'leather', true
)
on conflict (name) do nothing;

-- 2. Every Basic/Leather piece (incl. the new Ring) gets a uniform 50 gold
--    price and a description that actually mentions leather — the old
--    descriptions were a mismatched mix ("simple iron helmet", "plain
--    copper bracelet") left over from before the set system existed.
--    50 is also the correct baseline the Iron/Silver/Gold/Platinum prices
--    already triple from (50 -> 150 -> 450 -> 1350 -> 4050).
update items set value = 50, description = 'A helmet crafted from simple leather.'
  where name = 'Basic Helmet';
update items set value = 50, description = 'A tunic crafted from simple leather.'
  where name = 'Basic Armor';
update items set value = 50, description = 'Boots crafted from simple leather.'
  where name = 'Basic Boots';
update items set value = 50, description = 'Gloves crafted from simple leather.'
  where name = 'Basic Gloves';
update items set value = 50, description = 'A necklace strung on simple leather cord.'
  where name = 'Basic Necklace';
update items set value = 50, description = 'A bracelet crafted from simple leather.'
  where name = 'Basic Bracelet';

-- 3. Higher tiers hit harder per piece, not just cost more: Iron/Silver
--    double every piece's individual attribute bonus, Gold triples it,
--    Platinum quadruples it. Each item has exactly one non-zero attribute
--    column at 1, so multiplying all six is safe (the other five stay at
--    0). The set-COMPLETION bonus (domain/player/equipmentSetBonus.ts,
--    env-configurable SET_ATTRIBUTE_BONUS) is deliberately NOT scaled by
--    tier — it stays the same flat value regardless of which set is
--    completed; only these per-piece bonuses vary by tier.
update items set
  strength = strength * 2, dexterity = dexterity * 2, agility = agility * 2,
  intelligence = intelligence * 2, vitality = vitality * 2, luck = luck * 2
  where set_name in ('iron', 'silver');

update items set
  strength = strength * 3, dexterity = dexterity * 3, agility = agility * 3,
  intelligence = intelligence * 3, vitality = vitality * 3, luck = luck * 3
  where set_name = 'gold';

update items set
  strength = strength * 4, dexterity = dexterity * 4, agility = agility * 4,
  intelligence = intelligence * 4, vitality = vitality * 4, luck = luck * 4
  where set_name = 'platinum';

-- 4. A new Cloth Set: common rarity, 100 gold/piece, drop-only (sits between
--    Leather and Iron) — same 6-slot shape (+ Ring alternative for the
--    bracelet slot) and the same unscaled +1-per-piece baseline as Leather,
--    since no tier multiplier was specified for it.
insert into items (id, name, description, value, rarity, slot, vitality, set_name, store_purchasable)
values (gen_random_uuid(), 'Cloth Helmet', 'A hood woven from simple cloth.', 100, 'common', 'helmet', 1, 'cloth', false)
on conflict (name) do nothing;
insert into items (id, name, description, value, rarity, slot, vitality, set_name, store_purchasable)
values (gen_random_uuid(), 'Cloth Armor', 'A robe woven from simple cloth.', 100, 'common', 'body', 1, 'cloth', false)
on conflict (name) do nothing;
insert into items (id, name, description, value, rarity, slot, agility, set_name, store_purchasable)
values (gen_random_uuid(), 'Cloth Boots', 'Boots wrapped in simple cloth.', 100, 'common', 'boots', 1, 'cloth', false)
on conflict (name) do nothing;
insert into items (id, name, description, value, rarity, slot, dexterity, set_name, store_purchasable)
values (gen_random_uuid(), 'Cloth Gloves', 'Gloves woven from simple cloth.', 100, 'common', 'gloves', 1, 'cloth', false)
on conflict (name) do nothing;
insert into items (id, name, description, value, rarity, slot, luck, set_name, store_purchasable)
values (gen_random_uuid(), 'Cloth Necklace', 'A necklace strung on a simple cloth cord.', 100, 'common', 'necklace', 1, 'cloth', false)
on conflict (name) do nothing;
insert into items (id, name, description, value, rarity, slot, strength, set_name, store_purchasable)
values (gen_random_uuid(), 'Cloth Bracelet', 'A bracelet woven from simple cloth.', 100, 'common', 'bracelet', 1, 'cloth', false)
on conflict (name) do nothing;
insert into items (id, name, description, value, rarity, slot, intelligence, set_name, store_purchasable)
values (gen_random_uuid(), 'Cloth Ring', 'A ring wrapped in simple cloth.', 100, 'common', 'bracelet', 1, 'cloth', false)
on conflict (name) do nothing;
