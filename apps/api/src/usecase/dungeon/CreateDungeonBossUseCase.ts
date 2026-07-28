import { DungeonBoss } from "@/domain/dungeon/DungeonBoss";
import type { DropTuple, MonsterType } from "@/domain/monster/Monster";
import type { AttributeValues } from "@/domain/shared/Attributes";
import type { DungeonBossRepository } from "@/usecase/dungeon/DungeonBossRepository";
import { DuplicateDungeonBossNameError } from "@/usecase/dungeon/errors";

export interface CreateDungeonBossInput {
  name: string;
  description: string;
  monsterImage: string;
  monsterType: MonsterType;
  baseHp: number;
  baseXpGain: number;
  baseMaxStamina: number;
  baseAttributes: AttributeValues;
  drops: DropTuple[];
  exclusiveDrops: DropTuple[];
  legendaryDrops: DropTuple[];
}

/**
 * POST /admin/dungeon-bosses (plan9 follow-up). Same shape as
 * CreateMonsterUseCase: the DB's `name` unique constraint is the backstop,
 * `findByName` just turns that into a friendly domain error, and
 * DungeonBoss.create() is the one place its invariants (baseHp≥1,
 * baseXpGain≥0, baseMaxStamina≥1) live. A newly created boss still needs
 * its moveset linked in `dungeon_boss_movesets` by hand afterward — same
 * limitation the Monster admin screen has for a new monster's moveset.
 */
export class CreateDungeonBossUseCase {
  constructor(private readonly dungeonBossRepository: DungeonBossRepository) {}

  async execute(input: CreateDungeonBossInput): Promise<DungeonBoss> {
    const existing = await this.dungeonBossRepository.findByName(input.name);
    if (existing) throw new DuplicateDungeonBossNameError(input.name);

    const dungeonBoss = DungeonBoss.create({ id: Bun.randomUUIDv7(), ...input });
    return this.dungeonBossRepository.create(dungeonBoss);
  }
}
