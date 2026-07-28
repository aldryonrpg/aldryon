import type { Monster } from "@/domain/monster/Monster";
import type { MonsterRepository } from "@/usecase/monster/MonsterRepository";

/**
 * GET /admin/monsters (plan9 §4) — the wild catalog, uncached. Unlike
 * gameplay reads (which go through MonsterCatalogCache), the admin screen
 * must always reflect the latest write. Excludes materialized dungeon-boss
 * rows ("`${bossName} — Tier N`") — those aren't hand-tuned monsters, they're
 * generated from a `dungeon_bosses` row (see the separate dungeon-boss admin
 * usecases); showing them here would just be confusing, editable-looking
 * duplicates of that same underlying data.
 */
export class ListMonstersForAdminUseCase {
  constructor(private readonly monsterRepository: MonsterRepository) {}

  async execute(): Promise<Monster[]> {
    return this.monsterRepository.findAllExcludingMaterializedBosses();
  }
}
