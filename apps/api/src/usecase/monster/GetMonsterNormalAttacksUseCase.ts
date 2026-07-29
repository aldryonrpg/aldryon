import { MonsterNotFoundError } from "@/usecase/monster/errors";
import type { MonsterAttackRepository } from "@/usecase/monster/MonsterAttackRepository";
import type { MonsterRepository } from "@/usecase/monster/MonsterRepository";

/** GET /admin/monsters/:id/normal-attacks — the ids of this monster's
 * currently-linked normal (non-special) attacks, for pre-filling the admin
 * picker. */
export class GetMonsterNormalAttacksUseCase {
  constructor(
    private readonly monsterRepository: MonsterRepository,
    private readonly monsterAttackRepository: MonsterAttackRepository,
  ) {}

  async execute(monsterId: string): Promise<string[]> {
    const monster = await this.monsterRepository.findById(monsterId);
    if (!monster) throw new MonsterNotFoundError();

    return this.monsterAttackRepository.findMonsterNormalAttackIds(monsterId);
  }
}
