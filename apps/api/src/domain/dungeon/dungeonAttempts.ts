import { DUNGEON_CONFIG } from "@/domain/dungeon/dungeonConfig";

function isSameUtcDay(date: Date | null, now: Date): boolean {
  if (!date) return false;
  return (
    date.getUTCFullYear() === now.getUTCFullYear() &&
    date.getUTCMonth() === now.getUTCMonth() &&
    date.getUTCDate() === now.getUTCDate()
  );
}

/**
 * Daily dungeon attempt tracking (plan3 §2f) — two nullable timestamptz slots
 * directly on players, not a separate table. A slot from a previous UTC day
 * simply doesn't count today; there's no explicit "reset" step, it falls out
 * of this date comparison.
 */
export function canAttemptDungeon(
  attempt1: Date | null,
  attempt2: Date | null,
  isVip: boolean,
  now: Date,
): boolean {
  const todaysAttempts = [attempt1, attempt2].filter((a) => isSameUtcDay(a, now)).length;
  const dailyLimit = isVip ? DUNGEON_CONFIG.vipDailyAttempts : DUNGEON_CONFIG.normalDailyAttempts;
  return todaysAttempts < dailyLimit;
}

export interface RecordedDungeonAttempt {
  dungeonAttempt1: Date | null;
  dungeonAttempt2: Date | null;
}

/**
 * Writes now() into whichever slot does NOT already hold today's date,
 * preferring slot 1 when both are eligible (plan3 §2f). If both already hold
 * today's date, eligibility should already have rejected the call — this
 * falls back to overwriting the older of the two, defensively.
 */
export function recordDungeonAttempt(
  attempt1: Date | null,
  attempt2: Date | null,
  now: Date,
): RecordedDungeonAttempt {
  const attempt1IsToday = isSameUtcDay(attempt1, now);
  const attempt2IsToday = isSameUtcDay(attempt2, now);

  if (!attempt1IsToday) {
    return { dungeonAttempt1: now, dungeonAttempt2: attempt2 };
  }
  if (!attempt2IsToday) {
    return { dungeonAttempt1: attempt1, dungeonAttempt2: now };
  }
  const attempt1IsOlder = (attempt1 as Date).getTime() <= (attempt2 as Date).getTime();
  return attempt1IsOlder
    ? { dungeonAttempt1: now, dungeonAttempt2: attempt2 }
    : { dungeonAttempt1: attempt1, dungeonAttempt2: now };
}

/** UTC reset time reported on a 429 (plan3 §2f): next midnight UTC. */
export function nextUtcMidnight(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
}
