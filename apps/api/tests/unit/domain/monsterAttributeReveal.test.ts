import { describe, expect, it } from "bun:test";
import {
  buildRevealedAttributesView,
  pickUnrevealedAttributes,
  rollRevealCount,
} from "@/domain/monster/monsterAttributeReveal";
import { FakeRng } from "../support/FakeRng";

describe("pickUnrevealedAttributes", () => {
  it("picks up to count distinct remaining unrevealed keys", () => {
    const result = pickUnrevealedAttributes(["strength", "dexterity"], new FakeRng([0, 0]), 2);
    expect(result).toEqual(["agility", "intelligence"]);
  });

  it("returns fewer than count once fewer than that remain", () => {
    const revealed: ("strength" | "dexterity" | "agility" | "intelligence" | "vitality")[] = [
      "strength",
      "dexterity",
      "agility",
      "intelligence",
      "vitality",
    ];
    const result = pickUnrevealedAttributes(revealed, new FakeRng([0]), 3);
    expect(result).toEqual(["luck"]);
  });

  it("returns an empty array once every attribute is already revealed", () => {
    const all: ("strength" | "dexterity" | "agility" | "intelligence" | "vitality" | "luck")[] = [
      "strength",
      "dexterity",
      "agility",
      "intelligence",
      "vitality",
      "luck",
    ];
    expect(pickUnrevealedAttributes(all, new FakeRng([0]), 1)).toEqual([]);
  });
});

describe("rollRevealCount", () => {
  it("reveals 3 at 100+ Intelligence with a 90+ roll", () => {
    expect(rollRevealCount(100, new FakeRng([90]))).toBe(3);
  });

  it("falls back to 2 at 100+ Intelligence with a roll below 90 but at least 60", () => {
    expect(rollRevealCount(100, new FakeRng([89]))).toBe(2);
  });

  it("falls back to 1 at 100+ Intelligence with a roll below 60", () => {
    expect(rollRevealCount(100, new FakeRng([59]))).toBe(1);
  });

  it("reveals 2 at 50+ Intelligence with a 60+ roll", () => {
    expect(rollRevealCount(50, new FakeRng([60]))).toBe(2);
  });

  it("caps at 1 below 50 Intelligence regardless of roll", () => {
    expect(rollRevealCount(49, new FakeRng([100]))).toBe(1);
  });

  it("caps at 1 for a player who just meets REVEAL SPELL's own requirement", () => {
    expect(rollRevealCount(30, new FakeRng([100]))).toBe(1);
  });
});

describe("buildRevealedAttributesView", () => {
  const attributes = {
    strength: 10,
    dexterity: 20,
    agility: 30,
    intelligence: 40,
    vitality: 50,
    luck: 60,
  };

  it("includes only revealed keys", () => {
    const view = buildRevealedAttributesView(attributes, ["dexterity", "luck"]);
    expect(view).toEqual({ dexterity: 20, luck: 60 });
  });

  it("returns an empty object when nothing is revealed", () => {
    expect(buildRevealedAttributesView(attributes, [])).toEqual({});
  });
});
