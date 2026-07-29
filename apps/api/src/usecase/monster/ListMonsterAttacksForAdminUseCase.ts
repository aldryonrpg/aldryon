import type { MonsterAttack } from "@/domain/monster/MonsterAttack";
import type { MonsterAttackRepository } from "@/usecase/monster/MonsterAttackRepository";

/** GET /admin/monster-attacks — the full monster attack catalog. */
export class ListMonsterAttacksForAdminUseCase {
  constructor(private readonly monsterAttackRepository: MonsterAttackRepository) {}

  async execute(): Promise<MonsterAttack[]> {
    return this.monsterAttackRepository.findAll();
  }
}
