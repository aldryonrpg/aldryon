import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { SQL } from "bun";
import { buildUseCases } from "../support/buildUseCases";
import { expectRejection } from "../support/expectRejection";
import { FakeRng } from "../support/FakeRng";
import { getSharedPostgresEnvironment } from "../support/sharedPostgresEnvironment";
import {
  createTestDungeonBoss,
  createTestMonster,
  createTestMonsterAttack,
  linkDungeonBossMoveset,
  linkMonsterMoveset,
} from "../support/testFixtures";

describe("monster_attacks is_special flip guard (integration)", () => {
  let sql: SQL;

  beforeAll(async () => {
    const env = await getSharedPostgresEnvironment();
    sql = new SQL(env.connectionUri);
  }, 120_000);

  afterAll(async () => {
    await sql.close();
  });

  it("allows flipping an unlinked attack to special", async () => {
    const attackId = await createTestMonsterAttack(sql, { chargeTurns: 1 });

    await sql`update monster_attacks set is_special = true where id = ${attackId}`;

    const rows = await sql<{ is_special: boolean }[]>`
      select is_special from monster_attacks where id = ${attackId}
    `;
    expect(rows[0]?.is_special).toBe(true);
  });

  it("allows flipping to special when it would not push a monster over 2 (edge case)", async () => {
    const monsterId = await createTestMonster(sql);
    const special = await createTestMonsterAttack(sql, { isSpecial: true, chargeTurns: 1 });
    const toFlip = await createTestMonsterAttack(sql, { chargeTurns: 1 });
    await linkMonsterMoveset(sql, monsterId, special);
    await linkMonsterMoveset(sql, monsterId, toFlip);

    await sql`update monster_attacks set is_special = true where id = ${toFlip}`;

    const rows = await sql<{ is_special: boolean }[]>`
      select is_special from monster_attacks where id = ${toFlip}
    `;
    expect(rows[0]?.is_special).toBe(true);
  });

  it("rejects flipping to special when a monster would then have 3 special attacks", async () => {
    const monsterId = await createTestMonster(sql);
    const special1 = await createTestMonsterAttack(sql, { isSpecial: true, chargeTurns: 1 });
    const special2 = await createTestMonsterAttack(sql, { isSpecial: true, chargeTurns: 1 });
    const toFlip = await createTestMonsterAttack(sql, { chargeTurns: 1 });
    await linkMonsterMoveset(sql, monsterId, special1);
    await linkMonsterMoveset(sql, monsterId, special2);
    await linkMonsterMoveset(sql, monsterId, toFlip);

    let threw = false;
    try {
      await sql`update monster_attacks set is_special = true where id = ${toFlip}`;
    } catch (err) {
      threw = true;
      expect(String(err)).toContain("would then have more than 2 special attacks");
    }
    expect(threw).toBe(true);

    const rows = await sql<{ is_special: boolean }[]>`
      select is_special from monster_attacks where id = ${toFlip}
    `;
    expect(rows[0]?.is_special).toBe(false);
  });

  it("rejects flipping to special when a dungeon boss would then have 3 special attacks", async () => {
    const bossId = await createTestDungeonBoss(sql);
    const special1 = await createTestMonsterAttack(sql, { isSpecial: true, chargeTurns: 1 });
    const special2 = await createTestMonsterAttack(sql, { isSpecial: true, chargeTurns: 1 });
    const toFlip = await createTestMonsterAttack(sql, { chargeTurns: 1 });
    await linkDungeonBossMoveset(sql, bossId, special1);
    await linkDungeonBossMoveset(sql, bossId, special2);
    await linkDungeonBossMoveset(sql, bossId, toFlip);

    let threw = false;
    try {
      await sql`update monster_attacks set is_special = true where id = ${toFlip}`;
    } catch (err) {
      threw = true;
      expect(String(err)).toContain("would then have more than 2 special attacks");
    }
    expect(threw).toBe(true);

    const rows = await sql<{ is_special: boolean }[]>`
      select is_special from monster_attacks where id = ${toFlip}
    `;
    expect(rows[0]?.is_special).toBe(false);
  });

  it("allows flipping special back to normal regardless of moveset size", async () => {
    const monsterId = await createTestMonster(sql);
    const special1 = await createTestMonsterAttack(sql, { isSpecial: true, chargeTurns: 1 });
    const special2 = await createTestMonsterAttack(sql, { isSpecial: true, chargeTurns: 1 });
    await linkMonsterMoveset(sql, monsterId, special1);
    await linkMonsterMoveset(sql, monsterId, special2);

    await sql`update monster_attacks set is_special = false, charge_turns = 0 where id = ${special1}`;

    const rows = await sql<{ is_special: boolean }[]>`
      select is_special from monster_attacks where id = ${special1}
    `;
    expect(rows[0]?.is_special).toBe(false);
  });
});

describe("UpdateMonsterAttackUseCase respects the is_special flip guard (integration)", () => {
  let sql: SQL;

  beforeAll(async () => {
    const env = await getSharedPostgresEnvironment();
    sql = new SQL(env.connectionUri);
  }, 120_000);

  afterAll(async () => {
    await sql.close();
  });

  it("rejects a PATCH that would push a dungeon boss over its 2-special cap", async () => {
    const bossId = await createTestDungeonBoss(sql);
    const special1 = await createTestMonsterAttack(sql, { isSpecial: true, chargeTurns: 1 });
    const special2 = await createTestMonsterAttack(sql, { isSpecial: true, chargeTurns: 1 });
    const toFlip = await createTestMonsterAttack(sql, { chargeTurns: 1 });
    await linkDungeonBossMoveset(sql, bossId, special1);
    await linkDungeonBossMoveset(sql, bossId, special2);
    await linkDungeonBossMoveset(sql, bossId, toFlip);
    const uc = buildUseCases(sql, new FakeRng([1]));

    await expectRejection(
      uc.updateMonsterAttackUseCase.execute({ id: toFlip, isSpecial: true }),
      Error,
    );
  });
});
