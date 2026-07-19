import { describe, expect, it } from "bun:test";
import { Attack } from "@/domain/attack/Attack";

const BASE_REQUIREMENTS = {
  strength: 1,
  dexterity: 1,
  agility: 1,
  intelligence: 1,
  vitality: 1,
  luck: 1,
};

// FIREBALL SPELL's real seeded numbers (supabase/migrations/
// 20260719060000_seed_fireball_spell.sql) — a second Intelligence-scaled
// offensive spell alongside BURN SPELL, no DoT.
function fireballSpell(): Attack {
  return Attack.create({
    id: "fireball-spell",
    name: "FIREBALL SPELL",
    staminaCost: 20,
    multiplier: 2,
    scalingAttribute: "intelligence",
    appliesEffect: null,
    minLevel: 1,
    attributeRequirements: { ...BASE_REQUIREMENTS, intelligence: 30 },
    revealsRandomMonsterAttribute: false,
  });
}

describe("Attack.meetsRequirements", () => {
  it("rejects a caster just under the Intelligence requirement", () => {
    const attack = fireballSpell();
    const attributes = { ...BASE_REQUIREMENTS, intelligence: 29 };

    expect(attack.meetsRequirements(1, attributes)).toBe(false);
  });

  it("allows a caster exactly at the Intelligence requirement", () => {
    const attack = fireballSpell();
    const attributes = { ...BASE_REQUIREMENTS, intelligence: 30 };

    expect(attack.meetsRequirements(1, attributes)).toBe(true);
  });

  it("allows a caster above the Intelligence requirement", () => {
    const attack = fireballSpell();
    const attributes = { ...BASE_REQUIREMENTS, intelligence: 50 };

    expect(attack.meetsRequirements(1, attributes)).toBe(true);
  });

  it("is unaffected by minLevel here since FIREBALL SPELL's is 1 — a level-1 caster with enough Intelligence still qualifies", () => {
    const attack = fireballSpell();
    const attributes = { ...BASE_REQUIREMENTS, intelligence: 30 };

    expect(attack.meetsRequirements(1, attributes)).toBe(true);
  });

  it("carries the expected catalog values", () => {
    const attack = fireballSpell();

    expect(attack.staminaCost).toBe(20);
    expect(attack.multiplier).toBe(2);
    expect(attack.scalingAttribute).toBe("intelligence");
    expect(attack.appliesEffect).toBeNull();
  });
});
