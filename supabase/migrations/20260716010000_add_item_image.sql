-- No item artwork exists yet — nullable so the store/UI can fall back to a
-- placeholder (a plain SVG circle) client-side, unlike monsters.monster_image
-- which is required because every monster already has one.
alter table items add column item_image text null;
