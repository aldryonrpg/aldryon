import type { SQL } from "bun";
import type { Rng } from "@/domain/shared/Rng";
import { PostgresAttackRepository } from "@/infrastructure/persistence/PostgresAttackRepository";
import { PostgresBattleRepository } from "@/infrastructure/persistence/PostgresBattleRepository";
import { PostgresItemRepository } from "@/infrastructure/persistence/PostgresItemRepository";
import { PostgresLevelRepository } from "@/infrastructure/persistence/PostgresLevelRepository";
import { PostgresMonsterAttackRepository } from "@/infrastructure/persistence/PostgresMonsterAttackRepository";
import { PostgresMonsterRepository } from "@/infrastructure/persistence/PostgresMonsterRepository";
import { PostgresPlayerItemRepository } from "@/infrastructure/persistence/PostgresPlayerItemRepository";
import { PostgresPlayerRepository } from "@/infrastructure/persistence/PostgresPlayerRepository";
import { AttackUseCase } from "@/usecase/battle/AttackUseCase";
import { ClaimLootUseCase } from "@/usecase/battle/ClaimLootUseCase";
import { RestUseCase } from "@/usecase/battle/RestUseCase";
import { RunFromBattleUseCase } from "@/usecase/battle/RunFromBattleUseCase";
import { StartBattleUseCase } from "@/usecase/battle/StartBattleUseCase";
import { UseBagItemUseCase } from "@/usecase/battle/UseBagItemUseCase";
import { AllocateAttributePointsUseCase } from "@/usecase/player/AllocateAttributePointsUseCase";
import { EquipItemUseCase } from "@/usecase/player/EquipItemUseCase";
import { GetOrCreatePlayerUseCase } from "@/usecase/player/GetOrCreatePlayerUseCase";
import { UnequipItemUseCase } from "@/usecase/player/UnequipItemUseCase";
import { UpdatePlayerNameUseCase } from "@/usecase/player/UpdatePlayerNameUseCase";

const LEVEL_UP_ATTRIBUTE_POINTS = 4;

/** Wires every repo + usecase against a live testcontainers Postgres, given an (often fake) Rng. */
export function buildUseCases(sql: SQL, rng: Rng) {
  const playerRepository = new PostgresPlayerRepository(sql);
  const playerItemRepository = new PostgresPlayerItemRepository(sql);
  const itemRepository = new PostgresItemRepository(sql);
  const battleRepository = new PostgresBattleRepository(sql);
  const monsterRepository = new PostgresMonsterRepository(sql);
  const monsterAttackRepository = new PostgresMonsterAttackRepository(sql);
  const attackRepository = new PostgresAttackRepository(sql);
  const levelRepository = new PostgresLevelRepository(sql);

  return {
    playerRepository,
    playerItemRepository,
    itemRepository,
    battleRepository,
    monsterRepository,
    monsterAttackRepository,
    attackRepository,
    levelRepository,
    getOrCreatePlayerUseCase: new GetOrCreatePlayerUseCase(playerRepository),
    startBattleUseCase: new StartBattleUseCase(
      playerRepository,
      playerItemRepository,
      itemRepository,
      battleRepository,
      monsterRepository,
      monsterAttackRepository,
      attackRepository,
      levelRepository,
      rng,
    ),
    attackUseCase: new AttackUseCase(
      playerRepository,
      playerItemRepository,
      itemRepository,
      battleRepository,
      monsterRepository,
      monsterAttackRepository,
      attackRepository,
      levelRepository,
      rng,
      LEVEL_UP_ATTRIBUTE_POINTS,
    ),
    runFromBattleUseCase: new RunFromBattleUseCase(
      playerRepository,
      playerItemRepository,
      itemRepository,
      battleRepository,
      monsterRepository,
      monsterAttackRepository,
      attackRepository,
      levelRepository,
    ),
    useBagItemUseCase: new UseBagItemUseCase(
      playerRepository,
      playerItemRepository,
      itemRepository,
      battleRepository,
      monsterRepository,
      monsterAttackRepository,
      attackRepository,
      levelRepository,
      rng,
      LEVEL_UP_ATTRIBUTE_POINTS,
    ),
    restUseCase: new RestUseCase(
      playerRepository,
      playerItemRepository,
      itemRepository,
      battleRepository,
      monsterRepository,
      monsterAttackRepository,
      attackRepository,
      levelRepository,
      rng,
      LEVEL_UP_ATTRIBUTE_POINTS,
    ),
    claimLootUseCase: new ClaimLootUseCase(playerRepository, playerItemRepository, itemRepository),
    equipItemUseCase: new EquipItemUseCase(playerItemRepository, itemRepository),
    unequipItemUseCase: new UnequipItemUseCase(playerItemRepository),
    allocateAttributePointsUseCase: new AllocateAttributePointsUseCase(playerRepository),
    updatePlayerNameUseCase: new UpdatePlayerNameUseCase(playerRepository),
  };
}
