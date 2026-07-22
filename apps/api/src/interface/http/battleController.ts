import {
  AttackRequestSchema,
  ClaimLootRequestSchema,
  StartBattleRequestSchema,
  UseBagItemRequestSchema,
} from "@aldryon/dtos";
import { Hono } from "hono";
import type { AuthedVariables } from "@/interface/http/authMiddleware";
import type { AttackUseCase } from "@/usecase/battle/AttackUseCase";
import type { ClaimLootUseCase } from "@/usecase/battle/ClaimLootUseCase";
import {
  AttackNotUsableError,
  BattleAlreadyInProgressError,
  BelowMinimumRegionLevelError,
  InvalidBagItemError,
  InvalidLootPickError,
  NoActiveBattleError,
  NoPendingLootError,
  RunCooldownError,
  UnknownAttackError,
} from "@/usecase/battle/errors";
import type { GetActiveBattleUseCase } from "@/usecase/battle/GetActiveBattleUseCase";
import type { RestUseCase } from "@/usecase/battle/RestUseCase";
import type { RunFromBattleUseCase } from "@/usecase/battle/RunFromBattleUseCase";
import type { StartBattleUseCase } from "@/usecase/battle/StartBattleUseCase";
import type { UseBagItemUseCase } from "@/usecase/battle/UseBagItemUseCase";

export interface BattleControllerDeps {
  startBattleUseCase: StartBattleUseCase;
  attackUseCase: AttackUseCase;
  runFromBattleUseCase: RunFromBattleUseCase;
  useBagItemUseCase: UseBagItemUseCase;
  restUseCase: RestUseCase;
  claimLootUseCase: ClaimLootUseCase;
  getActiveBattleUseCase: GetActiveBattleUseCase;
}

export function createBattleController(
  deps: BattleControllerDeps,
): Hono<{ Variables: AuthedVariables }> {
  const app = new Hono<{ Variables: AuthedVariables }>();

  app.get("/battle", async (c) => {
    const result = await deps.getActiveBattleUseCase.execute({ playerId: c.get("playerId") });
    return c.json(result, 200);
  });

  app.post("/battle/start", async (c) => {
    const body = await c.req.json().catch(() => null);
    const parsed = StartBattleRequestSchema.safeParse(body);
    if (!parsed.success) {
      return c.json(
        { error: { code: "INVALID_REQUEST", message: "Malformed start request" } },
        400,
      );
    }

    try {
      const result = await deps.startBattleUseCase.execute({
        playerId: c.get("playerId"),
        region: parsed.data.region,
      });
      return c.json(result, 200);
    } catch (err) {
      if (err instanceof BattleAlreadyInProgressError) {
        return c.json({ error: { code: "BATTLE_IN_PROGRESS", message: err.message } }, 409);
      }
      if (err instanceof RunCooldownError) {
        return c.json(
          {
            error: {
              code: "RUN_COOLDOWN",
              message: err.message,
              remainingSeconds: err.remainingSeconds,
            },
          },
          429,
        );
      }
      if (err instanceof BelowMinimumRegionLevelError) {
        return c.json({ error: { code: "BELOW_MINIMUM_REGION_LEVEL", message: err.message } }, 403);
      }
      throw err;
    }
  });

  app.post("/battle/attack", async (c) => {
    const body = await c.req.json().catch(() => null);
    const parsed = AttackRequestSchema.safeParse(body);
    if (!parsed.success) {
      return c.json(
        { error: { code: "INVALID_REQUEST", message: "Malformed attack request" } },
        400,
      );
    }

    try {
      const result = await deps.attackUseCase.execute({
        playerId: c.get("playerId"),
        attackName: parsed.data.attackName,
      });
      return c.json(result, 200);
    } catch (err) {
      if (err instanceof NoActiveBattleError) {
        return c.json({ error: { code: "NO_ACTIVE_BATTLE", message: err.message } }, 404);
      }
      if (err instanceof UnknownAttackError || err instanceof AttackNotUsableError) {
        return c.json({ error: { code: "ATTACK_NOT_USABLE", message: err.message } }, 400);
      }
      throw err;
    }
  });

  app.post("/battle/run", async (c) => {
    try {
      const result = await deps.runFromBattleUseCase.execute({ playerId: c.get("playerId") });
      return c.json(result, 200);
    } catch (err) {
      if (err instanceof NoActiveBattleError) {
        return c.json({ error: { code: "NO_ACTIVE_BATTLE", message: err.message } }, 404);
      }
      throw err;
    }
  });

  app.post("/battle/bag", async (c) => {
    const body = await c.req.json().catch(() => null);
    const parsed = UseBagItemRequestSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: { code: "INVALID_REQUEST", message: "Malformed bag request" } }, 400);
    }

    try {
      const result = await deps.useBagItemUseCase.execute({
        playerId: c.get("playerId"),
        playerItemId: parsed.data.playerItemId,
      });
      return c.json(result, 200);
    } catch (err) {
      if (err instanceof NoActiveBattleError) {
        return c.json({ error: { code: "NO_ACTIVE_BATTLE", message: err.message } }, 404);
      }
      if (err instanceof InvalidBagItemError) {
        return c.json({ error: { code: "INVALID_BAG_ITEM", message: err.message } }, 400);
      }
      throw err;
    }
  });

  app.post("/battle/rest", async (c) => {
    try {
      const result = await deps.restUseCase.execute({ playerId: c.get("playerId") });
      return c.json(result, 200);
    } catch (err) {
      if (err instanceof NoActiveBattleError) {
        return c.json({ error: { code: "NO_ACTIVE_BATTLE", message: err.message } }, 404);
      }
      throw err;
    }
  });

  app.post("/battle/loot", async (c) => {
    const body = await c.req.json().catch(() => null);
    const parsed = ClaimLootRequestSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: { code: "INVALID_REQUEST", message: "Malformed loot request" } }, 400);
    }

    try {
      const result = await deps.claimLootUseCase.execute({
        playerId: c.get("playerId"),
        picks: parsed.data.picks,
      });
      return c.json(result, 200);
    } catch (err) {
      if (err instanceof NoPendingLootError || err instanceof InvalidLootPickError) {
        return c.json({ error: { code: "INVALID_LOOT_PICK", message: err.message } }, 400);
      }
      throw err;
    }
  });

  return app;
}
