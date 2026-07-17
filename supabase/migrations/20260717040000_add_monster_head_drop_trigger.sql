-- Every monster automatically drops a "<Monster Name> Head" trophy item —
-- pure gold value, no stats, not part of any set. Priced at
-- `monster.level * 50` so it scales consistently with every monster
-- (including a materialized dungeon boss row, whose level is the tier's
-- boss-equivalent level). dropRate 10 on the per-mille scale = 10/1000 =
-- 1% per kill, added to the monster's own regular `drops` pool (not
-- exclusive/legendary).
--
-- Not store-purchasable (the store never sells it) but sellable like any
-- other item via SellItemUseCase — a pure "kill it, sell the head" gold
-- sink/source, nothing more.
--
-- Implemented as a BEFORE INSERT trigger on `monsters` so every future
-- monster (including ones added later, or a freshly materialized dungeon
-- boss) gets its Head item + drop entry automatically, with no per-monster
-- seed migration ever needed again.
create function seed_monster_head_drop() returns trigger as $$
declare
  v_item_id uuid;
begin
  insert into items (id, name, description, value, rarity, slot, store_purchasable)
  values (
    gen_random_uuid(),
    NEW.name || ' Head',
    'The severed head of a slain ' || NEW.name || ', worth its weight in gold.',
    NEW.level * 50,
    'uncommon',
    null,
    false
  )
  -- Upsert-and-always-return-the-id: a true no-op update (not DO NOTHING)
  -- so RETURNING still fires if this monster name's Head already exists.
  on conflict (name) do update set name = items.name
  returning id into v_item_id;

  NEW.drops := coalesce(NEW.drops, '[]'::jsonb)
    || jsonb_build_array(jsonb_build_object('itemId', v_item_id, 'dropRate', 10));

  return NEW;
end;
$$ language plpgsql;

create trigger monsters_seed_head_drop
  before insert on monsters
  for each row
  execute function seed_monster_head_drop();

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
      m.name || ' Head',
      'The severed head of a slain ' || m.name || ', worth its weight in gold.',
      m.level * 50,
      'uncommon',
      null,
      false
    )
    on conflict (name) do update set name = items.name
    returning id into v_item_id;

    update monsters
    set drops = coalesce(drops, '[]'::jsonb)
      || jsonb_build_array(jsonb_build_object('itemId', v_item_id, 'dropRate', 10))
    where id = m.id;
  end loop;
end $$;
