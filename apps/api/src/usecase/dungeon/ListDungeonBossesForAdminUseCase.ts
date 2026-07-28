import type { DungeonBoss } from "@/domain/dungeon/DungeonBoss";
import type { DungeonBossRepository } from "@/usecase/dungeon/DungeonBossRepository";

/** GET /admin/dungeon-bosses (plan9 follow-up) — the full boss catalog,
 * separate from the wild-monster admin list. Unlike MonsterCatalogCache, a
 * raw DungeonBoss row is never cached anywhere, so there's no eviction
 * concern reading it back right after a write. */
export class ListDungeonBossesForAdminUseCase {
  constructor(private readonly dungeonBossRepository: DungeonBossRepository) {}

  async execute(): Promise<DungeonBoss[]> {
    return this.dungeonBossRepository.findAll();
  }
}
