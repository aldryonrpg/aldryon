import {
  CreateDungeonBossRequestSchema,
  CreateMonsterRequestSchema,
  PatchDungeonBossRequestSchema,
  PatchMonsterRequestSchema,
} from "@aldryon/dtos";
import { Hono } from "hono";
import type { AdminVariables } from "@/interface/http/adminMiddleware";
import { mapDungeonBossToAdminDto } from "@/interface/http/dto/mapDungeonBossToAdminDto";
import { mapMonsterToAdminDto } from "@/interface/http/dto/mapMonsterToAdminDto";
import type { CreateDungeonBossUseCase } from "@/usecase/dungeon/CreateDungeonBossUseCase";
import { DungeonBossNotFoundError, DuplicateDungeonBossNameError } from "@/usecase/dungeon/errors";
import type { ListDungeonBossesForAdminUseCase } from "@/usecase/dungeon/ListDungeonBossesForAdminUseCase";
import type { UpdateDungeonBossUseCase } from "@/usecase/dungeon/UpdateDungeonBossUseCase";
import type { CreateMonsterUseCase } from "@/usecase/monster/CreateMonsterUseCase";
import { DuplicateMonsterNameError, MonsterNotFoundError } from "@/usecase/monster/errors";
import type { ListMonstersForAdminUseCase } from "@/usecase/monster/ListMonstersForAdminUseCase";
import type { UpdateMonsterUseCase } from "@/usecase/monster/UpdateMonsterUseCase";

export interface AdminControllerDeps {
  listMonstersForAdminUseCase: ListMonstersForAdminUseCase;
  createMonsterUseCase: CreateMonsterUseCase;
  updateMonsterUseCase: UpdateMonsterUseCase;
  listDungeonBossesForAdminUseCase: ListDungeonBossesForAdminUseCase;
  createDungeonBossUseCase: CreateDungeonBossUseCase;
  updateDungeonBossUseCase: UpdateDungeonBossUseCase;
}

export function createAdminController(
  deps: AdminControllerDeps,
): Hono<{ Variables: AdminVariables }> {
  const app = new Hono<{ Variables: AdminVariables }>();

  app.get("/admin/monsters", async (c) => {
    const monsters = await deps.listMonstersForAdminUseCase.execute();
    return c.json({ monsters: monsters.map(mapMonsterToAdminDto) }, 200);
  });

  app.post("/admin/monsters", async (c) => {
    const body = await c.req.json().catch(() => null);
    const parsed = CreateMonsterRequestSchema.safeParse(body);
    if (!parsed.success) {
      return c.json(
        { error: { code: "INVALID_REQUEST", message: "Malformed create-monster request" } },
        400,
      );
    }

    try {
      const monster = await deps.createMonsterUseCase.execute(parsed.data);
      return c.json({ monster: mapMonsterToAdminDto(monster) }, 200);
    } catch (err) {
      if (err instanceof DuplicateMonsterNameError) {
        return c.json({ error: { code: "DUPLICATE_MONSTER_NAME", message: err.message } }, 409);
      }
      throw err;
    }
  });

  app.patch("/admin/monsters/:id", async (c) => {
    const body = await c.req.json().catch(() => null);
    const parsed = PatchMonsterRequestSchema.safeParse(body);
    if (!parsed.success) {
      return c.json(
        { error: { code: "INVALID_REQUEST", message: "Malformed patch-monster request" } },
        400,
      );
    }

    try {
      const monster = await deps.updateMonsterUseCase.execute({
        id: c.req.param("id"),
        ...parsed.data,
      });
      return c.json({ monster: mapMonsterToAdminDto(monster) }, 200);
    } catch (err) {
      if (err instanceof MonsterNotFoundError) {
        return c.json({ error: { code: "MONSTER_NOT_FOUND", message: err.message } }, 404);
      }
      if (err instanceof DuplicateMonsterNameError) {
        return c.json({ error: { code: "DUPLICATE_MONSTER_NAME", message: err.message } }, 409);
      }
      throw err;
    }
  });

  app.get("/admin/dungeon-bosses", async (c) => {
    const dungeonBosses = await deps.listDungeonBossesForAdminUseCase.execute();
    return c.json({ dungeonBosses: dungeonBosses.map(mapDungeonBossToAdminDto) }, 200);
  });

  app.post("/admin/dungeon-bosses", async (c) => {
    const body = await c.req.json().catch(() => null);
    const parsed = CreateDungeonBossRequestSchema.safeParse(body);
    if (!parsed.success) {
      return c.json(
        { error: { code: "INVALID_REQUEST", message: "Malformed create-dungeon-boss request" } },
        400,
      );
    }

    try {
      const dungeonBoss = await deps.createDungeonBossUseCase.execute(parsed.data);
      return c.json({ dungeonBoss: mapDungeonBossToAdminDto(dungeonBoss) }, 200);
    } catch (err) {
      if (err instanceof DuplicateDungeonBossNameError) {
        return c.json(
          { error: { code: "DUPLICATE_DUNGEON_BOSS_NAME", message: err.message } },
          409,
        );
      }
      throw err;
    }
  });

  app.patch("/admin/dungeon-bosses/:id", async (c) => {
    const body = await c.req.json().catch(() => null);
    const parsed = PatchDungeonBossRequestSchema.safeParse(body);
    if (!parsed.success) {
      return c.json(
        { error: { code: "INVALID_REQUEST", message: "Malformed patch-dungeon-boss request" } },
        400,
      );
    }

    try {
      const dungeonBoss = await deps.updateDungeonBossUseCase.execute({
        id: c.req.param("id"),
        ...parsed.data,
      });
      return c.json({ dungeonBoss: mapDungeonBossToAdminDto(dungeonBoss) }, 200);
    } catch (err) {
      if (err instanceof DungeonBossNotFoundError) {
        return c.json({ error: { code: "DUNGEON_BOSS_NOT_FOUND", message: err.message } }, 404);
      }
      if (err instanceof DuplicateDungeonBossNameError) {
        return c.json(
          { error: { code: "DUPLICATE_DUNGEON_BOSS_NAME", message: err.message } },
          409,
        );
      }
      throw err;
    }
  });

  return app;
}
