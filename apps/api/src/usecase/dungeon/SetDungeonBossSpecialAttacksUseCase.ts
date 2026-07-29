import type { DungeonBossRepository } from "@/usecase/dungeon/DungeonBossRepository";
import { DungeonBossNotFoundError } from "@/usecase/dungeon/errors";
import { MonsterAttackNotFoundError } from "@/usecase/monster/errors";
import type { MonsterAttackRepository } from "@/usecase/monster/MonsterAttackRepository";

export interface SetDungeonBossSpecialAttacksInput {
  dungeonBossId: string;
  /** 0-2 ids, already deduplicated by the Zod request schema
   * (SetDungeonBossSpecialAttacksRequestSchema's .refine()) — count is also
   * capped there (.max(2)), so both are re-checked at the DB level too
   * (dungeon_boss_movesets_special_limit trigger) as defense-in-depth, not
   * re-validated here. */
  attackIds: string[];
}

/**
 * PUT /admin/dungeon-bosses/:id/special-attacks. Replaces a dungeon boss's
 * special-attack links wholesale — every id must reference an existing,
 * actually-special MonsterAttack, or this rejects the whole set rather than
 * silently dropping the bad ones. Regular (non-special) moveset entries are
 * untouched (see MonsterAttackRepository.setDungeonBossSpecialAttacks).
 */
export class SetDungeonBossSpecialAttacksUseCase {
  constructor(
    private readonly dungeonBossRepository: DungeonBossRepository,
    private readonly monsterAttackRepository: MonsterAttackRepository,
  ) {}

  async execute(input: SetDungeonBossSpecialAttacksInput): Promise<string[]> {
    const boss = await this.dungeonBossRepository.findById(input.dungeonBossId);
    if (!boss) throw new DungeonBossNotFoundError();

    for (const attackId of input.attackIds) {
      const attack = await this.monsterAttackRepository.findById(attackId);
      if (!attack) throw new MonsterAttackNotFoundError();
      if (!attack.isSpecial) {
        throw new Error(`Monster attack "${attack.name}" is not a special attack`);
      }
    }

    await this.monsterAttackRepository.setDungeonBossSpecialAttacks(
      input.dungeonBossId,
      input.attackIds,
    );
    return input.attackIds;
  }
}
