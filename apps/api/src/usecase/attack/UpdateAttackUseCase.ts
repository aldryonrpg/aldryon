import { Attack } from "@/domain/attack/Attack";
import type { AttackScaling } from "@/domain/monster/MonsterAttack";
import type { AttributeValues } from "@/domain/shared/Attributes";
import type { AttackRepository } from "@/usecase/attack/AttackRepository";
import { AttackNotFoundError, DuplicateAttackNameError } from "@/usecase/attack/errors";

export interface UpdateAttackInput {
  id: string;
  name?: string;
  staminaCost?: number;
  multiplier?: number;
  scalingAttribute?: AttackScaling;
  minLevel?: number;
  attributeRequirements?: AttributeValues;
  revealsRandomMonsterAttribute?: boolean;
}

/**
 * PATCH /admin/attacks/:id. Merges the provided fields onto the existing row
 * and re-validates through Attack.create() — same reuse rationale as
 * UpdateItemUseCase. `appliesEffect` isn't part of UpdateAttackInput at all
 * (see CreateAttackUseCase's comment) — it's absent from `patch`, so the
 * spread below always preserves the existing value unchanged.
 */
export class UpdateAttackUseCase {
  constructor(private readonly attackRepository: AttackRepository) {}

  async execute(input: UpdateAttackInput): Promise<Attack> {
    const existing = await this.attackRepository.findById(input.id);
    if (!existing) throw new AttackNotFoundError();

    if (input.name && input.name !== existing.name) {
      const nameOwner = await this.attackRepository.findByName(input.name);
      if (nameOwner && nameOwner.id !== input.id) {
        throw new DuplicateAttackNameError(input.name);
      }
    }

    const { id, ...patch } = input;
    const merged = Attack.create({ ...existing.toProps(), ...patch });

    return this.attackRepository.update(merged);
  }
}
