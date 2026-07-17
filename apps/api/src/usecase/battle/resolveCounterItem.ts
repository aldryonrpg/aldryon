import type { BattleEffectKind } from "@/domain/monster/MonsterAttack";
import type { EffectCounterRepository } from "@/usecase/battle/EffectCounterRepository";

/**
 * Resolves the cure item id for a battle effect kind (plan2 §6a), centralized
 * in `effect_counters` — one row per kind, shared by every attack (innate or
 * attack-caused) that can inflict it. `burn`/`fear`/`magic_aura_blast`/`stun`
 * have no cure — they just run their course.
 */
export async function resolveCounterItemId(
  kind: BattleEffectKind,
  effectCounterRepository: EffectCounterRepository,
): Promise<string | null> {
  return effectCounterRepository.findByKind(kind);
}
