-- Equipment sets: wearing all 6 non-weapon slots (helmet/armor/boots/
-- gloves/necklace/bracelet-or-ring) from the same set grants a flat +2 to
-- every attribute (computed in computeSetBonus, not stored). Weapons and
-- two-handed weapons are never bound to a set.
alter table items add column set_name text null;

-- Store availability is no longer purely rarity-derived — a set tier can be
-- an otherwise store-eligible rarity (the Iron Set is 'uncommon', same as
-- big pot) but still be drop-only. Backfill preserves today's actual
-- behavior for every existing row (basic/common/uncommon were store
-- stock, everything else — e.g. the unique Dragon Blade — was not) before
-- the new sets below get an explicit override regardless of their rarity.
alter table items add column store_purchasable boolean not null default true;
update items set store_purchasable = (rarity in ('basic', 'common', 'uncommon'));

-- Tag the existing basic gear as the "Leather Set" tier for set-bonus
-- purposes — display names stay as already seeded/live ('Basic Helmet'
-- etc.), only the grouping is new.
update items set set_name = 'leather'
where name in (
  'Basic Helmet', 'Basic Armor', 'Basic Boots',
  'Basic Gloves', 'Basic Necklace', 'Basic Bracelet'
);

-- Iron Set (uncommon) — 150 gold/piece (50 * 3), drop-only.
insert into items (id, name, description, value, rarity, slot, vitality, set_name, store_purchasable)
values (gen_random_uuid(), 'Iron Helmet', 'A dull iron helm.', 150, 'uncommon', 'helmet', 1, 'iron', false)
on conflict (name) do nothing;
insert into items (id, name, description, value, rarity, slot, vitality, set_name, store_purchasable)
values (gen_random_uuid(), 'Iron Armor', 'Banded iron plating.', 150, 'uncommon', 'body', 1, 'iron', false)
on conflict (name) do nothing;
insert into items (id, name, description, value, rarity, slot, agility, set_name, store_purchasable)
values (gen_random_uuid(), 'Iron Boots', 'Heavy iron-shod boots.', 150, 'uncommon', 'boots', 1, 'iron', false)
on conflict (name) do nothing;
insert into items (id, name, description, value, rarity, slot, dexterity, set_name, store_purchasable)
values (gen_random_uuid(), 'Iron Gloves', 'Riveted iron gauntlets.', 150, 'uncommon', 'gloves', 1, 'iron', false)
on conflict (name) do nothing;
insert into items (id, name, description, value, rarity, slot, luck, set_name, store_purchasable)
values (gen_random_uuid(), 'Iron Necklace', 'A cold iron chain.', 150, 'uncommon', 'necklace', 1, 'iron', false)
on conflict (name) do nothing;
insert into items (id, name, description, value, rarity, slot, strength, set_name, store_purchasable)
values (gen_random_uuid(), 'Iron Bracelet', 'A heavy iron bracelet.', 150, 'uncommon', 'bracelet', 1, 'iron', false)
on conflict (name) do nothing;
insert into items (id, name, description, value, rarity, slot, intelligence, set_name, store_purchasable)
values (gen_random_uuid(), 'Iron Ring', 'A plain iron ring.', 150, 'uncommon', 'bracelet', 1, 'iron', false)
on conflict (name) do nothing;

-- Silver Set (rare) — 450 gold/piece (50 * 9), drop-only.
insert into items (id, name, description, value, rarity, slot, vitality, set_name, store_purchasable)
values (gen_random_uuid(), 'Silver Helmet', 'A polished silver helm.', 450, 'rare', 'helmet', 1, 'silver', false)
on conflict (name) do nothing;
insert into items (id, name, description, value, rarity, slot, vitality, set_name, store_purchasable)
values (gen_random_uuid(), 'Silver Armor', 'Gleaming silver plating.', 450, 'rare', 'body', 1, 'silver', false)
on conflict (name) do nothing;
insert into items (id, name, description, value, rarity, slot, agility, set_name, store_purchasable)
values (gen_random_uuid(), 'Silver Boots', 'Light silver-shod boots.', 450, 'rare', 'boots', 1, 'silver', false)
on conflict (name) do nothing;
insert into items (id, name, description, value, rarity, slot, dexterity, set_name, store_purchasable)
values (gen_random_uuid(), 'Silver Gloves', 'Fine silver-link gauntlets.', 450, 'rare', 'gloves', 1, 'silver', false)
on conflict (name) do nothing;
insert into items (id, name, description, value, rarity, slot, luck, set_name, store_purchasable)
values (gen_random_uuid(), 'Silver Necklace', 'A bright silver chain.', 450, 'rare', 'necklace', 1, 'silver', false)
on conflict (name) do nothing;
insert into items (id, name, description, value, rarity, slot, strength, set_name, store_purchasable)
values (gen_random_uuid(), 'Silver Bracelet', 'An engraved silver bracelet.', 450, 'rare', 'bracelet', 1, 'silver', false)
on conflict (name) do nothing;
insert into items (id, name, description, value, rarity, slot, intelligence, set_name, store_purchasable)
values (gen_random_uuid(), 'Silver Ring', 'An engraved silver ring.', 450, 'rare', 'bracelet', 1, 'silver', false)
on conflict (name) do nothing;

-- Gold Set (very_rare) — 1350 gold/piece (50 * 27), drop-only.
insert into items (id, name, description, value, rarity, slot, vitality, set_name, store_purchasable)
values (gen_random_uuid(), 'Gold Helmet', 'A gleaming gold helm.', 1350, 'very_rare', 'helmet', 1, 'gold', false)
on conflict (name) do nothing;
insert into items (id, name, description, value, rarity, slot, vitality, set_name, store_purchasable)
values (gen_random_uuid(), 'Gold Armor', 'Ornate gold plating.', 1350, 'very_rare', 'body', 1, 'gold', false)
on conflict (name) do nothing;
insert into items (id, name, description, value, rarity, slot, agility, set_name, store_purchasable)
values (gen_random_uuid(), 'Gold Boots', 'Gilded ceremonial boots.', 1350, 'very_rare', 'boots', 1, 'gold', false)
on conflict (name) do nothing;
insert into items (id, name, description, value, rarity, slot, dexterity, set_name, store_purchasable)
values (gen_random_uuid(), 'Gold Gloves', 'Gilded filigree gauntlets.', 1350, 'very_rare', 'gloves', 1, 'gold', false)
on conflict (name) do nothing;
insert into items (id, name, description, value, rarity, slot, luck, set_name, store_purchasable)
values (gen_random_uuid(), 'Gold Necklace', 'A radiant gold chain.', 1350, 'very_rare', 'necklace', 1, 'gold', false)
on conflict (name) do nothing;
insert into items (id, name, description, value, rarity, slot, strength, set_name, store_purchasable)
values (gen_random_uuid(), 'Gold Bracelet', 'A heavy gold bracelet.', 1350, 'very_rare', 'bracelet', 1, 'gold', false)
on conflict (name) do nothing;
insert into items (id, name, description, value, rarity, slot, intelligence, set_name, store_purchasable)
values (gen_random_uuid(), 'Gold Ring', 'A radiant gold ring.', 1350, 'very_rare', 'bracelet', 1, 'gold', false)
on conflict (name) do nothing;

-- Platinum Set (legendary) — 4050 gold/piece (50 * 81), drop-only.
insert into items (id, name, description, value, rarity, slot, vitality, set_name, store_purchasable)
values (gen_random_uuid(), 'Platinum Helmet', 'A gleaming platinum helm.', 4050, 'legendary', 'helmet', 1, 'platinum', false)
on conflict (name) do nothing;
insert into items (id, name, description, value, rarity, slot, vitality, set_name, store_purchasable)
values (gen_random_uuid(), 'Platinum Armor', 'Immaculate platinum plating.', 4050, 'legendary', 'body', 1, 'platinum', false)
on conflict (name) do nothing;
insert into items (id, name, description, value, rarity, slot, agility, set_name, store_purchasable)
values (gen_random_uuid(), 'Platinum Boots', 'Weightless platinum-shod boots.', 4050, 'legendary', 'boots', 1, 'platinum', false)
on conflict (name) do nothing;
insert into items (id, name, description, value, rarity, slot, dexterity, set_name, store_purchasable)
values (gen_random_uuid(), 'Platinum Gloves', 'Immaculate platinum gauntlets.', 4050, 'legendary', 'gloves', 1, 'platinum', false)
on conflict (name) do nothing;
insert into items (id, name, description, value, rarity, slot, luck, set_name, store_purchasable)
values (gen_random_uuid(), 'Platinum Necklace', 'A brilliant platinum chain.', 4050, 'legendary', 'necklace', 1, 'platinum', false)
on conflict (name) do nothing;
insert into items (id, name, description, value, rarity, slot, strength, set_name, store_purchasable)
values (gen_random_uuid(), 'Platinum Bracelet', 'A gleaming platinum bracelet.', 4050, 'legendary', 'bracelet', 1, 'platinum', false)
on conflict (name) do nothing;
insert into items (id, name, description, value, rarity, slot, intelligence, set_name, store_purchasable)
values (gen_random_uuid(), 'Platinum Ring', 'A brilliant platinum ring.', 4050, 'legendary', 'bracelet', 1, 'platinum', false)
on conflict (name) do nothing;
