import { DungeonBoss } from "@/domain/dungeon/DungeonBoss";
import type { DropTuple, MonsterType } from "@/domain/monster/Monster";
import type { AttributeValues } from "@/domain/shared/Attributes";
import type { DungeonBossRepository } from "@/usecase/dungeon/DungeonBossRepository";
import { DungeonBossNotFoundError, DuplicateDungeonBossNameError } from "@/usecase/dungeon/errors";

export interface UpdateDungeonBossInput {
  id: string;
  name?: string;
  description?: string;
  monsterImage?: string;
  monsterType?: MonsterType;
  baseHp?: number;
  baseXpGain?: number;
  baseMaxStamina?: number;
  baseAttributes?: AttributeValues;
  drops?: DropTuple[];
  exclusiveDrops?: DropTuple[];
  legendaryDrops?: DropTuple[];
}

/**
 * PATCH /admin/dungeon-bosses/:id (plan9 follow-up). Same shape as
 * UpdateMonsterUseCase: merges the provided fields onto the existing row and
 * re-validates the whole thing through DungeonBoss.create().
 *
 * Unlike a Monster patch, this has no live-battle propagation story to
 * worry about — nothing caches a raw DungeonBoss row. But it also doesn't
 * retroactively touch any already-materialized "`${name}` — Tier N" monster
 * rows: those were created once (materialize-or-reuse, idempotent by name)
 * and only get regenerated from these updated base stats the next time this
 * boss's daily-rotation turn comes back around and its previous rows have
 * already been cleared by whichever other boss held "today" in between (see
 * DungeonBossOfTheDayUseCase/MonsterRepository.deleteStaleDungeonBossRows).
 */
export class UpdateDungeonBossUseCase {
  constructor(private readonly dungeonBossRepository: DungeonBossRepository) {}

  async execute(input: UpdateDungeonBossInput): Promise<DungeonBoss> {
    const existing = await this.dungeonBossRepository.findById(input.id);
    if (!existing) throw new DungeonBossNotFoundError();

    if (input.name && input.name !== existing.name) {
      const nameOwner = await this.dungeonBossRepository.findByName(input.name);
      if (nameOwner && nameOwner.id !== input.id) {
        throw new DuplicateDungeonBossNameError(input.name);
      }
    }

    const { id, ...patch } = input;
    const merged = DungeonBoss.create({ ...existing.toProps(), ...patch });

    return this.dungeonBossRepository.update(merged);
  }
}
