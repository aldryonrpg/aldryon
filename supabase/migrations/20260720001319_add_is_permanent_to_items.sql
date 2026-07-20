-- Marks catalog items that live in the Bag's permanent, capacity-exempt
-- slots (Bandage/Antidote/the three POT variants) so the client can group
-- the Bag UI without duplicating name-matching logic. Defaults to false for
-- everything else; the backend's actual capacity/placement rules (see
-- apps/api/src/domain/player/Bag.ts's SPECIAL_SLOT_ITEM_NAMES/POT_ITEM_NAMES)
-- are unchanged by this column — it's an additive display fact, not a
-- replacement for the finer special-vs-pot capacity distinction those still
-- need.
alter table public.items
  add column is_permanent boolean not null default false;

update public.items
  set is_permanent = true
  where name in ('bandage', 'antidote', 'small pot', 'medium pot', 'big pot');
