import type { AttackScaling, BattleEffectKind } from "@/domain/monster/MonsterAttack";
import { MonsterAttack } from "@/domain/monster/MonsterAttack";
import {
  DuplicateMonsterAttackNameError,
  MonsterAttackNotFoundError,
} from "@/usecase/monster/errors";
import type { MonsterAttackRepository } from "@/usecase/monster/MonsterAttackRepository";

export interface UpdateMonsterAttackInput {
  id: string;
  name?: string;
  staminaCost?: number;
  multiplier?: number;
  scalingAttribute?: AttackScaling;
  appliesEffect?: BattleEffectKind | null;
  isSpecial?: boolean;
  chargeTurns?: number;
}

/**
 * PATCH /admin/monster-attacks/:id. Merges the provided fields onto the
 * existing row and re-validates through MonsterAttack.create() — same reuse
 * rationale as UpdateAttackUseCase.
 */
export class UpdateMonsterAttackUseCase {
  constructor(private readonly monsterAttackRepository: MonsterAttackRepository) {}

  async execute(input: UpdateMonsterAttackInput): Promise<MonsterAttack> {
    const existing = await this.monsterAttackRepository.findById(input.id);
    if (!existing) throw new MonsterAttackNotFoundError();

    if (input.name && input.name !== existing.name) {
      const nameOwner = await this.monsterAttackRepository.findByName(input.name);
      if (nameOwner && nameOwner.id !== input.id) {
        throw new DuplicateMonsterAttackNameError(input.name);
      }
    }

    const { id, ...patch } = input;
    const merged = MonsterAttack.create({ ...existing.toProps(), ...patch });

    return this.monsterAttackRepository.update(merged);
  }
}
