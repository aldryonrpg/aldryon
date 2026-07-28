import type { DropTuple, MonsterRegion, MonsterType } from "@/domain/monster/Monster";
import { Monster } from "@/domain/monster/Monster";
import type { AttributeValues } from "@/domain/shared/Attributes";
import { DuplicateMonsterNameError } from "@/usecase/monster/errors";
import type { MonsterRepository } from "@/usecase/monster/MonsterRepository";

export interface CreateMonsterInput {
  name: string;
  description: string;
  region: MonsterRegion;
  monsterImage: string;
  hp: number;
  xpGain: number;
  level: number;
  maxStamina: number;
  attributes: AttributeValues;
  monsterType: MonsterType;
  drops: DropTuple[];
  exclusiveDrops: DropTuple[];
  legendaryDrops: DropTuple[];
  ambushChance: number;
}

/**
 * POST /admin/monsters (plan9 §4). The DB's `name` unique constraint is the
 * backstop; the findByName check here just turns that into a friendly
 * domain error instead of a raw constraint-violation. Validation (hp≥1,
 * ambushChance 0-100, drop-pool bounds, ...) is never duplicated here —
 * Monster.create() is the one place those invariants live.
 */
export class CreateMonsterUseCase {
  constructor(private readonly monsterRepository: MonsterRepository) {}

  async execute(input: CreateMonsterInput): Promise<Monster> {
    const existing = await this.monsterRepository.findByName(input.name);
    if (existing) throw new DuplicateMonsterNameError(input.name);

    const monster = Monster.create({ id: Bun.randomUUIDv7(), ...input });
    return this.monsterRepository.create(monster);
  }
}
