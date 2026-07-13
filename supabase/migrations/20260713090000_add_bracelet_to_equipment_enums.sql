-- New equipment slot — Bracelet/Ring (plan3 §3). One physical position, not
-- two: a Ring-type item's items.slot is also 'bracelet', same as how a
-- two_handed_weapon item still resolves to a weapon_* position. Extends both
-- enums exactly like every other direct slot (helmet/body/boots/gloves/
-- necklace) already does.
alter type equipment_slot add value 'bracelet';
alter type equipment_position add value 'bracelet';
