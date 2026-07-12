-- Plan 2 gameplay domain — shared enums used by players/items/monsters/
-- attacks/battles. See plans/plan2.md §3 for the field-by-field rationale.
create type item_rarity as enum ('common', 'uncommon', 'rare', 'epic', 'legendary');

-- What an item can occupy (items.slot) vs where it physically sits on a
-- player (player_items.equipped_slot) differ for weapons — a `weapon` item
-- fits either hand, so it needs two distinct enums (plan2 §3d).
create type equipment_slot as enum (
  'helmet', 'body', 'boots', 'gloves', 'necklace', 'weapon', 'two_handed_weapon'
);
create type equipment_position as enum (
  'helmet', 'body', 'boots', 'gloves', 'necklace', 'weapon_1', 'weapon_2'
);

create type attack_scaling as enum ('force', 'intelligence');
create type battle_effect_kind as enum ('bleed', 'poison', 'burn');
create type monster_region as enum ('mountain', 'forest', 'dungeon', 'bandit', 'sewage', 'ruins');
-- A monster's innate on-hit ability (plan2 §3c/§6a): normal -> bleed, poisonous -> poison.
create type monster_type as enum ('normal', 'poisonous');
