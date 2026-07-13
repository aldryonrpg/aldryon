import { Hono } from "hono";
import type { AuthedVariables } from "@/interface/http/authMiddleware";
import type { ListItemsUseCase } from "@/usecase/item/ListItemsUseCase";

export interface ItemControllerDeps {
  listItemsUseCase: ListItemsUseCase;
}

export function createItemController(
  deps: ItemControllerDeps,
): Hono<{ Variables: AuthedVariables }> {
  const app = new Hono<{ Variables: AuthedVariables }>();

  app.get("/items", async (c) => {
    const result = await deps.listItemsUseCase.execute();
    return c.json(result, 200);
  });

  return app;
}
