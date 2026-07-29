import type { DungeonBossRepository } from "@/usecase/dungeon/DungeonBossRepository";
import { DungeonBossNotFoundError } from "@/usecase/dungeon/errors";
import type { MonsterAttackRepository } from "@/usecase/monster/MonsterAttackRepository";

/** GET /admin/dungeon-bosses/:id/normal-attacks — the ids of this boss's
 * currently-linked normal (non-special) attacks, for pre-filling the admin
 * picker. The boss-side counterpart to GetMonsterNormalAttacksUseCase. */
export class GetDungeonBossNormalAttacksUseCase {
  constructor(
    private readonly dungeonBossRepository: DungeonBossRepository,
    private readonly monsterAttackRepository: MonsterAttackRepository,
  ) {}

  async execute(dungeonBossId: string): Promise<string[]> {
    const boss = await this.dungeonBossRepository.findById(dungeonBossId);
    if (!boss) throw new DungeonBossNotFoundError();

    return this.monsterAttackRepository.findDungeonBossNormalAttackIds(dungeonBossId);
  }
}
