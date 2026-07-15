import { describe, expect, it } from "bun:test";
import { scaleMonsterForDungeonStep } from "@/domain/dungeon/scaleMonsterForDungeonStep";
import { Monster } from "@/domain/monster/Monster";

function makeMonster(overrides: Partial<Parameters<typeof Monster.create>[0]> = {}): Monster {
  return Monster.create({
    id: "monster-1",
    name: "WOLF",
    description: "A wolf.",
    region: "forest",
    monsterImage: "wolf.png",
    hp: 1500,
    xpGain: 750,
    level: 8,
    maxStamina: 100,
    attributes: { force: 15, dexterity: 15, agility: 15, intelligence: 15, vitality: 15, luck: 15 },
    monsterType: "normal",
    drops: [],
    exclusiveDrops: [],
    legendaryDrops: [],
    ambushChance: 10,
    ...overrides,
  });
}

describe("scaleMonsterForDungeonStep", () => {
  it("tier 1: scales by 100%, level set to 10, identity preserved", () => {
    const monster = makeMonster();
    const scaled = scaleMonsterForDungeonStep(monster, 1);

    expect(scaled.id).toBe(monster.id);
    expect(scaled.name).toBe(monster.name);
    expect(scaled.monsterImage).toBe(monster.monsterImage);
    expect(scaled.hp).toBe(1500);
    expect(scaled.level).toBe(10);
    expect(scaled.maxStamina).toBe(100);
    expect(scaled.getAttributes().force).toBe(15);
    // xpGain is deliberately NOT scaled — the monster keeps its own catalog value.
    expect(scaled.xpGain).toBe(750);
  });

  it("tier 2: scales hp/attributes/maxStamina by 150%, level set to 15", () => {
    const monster = makeMonster();
    const scaled = scaleMonsterForDungeonStep(monster, 2);

    expect(scaled.hp).toBe(2250);
    expect(scaled.level).toBe(15);
    expect(scaled.maxStamina).toBe(150);
    expect(scaled.getAttributes().force).toBe(23); // 15 * 1.5 = 22.5 -> ceil 23
    expect(scaled.xpGain).toBe(750);
  });

  it("tier 3: scales hp/attributes/maxStamina by 200%, level set to 20", () => {
    const monster = makeMonster();
    const scaled = scaleMonsterForDungeonStep(monster, 3);

    expect(scaled.hp).toBe(3000);
    expect(scaled.level).toBe(20);
    expect(scaled.maxStamina).toBe(200);
    expect(scaled.getAttributes().force).toBe(30);
    expect(scaled.xpGain).toBe(750);
  });
});
