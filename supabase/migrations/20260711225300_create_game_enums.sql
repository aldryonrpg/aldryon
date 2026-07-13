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
-- bleed/poison/burn are damage-over-time; fear/magic_aura_blast are
-- percentage stat-decay debuffs (Force/Intelligence) and stun skips the
-- player's next turns — all delivered via a monster's special attack
-- (monster_attacks.applies_effect), never cured by an item.
create type battle_effect_kind as enum (
  'bleed', 'poison', 'burn', 'fear', 'magic_aura_blast', 'stun'
);
-- Dungeon is not a region — it's an entirely separate concept (plan3 §2),
-- accessed only via its own dedicated endpoint, never via /battle/start.
create type monster_region as enum ('mountain', 'forest', 'bandit', 'sewage', 'ruins');
-- A monster's innate on-hit ability (plan2 §3c/§6a): normal -> bleed, poisonous -> poison.
create type monster_type as enum ('normal', 'poisonous');
