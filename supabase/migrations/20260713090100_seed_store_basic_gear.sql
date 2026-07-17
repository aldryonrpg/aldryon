-- Basic store-bought gear (plan3 Store follow-up): one 'basic'-rarity item
-- per equipment slot, plus a basic weapon per weapon archetype. `value`
-- doubles as the store price — the store lists every basic/common/uncommon
-- item, so these show up there automatically, no separate listings table
-- needed. Physical weapons/gear give a small Force bonus ("Strength"); the
-- two Intelligence-scaled weapons (Wand, one-handed; Staff, two-handed)
-- give Intelligence instead, +1 for the one-handed Wand and +2 for the
-- two-handed Staff — the same one-handed/two-handed 1-vs-2 convention.
insert into items (id, name, description, value, rarity, slot, vitality)
values (gen_random_uuid(), 'Basic Helmet', 'A simple iron helmet.', 30, 'basic', 'helmet', 1)
on conflict (name) do nothing;

insert into items (id, name, description, value, rarity, slot, vitality)
values (gen_random_uuid(), 'Basic Armor', 'A simple padded tunic.', 40, 'basic', 'body', 1)
on conflict (name) do nothing;

insert into items (id, name, description, value, rarity, slot, agility)
values (gen_random_uuid(), 'Basic Boots', 'Sturdy leather boots.', 25, 'basic', 'boots', 1)
on conflict (name) do nothing;

insert into items (id, name, description, value, rarity, slot, dexterity)
values (gen_random_uuid(), 'Basic Gloves', 'Simple leather gloves.', 25, 'basic', 'gloves', 1)
on conflict (name) do nothing;

insert into items (id, name, description, value, rarity, slot, luck)
values (gen_random_uuid(), 'Basic Necklace', 'A plain beaded necklace.', 30, 'basic', 'necklace', 1)
on conflict (name) do nothing;

insert into items (id, name, description, value, rarity, slot, luck)
values (gen_random_uuid(), 'Basic Bracelet', 'A plain copper bracelet.', 30, 'basic', 'bracelet', 1)
on conflict (name) do nothing;

insert into items (id, name, description, value, rarity, slot, force)
values (gen_random_uuid(), 'Sword', 'A basic one-handed blade.', 40, 'basic', 'weapon', 1)
on conflict (name) do nothing;

insert into items (id, name, description, value, rarity, slot, force)
values (gen_random_uuid(), 'Shield', 'A basic one-handed shield.', 35, 'basic', 'weapon', 1)
on conflict (name) do nothing;

insert into items (id, name, description, value, rarity, slot, force)
values (gen_random_uuid(), 'Bow', 'A basic one-handed shortbow.', 40, 'basic', 'weapon', 1)
on conflict (name) do nothing;

insert into items (id, name, description, value, rarity, slot, force)
values (gen_random_uuid(), '2-Hand Axe', 'A basic two-handed axe.', 70, 'basic', 'two_handed_weapon', 2)
on conflict (name) do nothing;

insert into items (id, name, description, value, rarity, slot, intelligence)
values (gen_random_uuid(), 'Wand', 'A basic one-handed wand.', 40, 'basic', 'weapon', 1)
on conflict (name) do nothing;

insert into items (id, name, description, value, rarity, slot, intelligence)
values (gen_random_uuid(), '2-Handed Staff', 'A basic two-handed staff.', 70, 'basic', 'two_handed_weapon', 2)
on conflict (name) do nothing;
