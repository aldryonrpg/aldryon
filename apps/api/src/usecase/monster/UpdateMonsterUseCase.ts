import type { DropTuple, MonsterRegion, MonsterType } from "@/domain/monster/Monster";
import { Monster } from "@/domain/monster/Monster";
import type { AttributeValues } from "@/domain/shared/Attributes";
import type { BattleRepository } from "@/usecase/battle/BattleRepository";
import { DuplicateMonsterNameError, MonsterNotFoundError } from "@/usecase/monster/errors";
import type { MonsterCatalogCache } from "@/usecase/monster/MonsterCatalogCache";
import type { MonsterRepository } from "@/usecase/monster/MonsterRepository";

export interface UpdateMonsterInput {
  id: string;
  name?: string;
  description?: string;
  region?: MonsterRegion;
  monsterImage?: string;
  hp?: number;
  xpGain?: number;
  level?: number;
  maxStamina?: number;
  attributes?: AttributeValues;
  monsterType?: MonsterType;
  drops?: DropTuple[];
  exclusiveDrops?: DropTuple[];
  legendaryDrops?: DropTuple[];
  ambushChance?: number;
}

/**
 * PATCH /admin/monsters/:id (plan9 §4). Merges the provided fields onto the
 * existing row and re-validates the whole thing through Monster.create() —
 * a patch goes through the exact same invariants a create does, never a
 * looser path. Evicts the monster from MonsterCatalogCache afterward so a
 * live battle picks up the change immediately instead of waiting out the
 * cache's TTL, and clamps monster_current_hp down on any battle currently
 * fighting this monster so a lowered hp cap doesn't leave one showing e.g.
 * 80/50 until it happens to take enough damage.
 */
export class UpdateMonsterUseCase {
  constructor(
    private readonly monsterRepository: MonsterRepository,
    private readonly monsterCatalogCache: MonsterCatalogCache,
    private readonly battleRepository: BattleRepository,
  ) {}

  async execute(input: UpdateMonsterInput): Promise<Monster> {
    const existing = await this.monsterRepository.findById(input.id);
    if (!existing) throw new MonsterNotFoundError();

    if (input.name && input.name !== existing.name) {
      const nameOwner = await this.monsterRepository.findByName(input.name);
      if (nameOwner && nameOwner.id !== input.id) {
        throw new DuplicateMonsterNameError(input.name);
      }
    }

    const { id, ...patch } = input;
    const merged = Monster.create({ ...existing.toProps(), ...patch });

    const saved = await this.monsterRepository.update(merged);
    this.monsterCatalogCache.evict(id);
    await this.battleRepository.clampMonsterCurrentHp(id, saved.hp);
    return saved;
  }
}
