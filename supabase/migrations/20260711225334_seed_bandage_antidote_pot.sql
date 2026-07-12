-- Seed items that exist from day one (plan2 §7/§10): bandage (cures bleed)
-- and antidote (cure poison) at 50 gold each, common, not equippable; plus
-- one POT (HP restore consumable) so the game is playable end-to-end.
insert into items (id, name, description, value, rarity, hp_restore)
values (
  gen_random_uuid(), 'bandage', 'A rough cloth wrap. Stops the bleeding.', 50, 'common', null
)
on conflict (name) do nothing;

insert into items (id, name, description, value, rarity, hp_restore)
values (
  gen_random_uuid(), 'antidote', 'A bitter tonic that neutralizes poison.', 50, 'common', null
)
on conflict (name) do nothing;

insert into items (id, name, description, value, rarity, hp_restore)
values (
  gen_random_uuid(), 'small pot', 'A small clay pot of restorative salve.', 25, 'common', 50
)
on conflict (name) do nothing;
