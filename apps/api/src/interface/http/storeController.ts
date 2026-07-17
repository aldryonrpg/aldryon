import { PurchaseItemRequestSchema, SellItemRequestSchema } from "@aldryon/dtos";
import { Hono } from "hono";
import type { AuthedVariables } from "@/interface/http/authMiddleware";
import { PlayerItemNotFoundError } from "@/usecase/player/errors";
import {
  BagFullError,
  CannotSellEquippedItemError,
  InsufficientGoldError,
  ItemNotPurchasableError,
} from "@/usecase/store/errors";
import type { ListStoreItemsUseCase } from "@/usecase/store/ListStoreItemsUseCase";
import type { PurchaseItemUseCase } from "@/usecase/store/PurchaseItemUseCase";
import type { SellItemUseCase } from "@/usecase/store/SellItemUseCase";

export interface StoreControllerDeps {
  listStoreItemsUseCase: ListStoreItemsUseCase;
  purchaseItemUseCase: PurchaseItemUseCase;
  sellItemUseCase: SellItemUseCase;
}

export function createStoreController(
  deps: StoreControllerDeps,
): Hono<{ Variables: AuthedVariables }> {
  const app = new Hono<{ Variables: AuthedVariables }>();

  app.get("/store", async (c) => {
    const result = await deps.listStoreItemsUseCase.execute();
    return c.json(result, 200);
  });

  app.post("/store/purchase", async (c) => {
    const body = await c.req.json().catch(() => null);
    const parsed = PurchaseItemRequestSchema.safeParse(body);
    if (!parsed.success) {
      return c.json(
        { error: { code: "INVALID_REQUEST", message: "Malformed purchase request" } },
        400,
      );
    }

    try {
      const result = await deps.purchaseItemUseCase.execute({
        playerId: c.get("playerId"),
        isVip: c.get("isVip"),
        itemId: parsed.data.itemId,
      });
      return c.json(result, 200);
    } catch (err) {
      if (err instanceof ItemNotPurchasableError) {
        return c.json({ error: { code: "ITEM_NOT_PURCHASABLE", message: err.message } }, 400);
      }
      if (err instanceof InsufficientGoldError) {
        return c.json({ error: { code: "INSUFFICIENT_GOLD", message: err.message } }, 400);
      }
      if (err instanceof BagFullError) {
        return c.json({ error: { code: "BAG_FULL", message: err.message } }, 400);
      }
      throw err;
    }
  });

  app.post("/store/sell", async (c) => {
    const body = await c.req.json().catch(() => null);
    const parsed = SellItemRequestSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: { code: "INVALID_REQUEST", message: "Malformed sell request" } }, 400);
    }

    try {
      const result = await deps.sellItemUseCase.execute({
        playerId: c.get("playerId"),
        playerItemId: parsed.data.playerItemId,
      });
      return c.json(result, 200);
    } catch (err) {
      if (err instanceof PlayerItemNotFoundError) {
        return c.json({ error: { code: "PLAYER_ITEM_NOT_FOUND", message: err.message } }, 404);
      }
      if (err instanceof CannotSellEquippedItemError) {
        return c.json({ error: { code: "CANNOT_SELL_EQUIPPED_ITEM", message: err.message } }, 400);
      }
      throw err;
    }
  });

  return app;
}
