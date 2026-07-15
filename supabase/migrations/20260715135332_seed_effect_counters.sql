-- One row per battle_effect_kind (matches the resolveCounterItemId lookup
-- in apps/api). bleed/poison cure with bandage/antidote; burn/fear/
-- magic_aura_blast/stun have no counter item — they just run their course
-- (plan2 §6a) — seeded here anyway so the table is a complete reference of
-- every effect kind, not just the ones that happen to have a cure today.
insert into effect (effect_kind, item_counter_id)
select 'bleed'::battle_effect_kind, id from items where name = 'bandage'
union all
select 'poison'::battle_effect_kind, id from items where name = 'antidote'
union all
select 'burn'::battle_effect_kind, null::uuid
union all
select 'fear'::battle_effect_kind, null::uuid
union all
select 'magic_aura_blast'::battle_effect_kind, null::uuid
union all
select 'stun'::battle_effect_kind, null::uuid
on conflict (effect_kind) do nothing;
