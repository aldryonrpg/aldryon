import { Hono } from "hono";
import { cors } from "hono/cors";
import { createAuthController } from "@/interface/http/authController";
import type { AuthedVariables } from "@/interface/http/authMiddleware";
import { createAuthMiddleware } from "@/interface/http/authMiddleware";
import { createBattleController } from "@/interface/http/battleController";
import { createDungeonController } from "@/interface/http/dungeonController";
import { createItemController } from "@/interface/http/itemController";
import { createPlayerController } from "@/interface/http/playerController";
import type { AuthenticateUserUseCase } from "@/usecase/auth/AuthenticateUserUseCase";
import type { AuthGateway } from "@/usecase/auth/AuthGateway";
import type { AttackUseCase } from "@/usecase/battle/AttackUseCase";
import type { ClaimLootUseCase } from "@/usecase/battle/ClaimLootUseCase";
import type { GetActiveBattleUseCase } from "@/usecase/battle/GetActiveBattleUseCase";
import type { RestUseCase } from "@/usecase/battle/RestUseCase";
import type { RunFromBattleUseCase } from "@/usecase/battle/RunFromBattleUseCase";
import type { StartBattleUseCase } from "@/usecase/battle/StartBattleUseCase";
import type { UseBagItemUseCase } from "@/usecase/battle/UseBagItemUseCase";
import type { GetDungeonSlayerLeaderboardUseCase } from "@/usecase/dungeon/GetDungeonSlayerLeaderboardUseCase";
import type { StartDungeonUseCase } from "@/usecase/dungeon/StartDungeonUseCase";
import type { ListItemsUseCase } from "@/usecase/item/ListItemsUseCase";
import type { AllocateAttributePointsUseCase } from "@/usecase/player/AllocateAttributePointsUseCase";
import type { EquipItemUseCase } from "@/usecase/player/EquipItemUseCase";
import type { GetOrCreatePlayerUseCase } from "@/usecase/player/GetOrCreatePlayerUseCase";
import type { GetPlayerProfileUseCase } from "@/usecase/player/GetPlayerProfileUseCase";
import type { UnequipItemUseCase } from "@/usecase/player/UnequipItemUseCase";
import type { UpdatePlayerNameUseCase } from "@/usecase/player/UpdatePlayerNameUseCase";
import type { UserRepository } from "@/usecase/user/UserRepository";

export interface AppDependencies {
  authenticateUserUseCase: AuthenticateUserUseCase;
  authGateway: AuthGateway;
  userRepository: UserRepository;
  getOrCreatePlayerUseCase: GetOrCreatePlayerUseCase;
  startBattleUseCase: StartBattleUseCase;
  attackUseCase: AttackUseCase;
  runFromBattleUseCase: RunFromBattleUseCase;
  useBagItemUseCase: UseBagItemUseCase;
  restUseCase: RestUseCase;
  claimLootUseCase: ClaimLootUseCase;
  getActiveBattleUseCase: GetActiveBattleUseCase;
  equipItemUseCase: EquipItemUseCase;
  unequipItemUseCase: UnequipItemUseCase;
  allocateAttributePointsUseCase: AllocateAttributePointsUseCase;
  updatePlayerNameUseCase: UpdatePlayerNameUseCase;
  getPlayerProfileUseCase: GetPlayerProfileUseCase;
  listItemsUseCase: ListItemsUseCase;
  startDungeonUseCase: StartDungeonUseCase;
  getDungeonSlayerLeaderboardUseCase: GetDungeonSlayerLeaderboardUseCase;
  webOrigin: string;
}

export function createApp(deps: AppDependencies): Hono {
  const app = new Hono();

  app.use("*", cors({ origin: deps.webOrigin, credentials: true }));

  app.get("/health", (c) => c.json({ status: "ok" }));
  app.route("/", createAuthController(deps.authenticateUserUseCase));

  const authMiddleware = createAuthMiddleware(
    deps.authGateway,
    deps.userRepository,
    deps.getOrCreatePlayerUseCase,
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
      allocateAttributePointsUseCase: deps.allocateAttributePointsUseCase,
      updatePlayerNameUseCase: deps.updatePlayerNameUseCase,
      getPlayerProfileUseCase: deps.getPlayerProfileUseCase,
    }),
  );
  gameplay.route("/", createItemController({ listItemsUseCase: deps.listItemsUseCase }));
  gameplay.route(
    "/",
    createDungeonController({
      startDungeonUseCase: deps.startDungeonUseCase,
      getDungeonSlayerLeaderboardUseCase: deps.getDungeonSlayerLeaderboardUseCase,
    }),
  );
  app.route("/", gameplay);

  return app;
}
