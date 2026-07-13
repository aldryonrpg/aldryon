import { describe, expect, it } from "bun:test";
import {
  canAttemptDungeon,
  nextUtcMidnight,
  recordDungeonAttempt,
} from "@/domain/dungeon/dungeonAttempts";

const MONDAY = new Date("2026-07-13T10:00:00.000Z");
const MONDAY_LATER = new Date("2026-07-13T18:00:00.000Z");
const TUESDAY = new Date("2026-07-14T09:00:00.000Z");

describe("canAttemptDungeon", () => {
  it("a normal player with no attempts today is eligible", () => {
    expect(canAttemptDungeon(null, null, false, MONDAY)).toBe(true);
  });

  it("a normal player who already attempted today is not eligible", () => {
    expect(canAttemptDungeon(MONDAY, null, false, MONDAY_LATER)).toBe(false);
  });

  it("a VIP player is eligible for a 2nd attempt the same day", () => {
    expect(canAttemptDungeon(MONDAY, null, true, MONDAY_LATER)).toBe(true);
  });

  it("a VIP player who used both slots today is not eligible for a 3rd", () => {
    expect(canAttemptDungeon(MONDAY, MONDAY_LATER, true, MONDAY_LATER)).toBe(false);
  });

  it("a slot from a previous UTC day doesn't count today", () => {
    expect(canAttemptDungeon(MONDAY, MONDAY_LATER, true, TUESDAY)).toBe(true);
    expect(canAttemptDungeon(MONDAY, null, false, TUESDAY)).toBe(true);
  });
});

describe("recordDungeonAttempt", () => {
  it("both stale/null -> overwrites attempt_1", () => {
    const result = recordDungeonAttempt(null, null, MONDAY);
    expect(result.dungeonAttempt1).toEqual(MONDAY);
    expect(result.dungeonAttempt2).toBeNull();
  });

  it("attempt_1 is today's, attempt_2 stale/null -> overwrites attempt_2 (VIP 2nd attempt)", () => {
    const result = recordDungeonAttempt(MONDAY, null, MONDAY_LATER);
    expect(result.dungeonAttempt1).toEqual(MONDAY);
    expect(result.dungeonAttempt2).toEqual(MONDAY_LATER);
  });

  it("the next UTC day, a stale attempt_1 gets overwritten again", () => {
    const result = recordDungeonAttempt(MONDAY, MONDAY_LATER, TUESDAY);
    expect(result.dungeonAttempt1).toEqual(TUESDAY);
    expect(result.dungeonAttempt2).toEqual(MONDAY_LATER);
  });

  it("defensive fallback: both already today's overwrites the older one", () => {
    const now = new Date("2026-07-13T20:00:00.000Z");
    const result = recordDungeonAttempt(MONDAY, MONDAY_LATER, now);
    expect(result.dungeonAttempt1).toEqual(now);
    expect(result.dungeonAttempt2).toEqual(MONDAY_LATER);
  });
});

describe("nextUtcMidnight", () => {
  it("returns the next UTC calendar day at 00:00:00", () => {
    expect(nextUtcMidnight(MONDAY)).toEqual(new Date("2026-07-14T00:00:00.000Z"));
  });
});
