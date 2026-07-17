import type { SQL } from "bun";
import type { Rng } from "@/domain/shared/Rng";
import { PostgresAttackRepository } from "@/infrastructure/persistence/PostgresAttackRepository";
import { PostgresBattleRepository } from "@/infrastructure/persistence/PostgresBattleRepository";
import { PostgresDungeonBossRepository } from "@/infrastructure/persistence/PostgresDungeonBossRepository";
import { PostgresDungeonEncounterRepository } from "@/infrastructure/persistence/PostgresDungeonEncounterRepository";
import { PostgresDungeonSlayerRankingRepository } from "@/infrastructure/persistence/PostgresDungeonSlayerRankingRepository";
import { PostgresEffectCounterRepository } from "@/infrastructure/persistence/PostgresEffectCounterRepository";
import { PostgresItemRepository } from "@/infrastructure/persistence/PostgresItemRepository";
import { PostgresLevelRepository } from "@/infrastructure/persistence/PostgresLevelRepository";
import { PostgresMonsterAttackRepository } from "@/infrastructure/persistence/PostgresMonsterAttackRepository";
import { PostgresMonsterRepository } from "@/infrastructure/persistence/PostgresMonsterRepository";
import { PostgresPlayerItemRepository } from "@/infrastructure/persistence/PostgresPlayerItemRepository";
import { PostgresPlayerRepository } from "@/infrastructure/persistence/PostgresPlayerRepository";
import { PostgresUniqueItemOwnershipRepository } from "@/infrastructure/persistence/PostgresUniqueItemOwnershipRepository";
import { AttackUseCase } from "@/usecase/battle/AttackUseCase";
import { ClaimLootUseCase } from "@/usecase/battle/ClaimLootUseCase";
import { GetActiveBattleUseCase } from "@/usecase/battle/GetActiveBattleUseCase";
import { RestUseCase } from "@/usecase/battle/RestUseCase";
import { RunFromBattleUseCase } from "@/usecase/battle/RunFromBattleUseCase";
import { StartBattleUseCase } from "@/usecase/battle/StartBattleUseCase";
import { UseBagItemUseCase } from "@/usecase/battle/UseBagItemUseCase";
import { ContinueDungeonUseCase } from "@/usecase/dungeon/ContinueDungeonUseCase";
import { ExitDungeonRunUseCase } from "@/usecase/dungeon/ExitDungeonRunUseCase";
import { GetDungeonSlayerLeaderboardUseCase } from "@/usecase/dungeon/GetDungeonSlayerLeaderboardUseCase";
import { StartDungeonUseCase } from "@/usecase/dungeon/StartDungeonUseCase";
import { GetItemRarityColorsUseCase } from "@/usecase/item/GetItemRarityColorsUseCase";
import { ListItemsUseCase } from "@/usecase/item/ListItemsUseCase";
import { AllocateAttributePointsUseCase } from "@/usecase/player/AllocateAttributePointsUseCase";
import { DestroyBagItemUseCase } from "@/usecase/player/DestroyBagItemUseCase";
import { EquipItemUseCase } from "@/usecase/player/EquipItemUseCase";
import { GetOrCreatePlayerUseCase } from "@/usecase/player/GetOrCreatePlayerUseCase";
import { GetPlayerProfileUseCase } from "@/usecase/player/GetPlayerProfileUseCase";
import { UnequipItemUseCase } from "@/usecase/player/UnequipItemUseCase";
import { UpdatePlayerNameUseCase } from "@/usecase/player/UpdatePlayerNameUseCase";
import { ListStoreItemsUseCase } from "@/usecase/store/ListStoreItemsUseCase";
import { PurchaseItemUseCase } from "@/usecase/store/PurchaseItemUseCase";
import { SellItemUseCase } from "@/usecase/store/SellItemUseCase";

const LEVEL_UP_ATTRIBUTE_POINTS = 4;
const STATUS_COOLDOWN_ROUNDS = 5;
const SET_ATTRIBUTE_BONUS = 2;

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
  const dungeonEncounterRepository = new PostgresDungeonEncounterRepository(sql);
  const dungeonBossRepository = new PostgresDungeonBossRepository(sql);
  const dungeonSlayerRankingRepository = new PostgresDungeonSlayerRankingRepository(sql);
  const effectCounterRepository = new PostgresEffectCounterRepository(sql);
  const uniqueItemOwnershipRepository = new PostgresUniqueItemOwnershipRepository(sql);

  return {
    playerRepository,
    playerItemRepository,
    itemRepository,
    battleRepository,
    monsterRepository,
    monsterAttackRepository,
    attackRepository,
    levelRepository,
    dungeonEncounterRepository,
    dungeonBossRepository,
    dungeonSlayerRankingRepository,
    effectCounterRepository,
    uniqueItemOwnershipRepository,
    setAttributeBonus: SET_ATTRIBUTE_BONUS,
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
      effectCounterRepository,
      SET_ATTRIBUTE_BONUS,
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
      STATUS_COOLDOWN_ROUNDS,
      dungeonSlayerRankingRepository,
      effectCounterRepository,
      uniqueItemOwnershipRepository,
      SET_ATTRIBUTE_BONUS,
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
      rng,
      LEVEL_UP_ATTRIBUTE_POINTS,
      STATUS_COOLDOWN_ROUNDS,
      dungeonSlayerRankingRepository,
      effectCounterRepository,
      uniqueItemOwnershipRepository,
      SET_ATTRIBUTE_BONUS,
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
      STATUS_COOLDOWN_ROUNDS,
      dungeonSlayerRankingRepository,
      effectCounterRepository,
      uniqueItemOwnershipRepository,
      SET_ATTRIBUTE_BONUS,
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
      STATUS_COOLDOWN_ROUNDS,
      dungeonSlayerRankingRepository,
      effectCounterRepository,
      uniqueItemOwnershipRepository,
      SET_ATTRIBUTE_BONUS,
    ),
    claimLootUseCase: new ClaimLootUseCase(playerRepository, playerItemRepository, itemRepository),
    equipItemUseCase: new EquipItemUseCase(playerItemRepository, itemRepository),
    unequipItemUseCase: new UnequipItemUseCase(playerItemRepository),
    destroyBagItemUseCase: new DestroyBagItemUseCase(
      playerItemRepository,
      itemRepository,
      uniqueItemOwnershipRepository,
    ),
    allocateAttributePointsUseCase: new AllocateAttributePointsUseCase(playerRepository),
    updatePlayerNameUseCase: new UpdatePlayerNameUseCase(playerRepository),
    getActiveBattleUseCase: new GetActiveBattleUseCase(
      battleRepository,
      monsterRepository,
      playerRepository,
      playerItemRepository,
      itemRepository,
      attackRepository,
      SET_ATTRIBUTE_BONUS,
    ),
    getPlayerProfileUseCase: new GetPlayerProfileUseCase(
      playerRepository,
      playerItemRepository,
      itemRepository,
      dungeonSlayerRankingRepository,
      SET_ATTRIBUTE_BONUS,
    ),
    listItemsUseCase: new ListItemsUseCase(itemRepository),
    getItemRarityColorsUseCase: new GetItemRarityColorsUseCase(),
    startDungeonUseCase: new StartDungeonUseCase(
      playerRepository,
      playerItemRepository,
      itemRepository,
      battleRepository,
      monsterRepository,
      monsterAttackRepository,
      attackRepository,
      levelRepository,
      rng,
      effectCounterRepository,
      SET_ATTRIBUTE_BONUS,
    ),
    continueDungeonUseCase: new ContinueDungeonUseCase(
      playerRepository,
      playerItemRepository,
      itemRepository,
      battleRepository,
      monsterRepository,
      monsterAttackRepository,
      attackRepository,
      levelRepository,
      dungeonEncounterRepository,
      dungeonBossRepository,
      rng,
      effectCounterRepository,
      SET_ATTRIBUTE_BONUS,
    ),
    exitDungeonRunUseCase: new ExitDungeonRunUseCase(playerRepository),
    getDungeonSlayerLeaderboardUseCase: new GetDungeonSlayerLeaderboardUseCase(
      dungeonSlayerRankingRepository,
      playerRepository,
    ),
    listStoreItemsUseCase: new ListStoreItemsUseCase(itemRepository),
    purchaseItemUseCase: new PurchaseItemUseCase(
      playerRepository,
      playerItemRepository,
      itemRepository,
    ),
    sellItemUseCase: new SellItemUseCase(
      playerRepository,
      playerItemRepository,
      itemRepository,
      uniqueItemOwnershipRepository,
    ),
  };
}
