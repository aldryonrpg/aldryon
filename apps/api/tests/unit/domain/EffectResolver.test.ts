import { describe, expect, it } from "bun:test";
import { rollEffectProc } from "@/domain/battle/services/EffectResolver";
import { FakeRng } from "../support/FakeRng";

describe("EffectResolver (unified Luck-difference proc)", () => {
  it("procs when the roll is <= the Luck difference", () => {
    // attackerLuck - defenderLuck = 30
    const proced = rollEffectProc({ attackerLuck: 40, defenderLuck: 10 }, new FakeRng([25]));
    expect(proced).toBe(true);
  });

  it("does not proc when the roll exceeds the Luck difference", () => {
    const proced = rollEffectProc({ attackerLuck: 40, defenderLuck: 10 }, new FakeRng([31]));
    expect(proced).toBe(false);
  });

  it("never procs below a 20-point Luck lead, since the roll floor is 20", () => {
    // attackerLuck - defenderLuck = 19: even the lowest possible roll (20) exceeds it.
    const proced = rollEffectProc({ attackerLuck: 29, defenderLuck: 10 }, new FakeRng([20]));
    expect(proced).toBe(false);
  });

  it("can proc at exactly a 20-point lead with the lowest roll", () => {
    const proced = rollEffectProc({ attackerLuck: 30, defenderLuck: 10 }, new FakeRng([20]));
    expect(proced).toBe(true);
  });

  it("a negative Luck difference (defender out-Lucks attacker) never procs", () => {
    const proced = rollEffectProc({ attackerLuck: 5, defenderLuck: 20 }, new FakeRng([20]));
    expect(proced).toBe(false);
  });
});
