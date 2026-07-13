import { Hono } from "hono";
import type { AuthedVariables } from "@/interface/http/authMiddleware";
import { BattleAlreadyInProgressError } from "@/usecase/battle/errors";
import {
  BelowMinimumDungeonLevelError,
  DailyDungeonLimitReachedError,
} from "@/usecase/dungeon/errors";
import type { GetDungeonSlayerLeaderboardUseCase } from "@/usecase/dungeon/GetDungeonSlayerLeaderboardUseCase";
import type { StartDungeonUseCase } from "@/usecase/dungeon/StartDungeonUseCase";

export interface DungeonControllerDeps {
  startDungeonUseCase: StartDungeonUseCase;
  getDungeonSlayerLeaderboardUseCase: GetDungeonSlayerLeaderboardUseCase;
}

export function createDungeonController(
  deps: DungeonControllerDeps,
): Hono<{ Variables: AuthedVariables }> {
  const app = new Hono<{ Variables: AuthedVariables }>();

  app.post("/dungeon/start", async (c) => {
    try {
      const result = await deps.startDungeonUseCase.execute({
        playerId: c.get("playerId"),
        isVip: c.get("isVip"),
      });
      return c.json(result, 200);
    } catch (err) {
      if (err instanceof BattleAlreadyInProgressError) {
        return c.json({ error: { code: "BATTLE_IN_PROGRESS", message: err.message } }, 409);
      }
      if (err instanceof BelowMinimumDungeonLevelError) {
        return c.json(
          { error: { code: "BELOW_MINIMUM_DUNGEON_LEVEL", message: err.message } },
          403,
        );
      }
      if (err instanceof DailyDungeonLimitReachedError) {
        return c.json(
          {
            error: {
              code: "DAILY_DUNGEON_LIMIT_REACHED",
              message: err.message,
              resetAt: err.resetAt.toISOString(),
            },
          },
          429,
        );
      }
      throw err;
    }
  });

  app.get("/dungeon/leaderboard", async (c) => {
    const result = await deps.getDungeonSlayerLeaderboardUseCase.execute();
    return c.json(result, 200);
  });

  return app;
}
