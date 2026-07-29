import type { DungeonBossRepository } from "@/usecase/dungeon/DungeonBossRepository";
import { DungeonBossNotFoundError } from "@/usecase/dungeon/errors";
import type { MonsterAttackRepository } from "@/usecase/monster/MonsterAttackRepository";

/** GET /admin/dungeon-bosses/:id/special-attacks — the 0-2 special attack
 * ids currently linked to this boss, for pre-filling the admin picker. */
export class GetDungeonBossSpecialAttacksUseCase {
  constructor(
    private readonly dungeonBossRepository: DungeonBossRepository,
    private readonly monsterAttackRepository: MonsterAttackRepository,
  ) {}

  async execute(dungeonBossId: string): Promise<string[]> {
    const boss = await this.dungeonBossRepository.findById(dungeonBossId);
    if (!boss) throw new DungeonBossNotFoundError();

    return this.monsterAttackRepository.findDungeonBossSpecialAttackIds(dungeonBossId);
  }
}
