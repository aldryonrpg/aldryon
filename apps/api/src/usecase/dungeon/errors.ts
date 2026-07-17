export class BelowMinimumDungeonLevelError extends Error {
  constructor(level: number, minimumLevel: number) {
    super(`Player level ${level} is below the minimum dungeon level (${minimumLevel})`);
    this.name = "BelowMinimumDungeonLevelError";
  }
}

export class DailyDungeonLimitReachedError extends Error {
  constructor(public readonly resetAt: Date) {
    super(`Daily dungeon attempt limit reached — resets at ${resetAt.toISOString()} (UTC)`);
    this.name = "DailyDungeonLimitReachedError";
  }
}

export class DungeonRunAlreadyInProgressError extends Error {
  constructor() {
    super("A dungeon run is already awaiting a Continue/Exit decision — continue or exit it first");
    this.name = "DungeonRunAlreadyInProgressError";
  }
}

export class NoDungeonRunInProgressError extends Error {
  constructor() {
    super("No dungeon run is currently in progress");
    this.name = "NoDungeonRunInProgressError";
  }
}
