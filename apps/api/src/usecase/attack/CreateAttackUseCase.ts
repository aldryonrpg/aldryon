import { Attack } from "@/domain/attack/Attack";
import type { AttackScaling } from "@/domain/monster/MonsterAttack";
import type { AttributeValues } from "@/domain/shared/Attributes";
import type { AttackRepository } from "@/usecase/attack/AttackRepository";
import { DuplicateAttackNameError } from "@/usecase/attack/errors";

export interface CreateAttackInput {
  name: string;
  staminaCost: number;
  multiplier: number;
  scalingAttribute: AttackScaling;
  minLevel: number;
  attributeRequirements: AttributeValues;
  revealsRandomMonsterAttribute: boolean;
}

/**
 * POST /admin/attacks. Same shape as CreateItemUseCase: the DB's `name`
 * unique constraint is the backstop, `findByName` just turns that into a
 * friendly domain error, and `Attack.create()` is the one place its
 * invariants (staminaCost>=0, minLevel>=1) live.
 *
 * `appliesEffect` is never accepted here — not in CreateAttackInput, not in
 * the request schema (adminAttack.ts) — every admin-created attack is
 * unconditionally appliesEffect: null. The one player attack that ever
 * applies an effect (BURN SPELL) is existing seed data; there is currently
 * no admin-facing way to set this, by design.
 */
export class CreateAttackUseCase {
  constructor(private readonly attackRepository: AttackRepository) {}

  async execute(input: CreateAttackInput): Promise<Attack> {
    const existing = await this.attackRepository.findByName(input.name);
    if (existing) throw new DuplicateAttackNameError(input.name);

    const attack = Attack.create({ id: Bun.randomUUIDv7(), ...input, appliesEffect: null });
    return this.attackRepository.create(attack);
  }
}
