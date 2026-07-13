import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { SQL } from "bun";
import { getSharedPostgresEnvironment } from "../support/sharedPostgresEnvironment";
import {
  createTestMonster,
  createTestMonsterAttack,
  linkMonsterMoveset,
} from "../support/testFixtures";

describe("Monster moveset special-attack limit (integration)", () => {
  let sql: SQL;

  beforeAll(async () => {
    const env = await getSharedPostgresEnvironment();
    sql = new SQL(env.connectionUri);
  }, 120_000);

  afterAll(async () => {
    await sql.close();
  });

  it("allows a monster to carry exactly 2 special attacks", async () => {
    const monsterId = await createTestMonster(sql);
    const special1 = await createTestMonsterAttack(sql, { isSpecial: true, chargeTurns: 1 });
    const special2 = await createTestMonsterAttack(sql, { isSpecial: true, chargeTurns: 1 });

    await linkMonsterMoveset(sql, monsterId, special1);
    await linkMonsterMoveset(sql, monsterId, special2);

    const rows = await sql<
      { monster_attack_id: string }[]
    >`select monster_attack_id from monster_movesets where monster_id = ${monsterId}`;
    expect(rows).toHaveLength(2);
  });

  it("rejects linking a 3rd special attack to the same monster", async () => {
    const monsterId = await createTestMonster(sql);
    const special1 = await createTestMonsterAttack(sql, { isSpecial: true, chargeTurns: 1 });
    const special2 = await createTestMonsterAttack(sql, { isSpecial: true, chargeTurns: 1 });
    const special3 = await createTestMonsterAttack(sql, { isSpecial: true, chargeTurns: 1 });

    await linkMonsterMoveset(sql, monsterId, special1);
    await linkMonsterMoveset(sql, monsterId, special2);

    let threw = false;
    try {
      await linkMonsterMoveset(sql, monsterId, special3);
    } catch (err) {
      threw = true;
      expect(String(err)).toContain("already has 2 special attacks");
    }
    expect(threw).toBe(true);

    const rows = await sql<
      { monster_attack_id: string }[]
    >`select monster_attack_id from monster_movesets where monster_id = ${monsterId}`;
    expect(rows).toHaveLength(2);
  });

  it("does not limit normal (non-special) attacks", async () => {
    const monsterId = await createTestMonster(sql);
    // No explicit names — createTestMonsterAttack defaults to a unique
    // `Test Attack ${id}` name, avoiding collisions with fixed names other
    // integration test files seed onto the same shared Postgres container.
    const normal1 = await createTestMonsterAttack(sql);
    const normal2 = await createTestMonsterAttack(sql);
    const normal3 = await createTestMonsterAttack(sql);

    await linkMonsterMoveset(sql, monsterId, normal1);
    await linkMonsterMoveset(sql, monsterId, normal2);
    await linkMonsterMoveset(sql, monsterId, normal3);

    const rows = await sql<
      { monster_attack_id: string }[]
    >`select monster_attack_id from monster_movesets where monster_id = ${monsterId}`;
    expect(rows).toHaveLength(3);
  });
});
