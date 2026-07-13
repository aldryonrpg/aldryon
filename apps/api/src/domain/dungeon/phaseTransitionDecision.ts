export type PhaseTransitionDecision = { kind: "partialSettlement" } | { kind: "fullSettlement" };

/**
 * Whether a monster's death inside a battle is the dungeon gatekeeper falling
 * (partial settlement: award XP/loot, swap in the boss, keep the battle
 * alive — plan3 §2d) or the final kill (full settlement, exactly like any
 * ordinary battle win). Ordinary (non-dungeon) battles always get
 * "fullSettlement" since dungeonBossMonsterId is null for them.
 */
export function decidePhaseTransition(
  dungeonBossMonsterId: string | null,
): PhaseTransitionDecision {
  return dungeonBossMonsterId !== null ? { kind: "partialSettlement" } : { kind: "fullSettlement" };
}
