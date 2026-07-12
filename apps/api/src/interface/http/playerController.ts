import {
  AllocateAttributePointsRequestSchema,
  EquipItemRequestSchema,
  PatchPlayerRequestSchema,
  UnequipItemRequestSchema,
} from "@aldryon/dtos";
import { Hono } from "hono";
import type { AuthedVariables } from "@/interface/http/authMiddleware";
import type { AllocateAttributePointsUseCase } from "@/usecase/player/AllocateAttributePointsUseCase";
import type { EquipItemUseCase } from "@/usecase/player/EquipItemUseCase";
import {
  InsufficientAttributePointsError,
  ItemNotEquippableError,
  PlayerItemNotFoundError,
} from "@/usecase/player/errors";
import type { UnequipItemUseCase } from "@/usecase/player/UnequipItemUseCase";
import type { UpdatePlayerNameUseCase } from "@/usecase/player/UpdatePlayerNameUseCase";

export interface PlayerControllerDeps {
  equipItemUseCase: EquipItemUseCase;
  unequipItemUseCase: UnequipItemUseCase;
  allocateAttributePointsUseCase: AllocateAttributePointsUseCase;
  updatePlayerNameUseCase: UpdatePlayerNameUseCase;
}

function toPlayerItemSummary(playerItem: {
  id: string;
  itemId: string;
  equippedSlot: unknown;
  quantity: number;
}) {
  return {
    id: playerItem.id,
    itemId: playerItem.itemId,
    equippedSlot: playerItem.equippedSlot,
    quantity: playerItem.quantity,
  };
}

export function createPlayerController(
  deps: PlayerControllerDeps,
): Hono<{ Variables: AuthedVariables }> {
  const app = new Hono<{ Variables: AuthedVariables }>();

  app.patch("/player", async (c) => {
    const body = await c.req.json().catch(() => null);
    const parsed = PatchPlayerRequestSchema.safeParse(body);
    if (!parsed.success) {
      return c.json(
        { error: { code: "INVALID_REQUEST", message: "Malformed player patch request" } },
        400,
      );
    }

    const result = await deps.updatePlayerNameUseCase.execute({
      playerId: c.get("playerId"),
      playerName: parsed.data.playerName,
    });
    return c.json(result, 200);
  });

  app.post("/player/equip", async (c) => {
    const body = await c.req.json().catch(() => null);
    const parsed = EquipItemRequestSchema.safeParse(body);
    if (!parsed.success) {
      return c.json(
        { error: { code: "INVALID_REQUEST", message: "Malformed equip request" } },
        400,
      );
    }

    try {
      const { playerItem } = await deps.equipItemUseCase.execute({
        playerId: c.get("playerId"),
        playerItemId: parsed.data.playerItemId,
        preferredWeaponPosition: parsed.data.preferredWeaponPosition,
      });
      return c.json({ playerItem: toPlayerItemSummary(playerItem) }, 200);
    } catch (err) {
      if (err instanceof PlayerItemNotFoundError) {
        return c.json({ error: { code: "PLAYER_ITEM_NOT_FOUND", message: err.message } }, 404);
      }
      if (err instanceof ItemNotEquippableError) {
        return c.json({ error: { code: "ITEM_NOT_EQUIPPABLE", message: err.message } }, 400);
      }
      throw err;
    }
  });

  app.post("/player/unequip", async (c) => {
    const body = await c.req.json().catch(() => null);
    const parsed = UnequipItemRequestSchema.safeParse(body);
    if (!parsed.success) {
      return c.json(
        { error: { code: "INVALID_REQUEST", message: "Malformed unequip request" } },
        400,
      );
    }

    try {
      const { playerItem } = await deps.unequipItemUseCase.execute({
        playerId: c.get("playerId"),
        playerItemId: parsed.data.playerItemId,
      });
      return c.json({ playerItem: toPlayerItemSummary(playerItem) }, 200);
    } catch (err) {
      if (err instanceof PlayerItemNotFoundError) {
        return c.json({ error: { code: "PLAYER_ITEM_NOT_FOUND", message: err.message } }, 404);
      }
      if (err instanceof ItemNotEquippableError) {
        return c.json({ error: { code: "ITEM_NOT_EQUIPPABLE", message: err.message } }, 400);
      }
      throw err;
    }
  });

  app.post("/player/attributes", async (c) => {
    const body = await c.req.json().catch(() => null);
    const parsed = AllocateAttributePointsRequestSchema.safeParse(body);
    if (!parsed.success) {
      return c.json(
        { error: { code: "INVALID_REQUEST", message: "Malformed allocation request" } },
        400,
      );
    }

    try {
      const result = await deps.allocateAttributePointsUseCase.execute({
        playerId: c.get("playerId"),
        allocations: parsed.data.allocations,
      });
      return c.json(result, 200);
    } catch (err) {
      if (err instanceof InsufficientAttributePointsError) {
        return c.json(
          { error: { code: "INSUFFICIENT_ATTRIBUTE_POINTS", message: err.message } },
          400,
        );
      }
      throw err;
    }
  });

  return app;
}
