import type { DungeonBossRepository } from "@/usecase/dungeon/DungeonBossRepository";
import { DungeonBossNotFoundError } from "@/usecase/dungeon/errors";
import { MonsterAttackNotFoundError } from "@/usecase/monster/errors";
import type { MonsterAttackRepository } from "@/usecase/monster/MonsterAttackRepository";

export interface SetDungeonBossNormalAttacksInput {
  dungeonBossId: string;
  /** Deduplicated by the Zod request schema
   * (SetDungeonBossNormalAttacksRequestSchema's .refine()) — no count cap,
   * unlike special attacks (SetDungeonBossSpecialAttacksUseCase). */
  attackIds: string[];
}

/**
 * PUT /admin/dungeon-bosses/:id/normal-attacks. Replaces a dungeon boss's
 * normal-attack links wholesale — every id must reference an existing,
 * non-special MonsterAttack, or this rejects the whole set rather than
 * silently dropping the bad ones. Special attacks are set separately (see
 * SetDungeonBossSpecialAttacksUseCase) and are never touched here (see
 * MonsterAttackRepository.setDungeonBossNormalAttacks).
 */
export class SetDungeonBossNormalAttacksUseCase {
  constructor(
    private readonly dungeonBossRepository: DungeonBossRepository,
    private readonly monsterAttackRepository: MonsterAttackRepository,
  ) {}

  async execute(input: SetDungeonBossNormalAttacksInput): Promise<string[]> {
    const boss = await this.dungeonBossRepository.findById(input.dungeonBossId);
    if (!boss) throw new DungeonBossNotFoundError();

    for (const attackId of input.attackIds) {
      const attack = await this.monsterAttackRepository.findById(attackId);
      if (!attack) throw new MonsterAttackNotFoundError();
      if (attack.isSpecial) {
        throw new Error(
          `Monster attack "${attack.name}" is a special attack — set it via the special-attacks endpoint`,
        );
      }
    }

    await this.monsterAttackRepository.setDungeonBossNormalAttacks(
      input.dungeonBossId,
      input.attackIds,
    );
    return input.attackIds;
  }
}
