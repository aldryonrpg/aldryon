-- Every monster automatically drops a "<Monster Name> Part" trophy item too
-- — same idea as the Head trigger (20260717040000), but landing in
-- exclusive_drops instead of the regular drops pool, at dropRate 300 on the
-- per-mille scale = 300/1000 = 30% per kill. 'rare' rarity, matching the
-- domain convention that exclusive_drops pools are meant to reference
-- 'rare' and above (Item.ts's ItemRarity doc comment) — the regular drops
-- pool's Head item stays 'uncommon'. Priced the same way as Head
-- (`monster.level * 50`), not store-purchasable but sellable, no slot
-- (non-equippable).
--
-- Implemented as a BEFORE INSERT trigger on `monsters`, same convention as
-- the Head trigger, so every future monster (including a freshly
-- materialized dungeon boss) gets its Part item + exclusive-drop entry
-- automatically, with no per-monster seed migration ever needed again.
create function seed_monster_part_drop() returns trigger as $$
declare
  v_item_id uuid;
begin
  insert into items (id, name, description, value, rarity, slot, store_purchasable)
  values (
    gen_random_uuid(),
    NEW.name || ' Part',
    'A rare, well-preserved part harvested from a slain ' || NEW.name || '.',
    NEW.level * 50,
    'rare',
    null,
    false
  )
  -- Upsert-and-always-return-the-id: a true no-op update (not DO NOTHING)
  -- so RETURNING still fires if this monster name's Part already exists.
  on conflict (name) do update set name = items.name
  returning id into v_item_id;

  NEW.exclusive_drops := coalesce(NEW.exclusive_drops, '[]'::jsonb)
    || jsonb_build_array(jsonb_build_object('itemId', v_item_id, 'dropRate', 300));

  return NEW;
end;
$$ language plpgsql;

create trigger monsters_seed_part_drop
  before insert on monsters
  for each row
  execute function seed_monster_part_drop();

-- Backfill every monster that already existed before this trigger — same
-- logic, applied once here instead of relying on the trigger (which only
-- fires on future inserts).
do $$
declare
  m record;
  v_item_id uuid;
begin
  for m in select id, name, level from monsters loop
    insert into items (id, name, description, value, rarity, slot, store_purchasable)
    values (
      gen_random_uuid(),
      m.name || ' Part',
      'A rare, well-preserved part harvested from a slain ' || m.name || '.',
      m.level * 50,
      'rare',
      null,
      false
    )
    on conflict (name) do update set name = items.name
    returning id into v_item_id;

    update monsters
    set exclusive_drops = coalesce(exclusive_drops, '[]'::jsonb)
      || jsonb_build_array(jsonb_build_object('itemId', v_item_id, 'dropRate', 300))
    where id = m.id;
  end loop;
end $$;
