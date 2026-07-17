-- counter_item_id is now centralized in effect_counters, keyed by
-- battle_effect_kind rather than duplicated per attack row (never actually
-- populated on either table anyway — every seeded attack left it null).
alter table monster_attacks drop constraint monster_attacks_counter_implies_effect;
alter table monster_attacks drop column counter_item_id;
alter table attacks drop column counter_item_id;
