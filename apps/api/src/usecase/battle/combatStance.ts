import type { MonsterAttack } from "@/domain/monster/MonsterAttack";

/**
 * The monster's default attack — used to pick which move a monster throws
 * in the two spots that don't go through the normal moveset-selection AI
 * (an ambush strike before the player has acted, and a parting hit as the
 * player flees): whichever moveset entry is named `HIT`, falling back to
 * the first entry if a monster has none (e.g. a boss with no `HIT` in its
 * custom moveset). Defense no longer uses a "stance" concept at all — a
 * defender's scaling attribute always matches whatever attribute the
 * incoming attack is itself scaled on (combat-balance follow-up), so there
 * used to be a `defaultPlayerAttack` counterpart here purely for computing
 * that; it's gone now that nothing needs a fixed defensive stance.
 */
export function defaultMonsterAttack(moveset: MonsterAttack[]): MonsterAttack {
  const attack = moveset.find((a) => a.name === "HIT") ?? moveset[0];
  if (!attack) throw new Error("Monster has no moveset — HIT must be seeded");
  return attack;
}
