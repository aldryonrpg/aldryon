import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { SQL } from "bun";
import { getSharedPostgresEnvironment } from "../support/sharedPostgresEnvironment";
import {
  createTestDungeonBoss,
  createTestMonsterAttack,
  linkDungeonBossMoveset,
} from "../support/testFixtures";

describe("Dungeon boss moveset special-attack limit (integration)", () => {
  let sql: SQL;

  beforeAll(async () => {
    const env = await getSharedPostgresEnvironment();
    sql = new SQL(env.connectionUri);
  }, 120_000);

  afterAll(async () => {
    await sql.close();
  });

  it("allows a dungeon boss to carry exactly 2 special attacks", async () => {
    const bossId = await createTestDungeonBoss(sql);
    const special1 = await createTestMonsterAttack(sql, { isSpecial: true, chargeTurns: 1 });
    const special2 = await createTestMonsterAttack(sql, { isSpecial: true, chargeTurns: 1 });

    await linkDungeonBossMoveset(sql, bossId, special1);
    await linkDungeonBossMoveset(sql, bossId, special2);

    const rows = await sql<
      { monster_attack_id: string }[]
    >`select monster_attack_id from dungeon_boss_movesets where dungeon_boss_id = ${bossId}`;
    expect(rows).toHaveLength(2);
  });

  it("rejects linking a 3rd special attack to the same dungeon boss", async () => {
    const bossId = await createTestDungeonBoss(sql);
    const special1 = await createTestMonsterAttack(sql, { isSpecial: true, chargeTurns: 1 });
    const special2 = await createTestMonsterAttack(sql, { isSpecial: true, chargeTurns: 1 });
    const special3 = await createTestMonsterAttack(sql, { isSpecial: true, chargeTurns: 1 });

    await linkDungeonBossMoveset(sql, bossId, special1);
    await linkDungeonBossMoveset(sql, bossId, special2);

    let threw = false;
    try {
      await linkDungeonBossMoveset(sql, bossId, special3);
    } catch (err) {
      threw = true;
      expect(String(err)).toContain("already has 2 special attacks");
    }
    expect(threw).toBe(true);

    const rows = await sql<
      { monster_attack_id: string }[]
    >`select monster_attack_id from dungeon_boss_movesets where dungeon_boss_id = ${bossId}`;
    expect(rows).toHaveLength(2);
  });

  it("does not limit normal (non-special) attacks", async () => {
    const bossId = await createTestDungeonBoss(sql);
    const normal1 = await createTestMonsterAttack(sql);
    const normal2 = await createTestMonsterAttack(sql);
    const normal3 = await createTestMonsterAttack(sql);

    await linkDungeonBossMoveset(sql, bossId, normal1);
    await linkDungeonBossMoveset(sql, bossId, normal2);
    await linkDungeonBossMoveset(sql, bossId, normal3);

    const rows = await sql<
      { monster_attack_id: string }[]
    >`select monster_attack_id from dungeon_boss_movesets where dungeon_boss_id = ${bossId}`;
    expect(rows).toHaveLength(3);
  });
});
