import { describe, expect, it } from "bun:test";
import {
  buildRevealedAttributesView,
  pickUnrevealedAttribute,
} from "@/domain/monster/monsterAttributeReveal";
import { FakeRng } from "../support/FakeRng";

describe("pickUnrevealedAttribute", () => {
  it("picks one of the remaining unrevealed keys", () => {
    const result = pickUnrevealedAttribute(["strength", "dexterity"], new FakeRng([0]));
    expect(result).toBe("agility");
  });

  it("returns null once every attribute is already revealed", () => {
    const all: ("strength" | "dexterity" | "agility" | "intelligence" | "vitality" | "luck")[] = [
      "strength",
      "dexterity",
      "agility",
      "intelligence",
      "vitality",
      "luck",
    ];
    expect(pickUnrevealedAttribute(all, new FakeRng([0]))).toBeNull();
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
