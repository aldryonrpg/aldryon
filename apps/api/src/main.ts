import { SupabaseAuthGateway } from "@/infrastructure/auth/SupabaseAuthGateway";
import { loadEnv } from "@/infrastructure/config/env";
import { PostgresAdminRepository } from "@/infrastructure/persistence/PostgresAdminRepository";
import { PostgresAttackRepository } from "@/infrastructure/persistence/PostgresAttackRepository";
import { PostgresAuthIdentityResolver } from "@/infrastructure/persistence/PostgresAuthIdentityResolver";
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
import { PostgresUserRepository } from "@/infrastructure/persistence/PostgresUserRepository";
import { createPostgresClient } from "@/infrastructure/persistence/postgresClient";
import { RandomRng } from "@/infrastructure/random/RandomRng";
import { createApp } from "@/interface/http/createApp";
import { CreateAttackUseCase } from "@/usecase/attack/CreateAttackUseCase";
import { ListAttacksForAdminUseCase } from "@/usecase/attack/ListAttacksForAdminUseCase";
import { UpdateAttackUseCase } from "@/usecase/attack/UpdateAttackUseCase";
import { AuthenticateUserUseCase } from "@/usecase/auth/AuthenticateUserUseCase";
import { AuthIdentityCache } from "@/usecase/auth/AuthIdentityCache";
import { CachedAuthGateway } from "@/usecase/auth/CachedAuthGateway";
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
import { GetDungeonSlayerLeaderboardUseCase } from "@/usecase/dungeon/GetDungeonSlayerLeaderboardUseCase";
import { ListDungeonBossesForAdminUseCase } from "@/usecase/dungeon/ListDungeonBossesForAdminUseCase";
import { StartDungeonUseCase } from "@/usecase/dungeon/StartDungeonUseCase";
import { UpdateDungeonBossUseCase } from "@/usecase/dungeon/UpdateDungeonBossUseCase";
import { CreateItemUseCase } from "@/usecase/item/CreateItemUseCase";
import { GetItemRarityColorsUseCase } from "@/usecase/item/GetItemRarityColorsUseCase";
import { ListItemsForAdminUseCase } from "@/usecase/item/ListItemsForAdminUseCase";
import { ListItemsUseCase } from "@/usecase/item/ListItemsUseCase";
import { UpdateItemUseCase } from "@/usecase/item/UpdateItemUseCase";
import { CreateMonsterAttackUseCase } from "@/usecase/monster/CreateMonsterAttackUseCase";
import { CreateMonsterUseCase } from "@/usecase/monster/CreateMonsterUseCase";
import { ListMonsterAttacksForAdminUseCase } from "@/usecase/monster/ListMonsterAttacksForAdminUseCase";
import { ListMonstersForAdminUseCase } from "@/usecase/monster/ListMonstersForAdminUseCase";
import { MonsterCatalogCache } from "@/usecase/monster/MonsterCatalogCache";
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

const env = loadEnv();
const sql = createPostgresClient(env.databaseUrl, {
  max: env.databasePoolMax,
  idleTimeoutSeconds: env.databasePoolIdleTimeoutSeconds,
  maxLifetimeSeconds: env.databasePoolMaxLifetimeSeconds,
  prepare: env.databasePoolPrepareStatements,
});
const authGateway = new CachedAuthGateway(SupabaseAuthGateway.forProject(env.supabaseUrl));
const authIdentityResolver = new PostgresAuthIdentityResolver(sql);
const authIdentityCache = new AuthIdentityCache(authIdentityResolver);
const rng = new RandomRng();

const userRepository = new PostgresUserRepository(sql);
const adminRepository = new PostgresAdminRepository(sql);
const playerRepository = new PostgresPlayerRepository(sql);
const playerItemRepository = new PostgresPlayerItemRepository(sql);
const itemRepository = new PostgresItemRepository(sql);
const monsterRepository = new PostgresMonsterRepository(sql);
const monsterAttackRepository = new PostgresMonsterAttackRepository(sql);
const attackRepository = new PostgresAttackRepository(sql);
const levelRepository = new PostgresLevelRepository(sql);
const battleRepository = new PostgresBattleRepository(sql);
const dungeonSlayerRankingRepository = new PostgresDungeonSlayerRankingRepository(sql);
const dungeonBossRepository = new PostgresDungeonBossRepository(sql);
const effectCounterRepository = new PostgresEffectCounterRepository(sql);
const uniqueItemOwnershipRepository = new PostgresUniqueItemOwnershipRepository(sql);
const monsterCatalogCache = new MonsterCatalogCache(monsterRepository, monsterAttackRepository);
const playerNameCache = new PlayerNameCache();
playerNameCache.load(await playerRepository.listPlayerNames());

const authenticateUserUseCase = new AuthenticateUserUseCase(authGateway, userRepository);
const getOrCreatePlayerUseCase = new GetOrCreatePlayerUseCase(playerRepository);

const startBattleUseCase = new StartBattleUseCase(
  playerRepository,
  playerItemRepository,
  itemRepository,
  battleRepository,
  monsterCatalogCache,
  attackRepository,
  levelRepository,
  rng,
  effectCounterRepository,
  env.setAttributeBonus,
  env.mountainLevelRequirement,
  env.ruinsLevelRequirement,
);
const attackUseCase = new AttackUseCase(
  playerRepository,
  playerItemRepository,
  itemRepository,
  battleRepository,
  monsterCatalogCache,
  attackRepository,
  levelRepository,
  rng,
  env.levelUpAttributePoints,
  env.statusCooldownRounds,
  dungeonSlayerRankingRepository,
  effectCounterRepository,
  uniqueItemOwnershipRepository,
  env.setAttributeBonus,
);
const runFromBattleUseCase = new RunFromBattleUseCase(
  playerRepository,
  playerItemRepository,
  itemRepository,
  battleRepository,
  monsterCatalogCache,
  levelRepository,
  rng,
  env.levelUpAttributePoints,
  env.statusCooldownRounds,
  dungeonSlayerRankingRepository,
  effectCounterRepository,
  uniqueItemOwnershipRepository,
  env.setAttributeBonus,
);
const useBagItemUseCase = new UseBagItemUseCase(
  playerRepository,
  playerItemRepository,
  itemRepository,
  battleRepository,
  monsterCatalogCache,
  levelRepository,
  rng,
  env.levelUpAttributePoints,
  env.statusCooldownRounds,
  dungeonSlayerRankingRepository,
  effectCounterRepository,
  uniqueItemOwnershipRepository,
  env.setAttributeBonus,
);
const restUseCase = new RestUseCase(
  playerRepository,
  playerItemRepository,
  itemRepository,
  battleRepository,
  monsterCatalogCache,
  levelRepository,
  rng,
  env.levelUpAttributePoints,
  env.statusCooldownRounds,
  dungeonSlayerRankingRepository,
  effectCounterRepository,
  uniqueItemOwnershipRepository,
  env.setAttributeBonus,
);
const claimLootUseCase = new ClaimLootUseCase(
  playerRepository,
  playerItemRepository,
  itemRepository,
);
const equipItemUseCase = new EquipItemUseCase(playerItemRepository, itemRepository);
const unequipItemUseCase = new UnequipItemUseCase(playerItemRepository);
const destroyBagItemUseCase = new DestroyBagItemUseCase(
  playerItemRepository,
  itemRepository,
  uniqueItemOwnershipRepository,
);
const allocateAttributePointsUseCase = new AllocateAttributePointsUseCase(playerRepository);
const updatePlayerNameUseCase = new UpdatePlayerNameUseCase(playerRepository, playerNameCache);
const getActiveBattleUseCase = new GetActiveBattleUseCase(
  battleRepository,
  monsterCatalogCache,
  playerRepository,
  playerItemRepository,
  itemRepository,
  attackRepository,
  env.setAttributeBonus,
);
const getPlayerProfileUseCase = new GetPlayerProfileUseCase(
  playerRepository,
  playerItemRepository,
  itemRepository,
  dungeonSlayerRankingRepository,
  env.setAttributeBonus,
);
const listItemsUseCase = new ListItemsUseCase(itemRepository);
const getItemRarityColorsUseCase = new GetItemRarityColorsUseCase();
const startDungeonUseCase = new StartDungeonUseCase(
  playerRepository,
  playerItemRepository,
  itemRepository,
  battleRepository,
  monsterCatalogCache,
  attackRepository,
  levelRepository,
  rng,
  effectCounterRepository,
  env.setAttributeBonus,
);
const dungeonBossOfTheDayUseCase = new DungeonBossOfTheDayUseCase(
  dungeonBossRepository,
  monsterRepository,
  monsterAttackRepository,
);
const continueDungeonUseCase = new ContinueDungeonUseCase(
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
  env.setAttributeBonus,
);
const exitDungeonRunUseCase = new ExitDungeonRunUseCase(playerRepository);
const getDungeonSlayerLeaderboardUseCase = new GetDungeonSlayerLeaderboardUseCase(
  dungeonSlayerRankingRepository,
  playerRepository,
);
const listStoreItemsUseCase = new ListStoreItemsUseCase(itemRepository);
const purchaseItemUseCase = new PurchaseItemUseCase(
  playerRepository,
  playerItemRepository,
  itemRepository,
);
const sellItemUseCase = new SellItemUseCase(
  playerRepository,
  playerItemRepository,
  itemRepository,
  uniqueItemOwnershipRepository,
);
const listMonstersForAdminUseCase = new ListMonstersForAdminUseCase(monsterRepository);
const createMonsterUseCase = new CreateMonsterUseCase(monsterRepository);
const updateMonsterUseCase = new UpdateMonsterUseCase(
  monsterRepository,
  monsterCatalogCache,
  battleRepository,
);
const listDungeonBossesForAdminUseCase = new ListDungeonBossesForAdminUseCase(
  dungeonBossRepository,
);
const createDungeonBossUseCase = new CreateDungeonBossUseCase(dungeonBossRepository);
const updateDungeonBossUseCase = new UpdateDungeonBossUseCase(dungeonBossRepository);
const listItemsForAdminUseCase = new ListItemsForAdminUseCase(itemRepository);
const createItemUseCase = new CreateItemUseCase(itemRepository);
const updateItemUseCase = new UpdateItemUseCase(itemRepository);
const listAttacksForAdminUseCase = new ListAttacksForAdminUseCase(attackRepository);
const createAttackUseCase = new CreateAttackUseCase(attackRepository);
const updateAttackUseCase = new UpdateAttackUseCase(attackRepository);
const listMonsterAttacksForAdminUseCase = new ListMonsterAttacksForAdminUseCase(
  monsterAttackRepository,
);
const createMonsterAttackUseCase = new CreateMonsterAttackUseCase(monsterAttackRepository);
const updateMonsterAttackUseCase = new UpdateMonsterAttackUseCase(monsterAttackRepository);

const app = createApp({
  authenticateUserUseCase,
  authGateway,
  userRepository,
  adminRepository,
  getOrCreatePlayerUseCase,
  authIdentityCache,
  startBattleUseCase,
  attackUseCase,
  runFromBattleUseCase,
  useBagItemUseCase,
  restUseCase,
  claimLootUseCase,
  getActiveBattleUseCase,
  equipItemUseCase,
  unequipItemUseCase,
  destroyBagItemUseCase,
  allocateAttributePointsUseCase,
  updatePlayerNameUseCase,
  getPlayerProfileUseCase,
  listItemsUseCase,
  getItemRarityColorsUseCase,
  startDungeonUseCase,
  continueDungeonUseCase,
  exitDungeonRunUseCase,
  getDungeonSlayerLeaderboardUseCase,
  listStoreItemsUseCase,
  purchaseItemUseCase,
  sellItemUseCase,
  listMonstersForAdminUseCase,
  createMonsterUseCase,
  updateMonsterUseCase,
  listDungeonBossesForAdminUseCase,
  createDungeonBossUseCase,
  updateDungeonBossUseCase,
  listItemsForAdminUseCase,
  createItemUseCase,
  updateItemUseCase,
  listAttacksForAdminUseCase,
  createAttackUseCase,
  updateAttackUseCase,
  listMonsterAttacksForAdminUseCase,
  createMonsterAttackUseCase,
  updateMonsterAttackUseCase,
  webOrigin: process.env.WEB_ORIGIN ?? "http://localhost:3000",
});

export default {
  port: env.port,
  fetch: app.fetch,
};
