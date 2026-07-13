import { Player } from "@/domain/player/Player";
import type { AttributeValues } from "@/domain/shared/Attributes";
import { ATTRIBUTE_KEYS } from "@/domain/shared/Attributes";
import { InsufficientAttributePointsError } from "@/usecase/player/errors";
import type { PlayerRepository } from "@/usecase/player/PlayerRepository";

export interface AllocateAttributePointsInput {
  playerId: string;
  allocations: Partial<Record<keyof AttributeValues, number>>;
}

export interface AllocateAttributePointsOutput {
  attributes: AttributeValues;
  attributePoints: number;
}

/**
 * Spends accumulated attribute points (plan2 §6b): base attributes only
 * ever go up, so the >=1 floor can't be violated here.
 */
export class AllocateAttributePointsUseCase {
  constructor(private readonly playerRepository: PlayerRepository) {}

  async execute(input: AllocateAttributePointsInput): Promise<AllocateAttributePointsOutput> {
    const player = await this.playerRepository.findById(input.playerId);
    if (!player) throw new Error("Player not found");

    let totalRequested = 0;
    for (const key of ATTRIBUTE_KEYS) {
      const amount = input.allocations[key] ?? 0;
      if (amount < 0 || !Number.isInteger(amount)) {
        throw new Error(`Invalid allocation for ${key}: must be a non-negative integer`);
      }
      totalRequested += amount;
    }

    if (totalRequested > player.attributePoints) {
      throw new InsufficientAttributePointsError();
    }

    const base = player.getAttributes();
    const nextAttributes: AttributeValues = { ...base.toValues() };
    for (const key of ATTRIBUTE_KEYS) {
      nextAttributes[key] += input.allocations[key] ?? 0;
    }

    const updated = Player.create({
      ...player.toProps(),
      attributes: nextAttributes,
      attributePoints: player.attributePoints - totalRequested,
    });
    const saved = await this.playerRepository.update(updated);

    return { attributes: saved.getAttributes().toValues(), attributePoints: saved.attributePoints };
  }
}
