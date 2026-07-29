import type { SQL } from "bun";
import type { Rng } from "@/domain/shared/Rng";
import { PostgresAdminRepository } from "@/infrastructure/persistence/PostgresAdminRepository";
import { PostgresAttackRepository } from "@/infrastructure/persistence/PostgresAttackRepository";
import { PostgresBattleRepository } from "@/infrastructure/persistence/PostgresBattleRepository";
import { PostgresDungeonBossRepository } from "@/infrastructure/persistence/PostgresDungeonBossRepository";
import { PostgresDungeonSlayerRankingRepository } from "@/infrastructure/persistence/PostgresDungeonSlayerRankingRepository";
import { PostgresEffectCounterRepository } from "@/infrastructure/persistence/PostgresEffectCounterRepository";
import { PostgresItemRepository } from "@/infrastructure/persistence/PostgresItemRepository";
import { PostgresLevelRepository } from "@/infrastructure/persistence/PostgresLevelRepository";
import { PostgresMonsterAttackRepository } from "@/infrastructure/persistence/PostgresMonsterAttackRepository";
import { PostgresMonsterRepository } from "@/infrastructure/persistence/PostgresMonsterRepository";
import { PostgresPlayerItemRepository } from "@/infrastructure/persistence/PostgresPlayerItemRepository";
import { PostgresPlayerRepository } from "@/infrastructure/persistence/PostgresPlayerRepository";
import { PostgresUniqueItemOwnershipRepository } from "@/infrastructure/persistence/PostgresUniqueItemOwnershipRepository";
import { CreateAttackUseCase } from "@/usecase/attack/CreateAttackUseCase";
import { ListAttacksForAdminUseCase } from "@/usecase/attack/ListAttacksForAdminUseCase";
import { UpdateAttackUseCase } from "@/usecase/attack/UpdateAttackUseCase";
import { AttackUseCase } from "@/usecase/battle/AttackUseCase";
import { ClaimLootUseCase } from "@/usecase/battle/ClaimLootUseCase";
import { GetActiveBattleUseCase } from "@/usecase/battle/GetActiveBattleUseCase";
import { RestUseCase } from "@/usecase/battle/RestUseCase";
import { RunFromBattleUseCase } from "@/usecase/battle/RunFromBattleUseCase";
import { StartBattleUseCase } from "@/usecase/battle/StartBattleUseCase";
import { UseBagItemUseCase } from "@/usecase/battle/UseBagItemUseCase";
import { ContinueDungeonUseCase } from "@/usecase/dungeon/ContinueDungeonUseCase";
import { CreateDungeonBossUseCase } from "@/usecase/dungeon/CreateDungeonBossUseCase";
import { DungeonBossOfTheDayUseCase } from "@/usecase/dungeon/DungeonBossOfTheDayUseCase";
import { ExitDungeonRunUseCase } from "@/usecase/dungeon/ExitDungeonRunUseCase";
import { GetDungeonBossNormalAttacksUseCase } from "@/usecase/dungeon/GetDungeonBossNormalAttacksUseCase";
import { GetDungeonBossSpecialAttacksUseCase } from "@/usecase/dungeon/GetDungeonBossSpecialAttacksUseCase";
import { GetDungeonSlayerLeaderboardUseCase } from "@/usecase/dungeon/GetDungeonSlayerLeaderboardUseCase";
import { ListDungeonBossesForAdminUseCase } from "@/usecase/dungeon/ListDungeonBossesForAdminUseCase";
import { SetDungeonBossNormalAttacksUseCase } from "@/usecase/dungeon/SetDungeonBossNormalAttacksUseCase";
import { SetDungeonBossSpecialAttacksUseCase } from "@/usecase/dungeon/SetDungeonBossSpecialAttacksUseCase";
import { StartDungeonUseCase } from "@/usecase/dungeon/StartDungeonUseCase";
import { UpdateDungeonBossUseCase } from "@/usecase/dungeon/UpdateDungeonBossUseCase";
import { CreateItemUseCase } from "@/usecase/item/CreateItemUseCase";
import { GetItemRarityColorsUseCase } from "@/usecase/item/GetItemRarityColorsUseCase";
import { ListItemsForAdminUseCase } from "@/usecase/item/ListItemsForAdminUseCase";
import { ListItemsUseCase } from "@/usecase/item/ListItemsUseCase";
import { UpdateItemUseCase } from "@/usecase/item/UpdateItemUseCase";
import { CreateMonsterAttackUseCase } from "@/usecase/monster/CreateMonsterAttackUseCase";
import { CreateMonsterUseCase } from "@/usecase/monster/CreateMonsterUseCase";
import { GetMonsterNormalAttacksUseCase } from "@/usecase/monster/GetMonsterNormalAttacksUseCase";
import { ListMonsterAttacksForAdminUseCase } from "@/usecase/monster/ListMonsterAttacksForAdminUseCase";
import { ListMonstersForAdminUseCase } from "@/usecase/monster/ListMonstersForAdminUseCase";
import { MonsterCatalogCache } from "@/usecase/monster/MonsterCatalogCache";
import { SetMonsterNormalAttacksUseCase } from "@/usecase/monster/SetMonsterNormalAttacksUseCase";
import { UpdateMonsterAttackUseCase } from "@/usecase/monster/UpdateMonsterAttackUseCase";
import { UpdateMonsterUseCase } from "@/usecase/monster/UpdateMonsterUseCase";
import { AllocateAttributePointsUseCase } from "@/usecase/player/AllocateAttributePointsUseCase";
import { DestroyBagItemUseCase } from "@/usecase/player/DestroyBagItemUseCase";
import { EquipItemUseCase } from "@/usecase/player/EquipItemUseCase";
import { GetOrCreatePlayerUseCase } from "@/usecase/player/GetOrCreatePlayerUseCase";
import { GetPlayerProfileUseCase } from "@/usecase/player/GetPlayerProfileUseCase";
import { PlayerNameCache } from "@/usecase/player/PlayerNameCache";
import { UnequipItemUseCase } from "@/usecase/player/UnequipItemUseCase";
import { UpdatePlayerNameUseCase } from "@/usecase/player/UpdatePlayerNameUseCase";
import { ListStoreItemsUseCase } from "@/usecase/store/ListStoreItemsUseCase";
import { PurchaseItemUseCase } from "@/usecase/store/PurchaseItemUseCase";
import { SellItemUseCase } from "@/usecase/store/SellItemUseCase";

const LEVEL_UP_ATTRIBUTE_POINTS = 4;
const STATUS_COOLDOWN_ROUNDS = 5;
const SET_ATTRIBUTE_BONUS = 2;
const MOUNTAIN_LEVEL_REQUIREMENT = 4;
const RUINS_LEVEL_REQUIREMENT = 6;

/** Wires every repo + usecase against a live testcontainers Postgres, given
 * an (often fake) Rng. `now` defaults to the real clock — pass a fake one to
 * drive DungeonBossOfTheDayUseCase's day-boundary cache in tests. */
export function buildUseCases(sql: SQL, rng: Rng, now: () => number = Date.now) {
  const playerRepository = new PostgresPlayerRepository(sql);
  const playerItemRepository = new PostgresPlayerItemRepository(sql);
  const itemRepository = new PostgresItemRepository(sql);
  const battleRepository = new PostgresBattleRepository(sql);
  const monsterRepository = new PostgresMonsterRepository(sql);
  const monsterAttackRepository = new PostgresMonsterAttackRepository(sql);
  const attackRepository = new PostgresAttackRepository(sql);
  const levelRepository = new PostgresLevelRepository(sql);
  const dungeonBossRepository = new PostgresDungeonBossRepository(sql);
  const dungeonSlayerRankingRepository = new PostgresDungeonSlayerRankingRepository(sql);
  const effectCounterRepository = new PostgresEffectCounterRepository(sql);
  const uniqueItemOwnershipRepository = new PostgresUniqueItemOwnershipRepository(sql);
  const monsterCatalogCache = new MonsterCatalogCache(monsterRepository, monsterAttackRepository);
  const playerNameCache = new PlayerNameCache();
  const adminRepository = new PostgresAdminRepository(sql);
  const dungeonBossOfTheDayUseCase = new DungeonBossOfTheDayUseCase(
    dungeonBossRepository,
    monsterRepository,
    monsterAttackRepository,
    now,
  );

  return {
    playerRepository,
    playerItemRepository,
    itemRepository,
    battleRepository,
    monsterRepository,
    monsterAttackRepository,
    attackRepository,
    levelRepository,
    dungeonBossRepository,
    dungeonSlayerRankingRepository,
    effectCounterRepository,
    uniqueItemOwnershipRepository,
    dungeonBossOfTheDayUseCase,
    monsterCatalogCache,
    adminRepository,
    setAttributeBonus: SET_ATTRIBUTE_BONUS,
    mountainLevelRequirement: MOUNTAIN_LEVEL_REQUIREMENT,
    ruinsLevelRequirement: RUINS_LEVEL_REQUIREMENT,
    getOrCreatePlayerUseCase: new GetOrCreatePlayerUseCase(playerRepository),
    startBattleUseCase: new StartBattleUseCase(
      playerRepository,
      playerItemRepository,
      itemRepository,
      battleRepository,
      monsterCatalogCache,
      attackRepository,
      levelRepository,
      rng,
      effectCounterRepository,
      SET_ATTRIBUTE_BONUS,
      MOUNTAIN_LEVEL_REQUIREMENT,
      RUINS_LEVEL_REQUIREMENT,
    ),
    attackUseCase: new AttackUseCase(
      playerRepository,
      playerItemRepository,
      itemRepository,
      battleRepository,
      monsterCatalogCache,
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
      monsterCatalogCache,
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
      monsterCatalogCache,
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
      monsterCatalogCache,
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
    updatePlayerNameUseCase: new UpdatePlayerNameUseCase(playerRepository, playerNameCache),
    getActiveBattleUseCase: new GetActiveBattleUseCase(
      battleRepository,
      monsterCatalogCache,
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
      monsterCatalogCache,
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
      monsterCatalogCache,
      attackRepository,
      levelRepository,
      dungeonBossOfTheDayUseCase,
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
    listMonstersForAdminUseCase: new ListMonstersForAdminUseCase(monsterRepository),
    createMonsterUseCase: new CreateMonsterUseCase(monsterRepository),
    updateMonsterUseCase: new UpdateMonsterUseCase(
      monsterRepository,
      monsterCatalogCache,
      battleRepository,
    ),
    getMonsterNormalAttacksUseCase: new GetMonsterNormalAttacksUseCase(
      monsterRepository,
      monsterAttackRepository,
    ),
    setMonsterNormalAttacksUseCase: new SetMonsterNormalAttacksUseCase(
      monsterRepository,
      monsterAttackRepository,
    ),
    listDungeonBossesForAdminUseCase: new ListDungeonBossesForAdminUseCase(dungeonBossRepository),
    createDungeonBossUseCase: new CreateDungeonBossUseCase(dungeonBossRepository),
    updateDungeonBossUseCase: new UpdateDungeonBossUseCase(dungeonBossRepository),
    getDungeonBossSpecialAttacksUseCase: new GetDungeonBossSpecialAttacksUseCase(
      dungeonBossRepository,
      monsterAttackRepository,
    ),
    setDungeonBossSpecialAttacksUseCase: new SetDungeonBossSpecialAttacksUseCase(
      dungeonBossRepository,
      monsterAttackRepository,
    ),
    getDungeonBossNormalAttacksUseCase: new GetDungeonBossNormalAttacksUseCase(
      dungeonBossRepository,
      monsterAttackRepository,
    ),
    setDungeonBossNormalAttacksUseCase: new SetDungeonBossNormalAttacksUseCase(
      dungeonBossRepository,
      monsterAttackRepository,
    ),
    listItemsForAdminUseCase: new ListItemsForAdminUseCase(itemRepository),
    createItemUseCase: new CreateItemUseCase(itemRepository),
    updateItemUseCase: new UpdateItemUseCase(itemRepository),
    listAttacksForAdminUseCase: new ListAttacksForAdminUseCase(attackRepository),
    createAttackUseCase: new CreateAttackUseCase(attackRepository),
    updateAttackUseCase: new UpdateAttackUseCase(attackRepository),
    listMonsterAttacksForAdminUseCase: new ListMonsterAttacksForAdminUseCase(
      monsterAttackRepository,
    ),
    createMonsterAttackUseCase: new CreateMonsterAttackUseCase(monsterAttackRepository),
    updateMonsterAttackUseCase: new UpdateMonsterAttackUseCase(monsterAttackRepository),
  };
}
