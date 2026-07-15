-- Plan 2 gameplay domain — shared enums used by players/items/monsters/
-- attacks/battles. See plans/plan2.md §3 for the field-by-field rationale.
-- Full ladder (plan3 Store follow-up): 'basic' is store-only stock, never a
-- monster drop; the rest is the drop ladder in ascending rarity —
-- common 60% / uncommon 30% / rare 6% / very_rare 3% / legendary ~1% or
-- less (a content-authoring guideline for future drop-pool dropRate values,
-- not runtime-enforced — see domain/item/itemRarityColors.ts). 'unique'
-- means at most one such item ever exists on the server, hand-placed, not
-- rolled at all.
create type item_rarity as enum (
  'basic', 'common', 'uncommon', 'rare', 'very_rare', 'legendary', 'unique'
);

-- What an item can occupy (items.slot) vs where it physically sits on a
-- player (player_items.equipped_slot) differ for weapons — a `weapon` item
-- fits either hand, so it needs two distinct enums (plan2 §3d).
-- 'bracelet' is a single physical position for both Bracelet- and Ring-type
-- items (plan3 §3) — no left/right choice like weapons.
create type equipment_slot as enum (
  'helmet', 'body', 'boots', 'gloves', 'necklace', 'bracelet', 'weapon', 'two_handed_weapon'
);
create type equipment_position as enum (
  'helmet', 'body', 'boots', 'gloves', 'necklace', 'bracelet', 'weapon_1', 'weapon_2'
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
