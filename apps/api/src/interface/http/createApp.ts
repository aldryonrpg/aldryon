import { Hono } from "hono";
import { cors } from "hono/cors";
import { createAdminController } from "@/interface/http/adminController";
import type { AdminVariables } from "@/interface/http/adminMiddleware";
import { createAdminMiddleware } from "@/interface/http/adminMiddleware";
import { createAuthController } from "@/interface/http/authController";
import type { AuthedVariables } from "@/interface/http/authMiddleware";
import { createAuthMiddleware } from "@/interface/http/authMiddleware";
import { createBattleController } from "@/interface/http/battleController";
import { createDungeonController } from "@/interface/http/dungeonController";
import { createItemController } from "@/interface/http/itemController";
import { createPlayerController } from "@/interface/http/playerController";
import { createStoreController } from "@/interface/http/storeController";
import type { AdminRepository } from "@/usecase/admin/AdminRepository";
import type { CreateAttackUseCase } from "@/usecase/attack/CreateAttackUseCase";
import type { ListAttacksForAdminUseCase } from "@/usecase/attack/ListAttacksForAdminUseCase";
import type { UpdateAttackUseCase } from "@/usecase/attack/UpdateAttackUseCase";
import type { AuthenticateUserUseCase } from "@/usecase/auth/AuthenticateUserUseCase";
import type { AuthGateway } from "@/usecase/auth/AuthGateway";
import type { AuthIdentityCache } from "@/usecase/auth/AuthIdentityCache";
import type { AttackUseCase } from "@/usecase/battle/AttackUseCase";
import type { ClaimLootUseCase } from "@/usecase/battle/ClaimLootUseCase";
import type { GetActiveBattleUseCase } from "@/usecase/battle/GetActiveBattleUseCase";
import type { RestUseCase } from "@/usecase/battle/RestUseCase";
import type { RunFromBattleUseCase } from "@/usecase/battle/RunFromBattleUseCase";
import type { StartBattleUseCase } from "@/usecase/battle/StartBattleUseCase";
import type { UseBagItemUseCase } from "@/usecase/battle/UseBagItemUseCase";
import type { ContinueDungeonUseCase } from "@/usecase/dungeon/ContinueDungeonUseCase";
import type { CreateDungeonBossUseCase } from "@/usecase/dungeon/CreateDungeonBossUseCase";
import type { ExitDungeonRunUseCase } from "@/usecase/dungeon/ExitDungeonRunUseCase";
import type { GetDungeonBossNormalAttacksUseCase } from "@/usecase/dungeon/GetDungeonBossNormalAttacksUseCase";
import type { GetDungeonBossSpecialAttacksUseCase } from "@/usecase/dungeon/GetDungeonBossSpecialAttacksUseCase";
import type { GetDungeonSlayerLeaderboardUseCase } from "@/usecase/dungeon/GetDungeonSlayerLeaderboardUseCase";
import type { ListDungeonBossesForAdminUseCase } from "@/usecase/dungeon/ListDungeonBossesForAdminUseCase";
import type { SetDungeonBossNormalAttacksUseCase } from "@/usecase/dungeon/SetDungeonBossNormalAttacksUseCase";
import type { SetDungeonBossSpecialAttacksUseCase } from "@/usecase/dungeon/SetDungeonBossSpecialAttacksUseCase";
import type { StartDungeonUseCase } from "@/usecase/dungeon/StartDungeonUseCase";
import type { UpdateDungeonBossUseCase } from "@/usecase/dungeon/UpdateDungeonBossUseCase";
import type { CreateItemUseCase } from "@/usecase/item/CreateItemUseCase";
import type { GetItemRarityColorsUseCase } from "@/usecase/item/GetItemRarityColorsUseCase";
import type { ListItemsForAdminUseCase } from "@/usecase/item/ListItemsForAdminUseCase";
import type { ListItemsUseCase } from "@/usecase/item/ListItemsUseCase";
import type { UpdateItemUseCase } from "@/usecase/item/UpdateItemUseCase";
import type { CreateMonsterAttackUseCase } from "@/usecase/monster/CreateMonsterAttackUseCase";
import type { CreateMonsterUseCase } from "@/usecase/monster/CreateMonsterUseCase";
import type { GetMonsterNormalAttacksUseCase } from "@/usecase/monster/GetMonsterNormalAttacksUseCase";
import type { ListMonsterAttacksForAdminUseCase } from "@/usecase/monster/ListMonsterAttacksForAdminUseCase";
import type { ListMonstersForAdminUseCase } from "@/usecase/monster/ListMonstersForAdminUseCase";
import type { SetMonsterNormalAttacksUseCase } from "@/usecase/monster/SetMonsterNormalAttacksUseCase";
import type { UpdateMonsterAttackUseCase } from "@/usecase/monster/UpdateMonsterAttackUseCase";
import type { UpdateMonsterUseCase } from "@/usecase/monster/UpdateMonsterUseCase";
import type { AllocateAttributePointsUseCase } from "@/usecase/player/AllocateAttributePointsUseCase";
import type { DestroyBagItemUseCase } from "@/usecase/player/DestroyBagItemUseCase";
import type { EquipItemUseCase } from "@/usecase/player/EquipItemUseCase";
import type { GetOrCreatePlayerUseCase } from "@/usecase/player/GetOrCreatePlayerUseCase";
import type { GetPlayerProfileUseCase } from "@/usecase/player/GetPlayerProfileUseCase";
import type { UnequipItemUseCase } from "@/usecase/player/UnequipItemUseCase";
import type { UpdatePlayerNameUseCase } from "@/usecase/player/UpdatePlayerNameUseCase";
import type { ListStoreItemsUseCase } from "@/usecase/store/ListStoreItemsUseCase";
import type { PurchaseItemUseCase } from "@/usecase/store/PurchaseItemUseCase";
import type { SellItemUseCase } from "@/usecase/store/SellItemUseCase";
import type { UserRepository } from "@/usecase/user/UserRepository";

export interface AppDependencies {
  authenticateUserUseCase: AuthenticateUserUseCase;
  authGateway: AuthGateway;
  userRepository: UserRepository;
  adminRepository: AdminRepository;
  getOrCreatePlayerUseCase: GetOrCreatePlayerUseCase;
  authIdentityCache: AuthIdentityCache;
  startBattleUseCase: StartBattleUseCase;
  attackUseCase: AttackUseCase;
  runFromBattleUseCase: RunFromBattleUseCase;
  useBagItemUseCase: UseBagItemUseCase;
  restUseCase: RestUseCase;
  claimLootUseCase: ClaimLootUseCase;
  getActiveBattleUseCase: GetActiveBattleUseCase;
  equipItemUseCase: EquipItemUseCase;
  unequipItemUseCase: UnequipItemUseCase;
  destroyBagItemUseCase: DestroyBagItemUseCase;
  allocateAttributePointsUseCase: AllocateAttributePointsUseCase;
  updatePlayerNameUseCase: UpdatePlayerNameUseCase;
  getPlayerProfileUseCase: GetPlayerProfileUseCase;
  listItemsUseCase: ListItemsUseCase;
  getItemRarityColorsUseCase: GetItemRarityColorsUseCase;
  startDungeonUseCase: StartDungeonUseCase;
  continueDungeonUseCase: ContinueDungeonUseCase;
  exitDungeonRunUseCase: ExitDungeonRunUseCase;
  getDungeonSlayerLeaderboardUseCase: GetDungeonSlayerLeaderboardUseCase;
  listStoreItemsUseCase: ListStoreItemsUseCase;
  purchaseItemUseCase: PurchaseItemUseCase;
  sellItemUseCase: SellItemUseCase;
  listMonstersForAdminUseCase: ListMonstersForAdminUseCase;
  createMonsterUseCase: CreateMonsterUseCase;
  updateMonsterUseCase: UpdateMonsterUseCase;
  getMonsterNormalAttacksUseCase: GetMonsterNormalAttacksUseCase;
  setMonsterNormalAttacksUseCase: SetMonsterNormalAttacksUseCase;
  listDungeonBossesForAdminUseCase: ListDungeonBossesForAdminUseCase;
  createDungeonBossUseCase: CreateDungeonBossUseCase;
  updateDungeonBossUseCase: UpdateDungeonBossUseCase;
  getDungeonBossSpecialAttacksUseCase: GetDungeonBossSpecialAttacksUseCase;
  setDungeonBossSpecialAttacksUseCase: SetDungeonBossSpecialAttacksUseCase;
  getDungeonBossNormalAttacksUseCase: GetDungeonBossNormalAttacksUseCase;
  setDungeonBossNormalAttacksUseCase: SetDungeonBossNormalAttacksUseCase;
  listItemsForAdminUseCase: ListItemsForAdminUseCase;
  createItemUseCase: CreateItemUseCase;
  updateItemUseCase: UpdateItemUseCase;
  listAttacksForAdminUseCase: ListAttacksForAdminUseCase;
  createAttackUseCase: CreateAttackUseCase;
  updateAttackUseCase: UpdateAttackUseCase;
  listMonsterAttacksForAdminUseCase: ListMonsterAttacksForAdminUseCase;
  createMonsterAttackUseCase: CreateMonsterAttackUseCase;
  updateMonsterAttackUseCase: UpdateMonsterAttackUseCase;
  webOrigin: string;
}

export function createApp(deps: AppDependencies): Hono {
  const app = new Hono();

  app.use("*", cors({ origin: deps.webOrigin, credentials: true }));

  app.get("/health", (c) => c.json({ status: "ok" }));
  app.route("/", createAuthController(deps.authenticateUserUseCase, deps.adminRepository));

  const authMiddleware = createAuthMiddleware(
    deps.authGateway,
    deps.userRepository,
    deps.getOrCreatePlayerUseCase,
    deps.authIdentityCache,
  );

  const gameplay = new Hono<{ Variables: AuthedVariables }>();
  gameplay.use("*", authMiddleware);
  gameplay.route(
    "/",
    createBattleController({
      startBattleUseCase: deps.startBattleUseCase,
      attackUseCase: deps.attackUseCase,
      runFromBattleUseCase: deps.runFromBattleUseCase,
      useBagItemUseCase: deps.useBagItemUseCase,
      restUseCase: deps.restUseCase,
      claimLootUseCase: deps.claimLootUseCase,
      getActiveBattleUseCase: deps.getActiveBattleUseCase,
    }),
  );
  gameplay.route(
    "/",
    createPlayerController({
      equipItemUseCase: deps.equipItemUseCase,
      unequipItemUseCase: deps.unequipItemUseCase,
      destroyBagItemUseCase: deps.destroyBagItemUseCase,
      allocateAttributePointsUseCase: deps.allocateAttributePointsUseCase,
      updatePlayerNameUseCase: deps.updatePlayerNameUseCase,
      getPlayerProfileUseCase: deps.getPlayerProfileUseCase,
    }),
  );
  gameplay.route(
    "/",
    createItemController({
      listItemsUseCase: deps.listItemsUseCase,
      getItemRarityColorsUseCase: deps.getItemRarityColorsUseCase,
    }),
  );
  gameplay.route(
    "/",
    createDungeonController({
      startDungeonUseCase: deps.startDungeonUseCase,
      continueDungeonUseCase: deps.continueDungeonUseCase,
      exitDungeonRunUseCase: deps.exitDungeonRunUseCase,
      getDungeonSlayerLeaderboardUseCase: deps.getDungeonSlayerLeaderboardUseCase,
    }),
  );
  gameplay.route(
    "/",
    createStoreController({
      listStoreItemsUseCase: deps.listStoreItemsUseCase,
      purchaseItemUseCase: deps.purchaseItemUseCase,
      sellItemUseCase: deps.sellItemUseCase,
    }),
  );
  app.route("/", gameplay);

  const adminMiddleware = createAdminMiddleware(
    deps.authGateway,
    deps.userRepository,
    deps.adminRepository,
  );

  const admin = new Hono<{ Variables: AdminVariables }>();
  admin.use("*", adminMiddleware);
  admin.route(
    "/",
    createAdminController({
      listMonstersForAdminUseCase: deps.listMonstersForAdminUseCase,
      createMonsterUseCase: deps.createMonsterUseCase,
      updateMonsterUseCase: deps.updateMonsterUseCase,
      getMonsterNormalAttacksUseCase: deps.getMonsterNormalAttacksUseCase,
      setMonsterNormalAttacksUseCase: deps.setMonsterNormalAttacksUseCase,
      listDungeonBossesForAdminUseCase: deps.listDungeonBossesForAdminUseCase,
      createDungeonBossUseCase: deps.createDungeonBossUseCase,
      updateDungeonBossUseCase: deps.updateDungeonBossUseCase,
      getDungeonBossSpecialAttacksUseCase: deps.getDungeonBossSpecialAttacksUseCase,
      setDungeonBossSpecialAttacksUseCase: deps.setDungeonBossSpecialAttacksUseCase,
      getDungeonBossNormalAttacksUseCase: deps.getDungeonBossNormalAttacksUseCase,
      setDungeonBossNormalAttacksUseCase: deps.setDungeonBossNormalAttacksUseCase,
      listItemsForAdminUseCase: deps.listItemsForAdminUseCase,
      createItemUseCase: deps.createItemUseCase,
      updateItemUseCase: deps.updateItemUseCase,
      listAttacksForAdminUseCase: deps.listAttacksForAdminUseCase,
      createAttackUseCase: deps.createAttackUseCase,
      updateAttackUseCase: deps.updateAttackUseCase,
      listMonsterAttacksForAdminUseCase: deps.listMonsterAttacksForAdminUseCase,
      createMonsterAttackUseCase: deps.createMonsterAttackUseCase,
      updateMonsterAttackUseCase: deps.updateMonsterAttackUseCase,
    }),
  );
  app.route("/", admin);

  return app;
}
