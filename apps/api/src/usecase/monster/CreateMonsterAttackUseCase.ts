import type { AttackScaling, BattleEffectKind } from "@/domain/monster/MonsterAttack";
import { MonsterAttack } from "@/domain/monster/MonsterAttack";
import { DuplicateMonsterAttackNameError } from "@/usecase/monster/errors";
import type { MonsterAttackRepository } from "@/usecase/monster/MonsterAttackRepository";

export interface CreateMonsterAttackInput {
  name: string;
  staminaCost: number;
  multiplier: number;
  scalingAttribute: AttackScaling;
  appliesEffect: BattleEffectKind | null;
  isSpecial: boolean;
  chargeTurns: number;
}

/**
 * POST /admin/monster-attacks. Same shape as CreateAttackUseCase: the DB's
 * `name` unique constraint is the backstop, `findByName` just turns that
 * into a friendly domain error, and `MonsterAttack.create()` is the one
 * place its invariants (staminaCost>=0, chargeTurns>=1 when isSpecial) live.
 */
export class CreateMonsterAttackUseCase {
  constructor(private readonly monsterAttackRepository: MonsterAttackRepository) {}

  async execute(input: CreateMonsterAttackInput): Promise<MonsterAttack> {
    const existing = await this.monsterAttackRepository.findByName(input.name);
    if (existing) throw new DuplicateMonsterAttackNameError(input.name);

    const monsterAttack = MonsterAttack.create({ id: Bun.randomUUIDv7(), ...input });
    return this.monsterAttackRepository.create(monsterAttack);
  }
}
