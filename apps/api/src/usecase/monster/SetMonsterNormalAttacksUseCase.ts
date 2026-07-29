import { MonsterAttackNotFoundError, MonsterNotFoundError } from "@/usecase/monster/errors";
import type { MonsterAttackRepository } from "@/usecase/monster/MonsterAttackRepository";
import type { MonsterRepository } from "@/usecase/monster/MonsterRepository";

export interface SetMonsterNormalAttacksInput {
  monsterId: string;
  /** Deduplicated by the Zod request schema
   * (SetMonsterNormalAttacksRequestSchema's .refine()) — no count cap, unlike
   * special attacks. */
  attackIds: string[];
}

/**
 * PUT /admin/monsters/:id/normal-attacks. Replaces a monster's normal-attack
 * links wholesale — every id must reference an existing, non-special
 * MonsterAttack, or this rejects the whole set rather than silently
 * dropping the bad ones. Special attacks are boss-only and are never
 * touched here (see MonsterAttackRepository.setMonsterNormalAttacks).
 */
export class SetMonsterNormalAttacksUseCase {
  constructor(
    private readonly monsterRepository: MonsterRepository,
    private readonly monsterAttackRepository: MonsterAttackRepository,
  ) {}

  async execute(input: SetMonsterNormalAttacksInput): Promise<string[]> {
    const monster = await this.monsterRepository.findById(input.monsterId);
    if (!monster) throw new MonsterNotFoundError();

    for (const attackId of input.attackIds) {
      const attack = await this.monsterAttackRepository.findById(attackId);
      if (!attack) throw new MonsterAttackNotFoundError();
      if (attack.isSpecial) {
        throw new Error(
          `Monster attack "${attack.name}" is a special attack — special attacks are boss-only`,
        );
      }
    }

    await this.monsterAttackRepository.setMonsterNormalAttacks(input.monsterId, input.attackIds);
    return input.attackIds;
  }
}
