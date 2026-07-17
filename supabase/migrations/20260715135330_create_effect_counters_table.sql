-- Centralizes "which item cures which battle effect" as one row per
-- battle_effect_kind, instead of a counter item id duplicated on every
-- attacks/monster_attacks row that happens to cause that effect. Previously
-- an attack-caused effect (attack.appliesEffect) read its cure from that
-- attack's own counter_item_id (never actually seeded — always null), while
-- a monster's *innate* on-hit effect (bleed/poison from monster_type) read
-- it from a hardcoded name lookup in application code instead. Multiple
-- attacks can cause the same effect (bleed, poison, and future dungeon
-- effects), so the cure belongs to the effect kind, not to any one attack.
-- item_counter_id is nullable — some effects (burn/fear/magic_aura_blast/
-- stun) simply can't be cleared by any item; they just run their course.
create table if not exists effect (
  effect_kind battle_effect_kind primary key,
  item_counter_id uuid references items (id)
);
