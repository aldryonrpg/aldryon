-- A materialized dungeon boss inserts up to 3 monsters rows (one per tier,
-- plan3 §2c) that legitimately share the same boss art — only the name/
-- stats differ per tier. The original "one image per monster" unique
-- constraint (plan2 §3c) never anticipated multiple catalog rows sharing an
-- image on purpose, so it's dropped here rather than worked around with a
-- synthetic per-tier image variant.
alter table monsters drop constraint monsters_monster_image_key;
