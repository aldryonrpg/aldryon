import { describe, expect, it } from "bun:test";
import { decidePhaseTransition } from "@/domain/dungeon/phaseTransitionDecision";

describe("decidePhaseTransition", () => {
  it("a gatekeeper death with a boss pending is a partial settlement", () => {
    expect(decidePhaseTransition("boss-monster-id")).toEqual({ kind: "partialSettlement" });
  });

  it("a boss/ordinary-monster death with no boss pending is a full settlement", () => {
    expect(decidePhaseTransition(null)).toEqual({ kind: "fullSettlement" });
  });
});
