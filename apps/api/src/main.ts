import { SupabaseAuthGateway } from "@/infrastructure/auth/SupabaseAuthGateway";
import { loadEnv } from "@/infrastructure/config/env";
import { PostgresAttackRepository } from "@/infrastructure/persistence/PostgresAttackRepository";
import { PostgresBattleRepository } from "@/infrastructure/persistence/PostgresBattleRepository";
import { PostgresItemRepository } from "@/infrastructure/persistence/PostgresItemRepository";
import { PostgresLevelRepository } from "@/infrastructure/persistence/PostgresLevelRepository";
import { PostgresMonsterAttackRepository } from "@/infrastructure/persistence/PostgresMonsterAttackRepository";
import { PostgresMonsterRepository } from "@/infrastructure/persistence/PostgresMonsterRepository";
import { PostgresPlayerItemRepository } from "@/infrastructure/persistence/PostgresPlayerItemRepository";
import { PostgresPlayerRepository } from "@/infrastructure/persistence/PostgresPlayerRepository";
import { PostgresUserRepository } from "@/infrastructure/persistence/PostgresUserRepository";
import { createPostgresClient } from "@/infrastructure/persistence/postgresClient";
import { RandomRng } from "@/infrastructure/random/RandomRng";
import { createSupabaseClient } from "@/infrastructure/supabase/supabaseClient";
import { createApp } from "@/interface/http/createApp";
import { AuthenticateUserUseCase } from "@/usecase/auth/AuthenticateUserUseCase";
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

const env = loadEnv();
const supabase = createSupabaseClient(env);
const sql = createPostgresClient(env.databaseUrl);
const authGateway = new SupabaseAuthGateway(supabase);
const rng = new RandomRng();

const userRepository = new PostgresUserRepository(sql);
const playerRepository = new PostgresPlayerRepository(sql);
const playerItemRepository = new PostgresPlayerItemRepository(sql);
const itemRepository = new PostgresItemRepository(sql);
const monsterRepository = new PostgresMonsterRepository(sql);
const monsterAttackRepository = new PostgresMonsterAttackRepository(sql);
const attackRepository = new PostgresAttackRepository(sql);
const levelRepository = new PostgresLevelRepository(sql);
const battleRepository = new PostgresBattleRepository(sql);

const authenticateUserUseCase = new AuthenticateUserUseCase(authGateway, userRepository);
const getOrCreatePlayerUseCase = new GetOrCreatePlayerUseCase(playerRepository);

const startBattleUseCase = new StartBattleUseCase(
  playerRepository,
  playerItemRepository,
  itemRepository,
  battleRepository,
  monsterRepository,
  monsterAttackRepository,
  attackRepository,
  levelRepository,
  rng,
);
const attackUseCase = new AttackUseCase(
  playerRepository,
  playerItemRepository,
  itemRepository,
  battleRepository,
  monsterRepository,
  monsterAttackRepository,
  attackRepository,
  levelRepository,
  rng,
  env.levelUpAttributePoints,
);
const runFromBattleUseCase = new RunFromBattleUseCase(
  playerRepository,
  playerItemRepository,
  itemRepository,
  battleRepository,
  monsterRepository,
  monsterAttackRepository,
  attackRepository,
  levelRepository,
);
const useBagItemUseCase = new UseBagItemUseCase(
  playerRepository,
  playerItemRepository,
  itemRepository,
  battleRepository,
  monsterRepository,
  monsterAttackRepository,
  attackRepository,
  levelRepository,
  rng,
  env.levelUpAttributePoints,
);
const restUseCase = new RestUseCase(
  playerRepository,
  playerItemRepository,
  itemRepository,
  battleRepository,
  monsterRepository,
  monsterAttackRepository,
  attackRepository,
  levelRepository,
  rng,
  env.levelUpAttributePoints,
);
const claimLootUseCase = new ClaimLootUseCase(
  playerRepository,
  playerItemRepository,
  itemRepository,
);
const equipItemUseCase = new EquipItemUseCase(playerItemRepository, itemRepository);
const unequipItemUseCase = new UnequipItemUseCase(playerItemRepository);
const allocateAttributePointsUseCase = new AllocateAttributePointsUseCase(playerRepository);
const updatePlayerNameUseCase = new UpdatePlayerNameUseCase(playerRepository);

const app = createApp({
  authenticateUserUseCase,
  authGateway,
  userRepository,
  getOrCreatePlayerUseCase,
  startBattleUseCase,
  attackUseCase,
  runFromBattleUseCase,
  useBagItemUseCase,
  restUseCase,
  claimLootUseCase,
  equipItemUseCase,
  unequipItemUseCase,
  allocateAttributePointsUseCase,
  updatePlayerNameUseCase,
  webOrigin: process.env.WEB_ORIGIN ?? "http://localhost:3000",
});

export default {
  port: env.port,
  fetch: app.fetch,
};
