-- Future item catalog rows should not show up in the Store unless someone
-- explicitly opts them in. Existing items keep whatever value they already
-- have (set explicitly by every prior migration's INSERTs) — this only
-- changes what happens when a future INSERT omits the column.
alter table items alter column store_purchasable set default false;
