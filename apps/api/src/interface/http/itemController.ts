import { Hono } from "hono";
import type { AuthedVariables } from "@/interface/http/authMiddleware";
import type { GetItemRarityColorsUseCase } from "@/usecase/item/GetItemRarityColorsUseCase";
import type { ListItemsUseCase } from "@/usecase/item/ListItemsUseCase";

export interface ItemControllerDeps {
  listItemsUseCase: ListItemsUseCase;
  getItemRarityColorsUseCase: GetItemRarityColorsUseCase;
}

export function createItemController(
  deps: ItemControllerDeps,
): Hono<{ Variables: AuthedVariables }> {
  const app = new Hono<{ Variables: AuthedVariables }>();

  app.get("/items", async (c) => {
    const result = await deps.listItemsUseCase.execute();
    return c.json(result, 200);
  });

  app.get("/items/rarity-colors", (c) => {
    const result = deps.getItemRarityColorsUseCase.execute();
    return c.json(result, 200);
  });

  return app;
}
