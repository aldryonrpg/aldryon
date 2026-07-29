import {
  CreateAttackRequestSchema,
  CreateDungeonBossRequestSchema,
  CreateItemRequestSchema,
  CreateMonsterAttackRequestSchema,
  CreateMonsterRequestSchema,
  PatchAttackRequestSchema,
  PatchDungeonBossRequestSchema,
  PatchItemRequestSchema,
  PatchMonsterAttackRequestSchema,
  PatchMonsterRequestSchema,
} from "@aldryon/dtos";
import { Hono } from "hono";
import type { AdminVariables } from "@/interface/http/adminMiddleware";
import { mapAttackToAdminDto } from "@/interface/http/dto/mapAttackToAdminDto";
import { mapDungeonBossToAdminDto } from "@/interface/http/dto/mapDungeonBossToAdminDto";
import { mapItemToAdminDto } from "@/interface/http/dto/mapItemToAdminDto";
import { mapMonsterAttackToAdminDto } from "@/interface/http/dto/mapMonsterAttackToAdminDto";
import { mapMonsterToAdminDto } from "@/interface/http/dto/mapMonsterToAdminDto";
import type { CreateAttackUseCase } from "@/usecase/attack/CreateAttackUseCase";
import { AttackNotFoundError, DuplicateAttackNameError } from "@/usecase/attack/errors";
import type { ListAttacksForAdminUseCase } from "@/usecase/attack/ListAttacksForAdminUseCase";
import type { UpdateAttackUseCase } from "@/usecase/attack/UpdateAttackUseCase";
import type { CreateDungeonBossUseCase } from "@/usecase/dungeon/CreateDungeonBossUseCase";
import { DungeonBossNotFoundError, DuplicateDungeonBossNameError } from "@/usecase/dungeon/errors";
import type { ListDungeonBossesForAdminUseCase } from "@/usecase/dungeon/ListDungeonBossesForAdminUseCase";
import type { UpdateDungeonBossUseCase } from "@/usecase/dungeon/UpdateDungeonBossUseCase";
import type { CreateItemUseCase } from "@/usecase/item/CreateItemUseCase";
import { DuplicateItemNameError, ItemNotFoundError } from "@/usecase/item/errors";
import type { ListItemsForAdminUseCase } from "@/usecase/item/ListItemsForAdminUseCase";
import type { UpdateItemUseCase } from "@/usecase/item/UpdateItemUseCase";
import type { CreateMonsterAttackUseCase } from "@/usecase/monster/CreateMonsterAttackUseCase";
import type { CreateMonsterUseCase } from "@/usecase/monster/CreateMonsterUseCase";
import {
  DuplicateMonsterAttackNameError,
  DuplicateMonsterNameError,
  MonsterAttackNotFoundError,
  MonsterNotFoundError,
} from "@/usecase/monster/errors";
import type { ListMonsterAttacksForAdminUseCase } from "@/usecase/monster/ListMonsterAttacksForAdminUseCase";
import type { ListMonstersForAdminUseCase } from "@/usecase/monster/ListMonstersForAdminUseCase";
import type { UpdateMonsterAttackUseCase } from "@/usecase/monster/UpdateMonsterAttackUseCase";
import type { UpdateMonsterUseCase } from "@/usecase/monster/UpdateMonsterUseCase";

export interface AdminControllerDeps {
  listMonstersForAdminUseCase: ListMonstersForAdminUseCase;
  createMonsterUseCase: CreateMonsterUseCase;
  updateMonsterUseCase: UpdateMonsterUseCase;
  listDungeonBossesForAdminUseCase: ListDungeonBossesForAdminUseCase;
  createDungeonBossUseCase: CreateDungeonBossUseCase;
  updateDungeonBossUseCase: UpdateDungeonBossUseCase;
  listItemsForAdminUseCase: ListItemsForAdminUseCase;
  createItemUseCase: CreateItemUseCase;
  updateItemUseCase: UpdateItemUseCase;
  listAttacksForAdminUseCase: ListAttacksForAdminUseCase;
  createAttackUseCase: CreateAttackUseCase;
  updateAttackUseCase: UpdateAttackUseCase;
  listMonsterAttacksForAdminUseCase: ListMonsterAttacksForAdminUseCase;
  createMonsterAttackUseCase: CreateMonsterAttackUseCase;
  updateMonsterAttackUseCase: UpdateMonsterAttackUseCase;
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

  app.get("/admin/items", async (c) => {
    const items = await deps.listItemsForAdminUseCase.execute();
    return c.json({ items: items.map(mapItemToAdminDto) }, 200);
  });

  app.post("/admin/items", async (c) => {
    const body = await c.req.json().catch(() => null);
    const parsed = CreateItemRequestSchema.safeParse(body);
    if (!parsed.success) {
      return c.json(
        { error: { code: "INVALID_REQUEST", message: "Malformed create-item request" } },
        400,
      );
    }

    try {
      const item = await deps.createItemUseCase.execute(parsed.data);
      return c.json({ item: mapItemToAdminDto(item) }, 200);
    } catch (err) {
      if (err instanceof DuplicateItemNameError) {
        return c.json({ error: { code: "DUPLICATE_ITEM_NAME", message: err.message } }, 409);
      }
      throw err;
    }
  });

  app.patch("/admin/items/:id", async (c) => {
    const body = await c.req.json().catch(() => null);
    const parsed = PatchItemRequestSchema.safeParse(body);
    if (!parsed.success) {
      return c.json(
        { error: { code: "INVALID_REQUEST", message: "Malformed patch-item request" } },
        400,
      );
    }

    try {
      const item = await deps.updateItemUseCase.execute({
        id: c.req.param("id"),
        ...parsed.data,
      });
      return c.json({ item: mapItemToAdminDto(item) }, 200);
    } catch (err) {
      if (err instanceof ItemNotFoundError) {
        return c.json({ error: { code: "ITEM_NOT_FOUND", message: err.message } }, 404);
      }
      if (err instanceof DuplicateItemNameError) {
        return c.json({ error: { code: "DUPLICATE_ITEM_NAME", message: err.message } }, 409);
      }
      throw err;
    }
  });

  app.get("/admin/attacks", async (c) => {
    const attacks = await deps.listAttacksForAdminUseCase.execute();
    return c.json({ attacks: attacks.map(mapAttackToAdminDto) }, 200);
  });

  app.post("/admin/attacks", async (c) => {
    const body = await c.req.json().catch(() => null);
    const parsed = CreateAttackRequestSchema.safeParse(body);
    if (!parsed.success) {
      return c.json(
        { error: { code: "INVALID_REQUEST", message: "Malformed create-attack request" } },
        400,
      );
    }

    try {
      const attack = await deps.createAttackUseCase.execute(parsed.data);
      return c.json({ attack: mapAttackToAdminDto(attack) }, 200);
    } catch (err) {
      if (err instanceof DuplicateAttackNameError) {
        return c.json({ error: { code: "DUPLICATE_ATTACK_NAME", message: err.message } }, 409);
      }
      throw err;
    }
  });

  app.patch("/admin/attacks/:id", async (c) => {
    const body = await c.req.json().catch(() => null);
    const parsed = PatchAttackRequestSchema.safeParse(body);
    if (!parsed.success) {
      return c.json(
        { error: { code: "INVALID_REQUEST", message: "Malformed patch-attack request" } },
        400,
      );
    }

    try {
      const attack = await deps.updateAttackUseCase.execute({
        id: c.req.param("id"),
        ...parsed.data,
      });
      return c.json({ attack: mapAttackToAdminDto(attack) }, 200);
    } catch (err) {
      if (err instanceof AttackNotFoundError) {
        return c.json({ error: { code: "ATTACK_NOT_FOUND", message: err.message } }, 404);
      }
      if (err instanceof DuplicateAttackNameError) {
        return c.json({ error: { code: "DUPLICATE_ATTACK_NAME", message: err.message } }, 409);
      }
      throw err;
    }
  });

  app.get("/admin/monster-attacks", async (c) => {
    const monsterAttacks = await deps.listMonsterAttacksForAdminUseCase.execute();
    return c.json({ monsterAttacks: monsterAttacks.map(mapMonsterAttackToAdminDto) }, 200);
  });

  app.post("/admin/monster-attacks", async (c) => {
    const body = await c.req.json().catch(() => null);
    const parsed = CreateMonsterAttackRequestSchema.safeParse(body);
    if (!parsed.success) {
      return c.json(
        { error: { code: "INVALID_REQUEST", message: "Malformed create-monster-attack request" } },
        400,
      );
    }

    try {
      const monsterAttack = await deps.createMonsterAttackUseCase.execute(parsed.data);
      return c.json({ monsterAttack: mapMonsterAttackToAdminDto(monsterAttack) }, 200);
    } catch (err) {
      if (err instanceof DuplicateMonsterAttackNameError) {
        return c.json(
          { error: { code: "DUPLICATE_MONSTER_ATTACK_NAME", message: err.message } },
          409,
        );
      }
      throw err;
    }
  });

  app.patch("/admin/monster-attacks/:id", async (c) => {
    const body = await c.req.json().catch(() => null);
    const parsed = PatchMonsterAttackRequestSchema.safeParse(body);
    if (!parsed.success) {
      return c.json(
        { error: { code: "INVALID_REQUEST", message: "Malformed patch-monster-attack request" } },
        400,
      );
    }

    try {
      const monsterAttack = await deps.updateMonsterAttackUseCase.execute({
        id: c.req.param("id"),
        ...parsed.data,
      });
      return c.json({ monsterAttack: mapMonsterAttackToAdminDto(monsterAttack) }, 200);
    } catch (err) {
      if (err instanceof MonsterAttackNotFoundError) {
        return c.json({ error: { code: "MONSTER_ATTACK_NOT_FOUND", message: err.message } }, 404);
      }
      if (err instanceof DuplicateMonsterAttackNameError) {
        return c.json(
          { error: { code: "DUPLICATE_MONSTER_ATTACK_NAME", message: err.message } },
          409,
        );
      }
      throw err;
    }
  });

  return app;
}
