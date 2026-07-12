import type { Attack } from "@/domain/attack/Attack";
import type { MonsterAttack } from "@/domain/monster/MonsterAttack";

/**
 * A side's defensive "stance" (plan2 §6: "defender's current-stance
 * attack") is its default HIT attack's scaling attribute. The battles table
 * (plan2 §3h) has no persisted "last attack used" column, so this stays
 * fixed for the whole battle rather than tracking per-turn state that isn't
 * part of the schema — a deliberate simplification of the "current-stance"
 * rule, documented here rather than left ambiguous.
 */
export function defaultPlayerAttack(attacks: Attack[]): Attack {
  const attack = attacks.find((a) => a.name === "HIT") ?? attacks[0];
  if (!attack) throw new Error("No player attacks available — HIT must be seeded");
  return attack;
}

export function defaultMonsterAttack(moveset: MonsterAttack[]): MonsterAttack {
  const attack = moveset.find((a) => a.name === "HIT") ?? moveset[0];
  if (!attack) throw new Error("Monster has no moveset — HIT must be seeded");
  return attack;
}
