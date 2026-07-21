export class BattleAlreadyInProgressError extends Error {
  constructor() {
    super("Player already has a battle in progress");
    this.name = "BattleAlreadyInProgressError";
  }
}

export class RunCooldownError extends Error {
  constructor(public readonly remainingSeconds: number) {
    super(`Run cooldown active: ${remainingSeconds}s remaining`);
    this.name = "RunCooldownError";
  }
}

export class BelowMinimumRegionLevelError extends Error {
  constructor(
    public readonly level: number,
    public readonly minimumLevel: number,
    public readonly region: string,
  ) {
    super(`Player level ${level} is below the minimum level (${minimumLevel}) for ${region}`);
    this.name = "BelowMinimumRegionLevelError";
  }
}

export class NoActiveBattleError extends Error {
  constructor() {
    super("Player has no active battle");
    this.name = "NoActiveBattleError";
  }
}

export class UnknownAttackError extends Error {
  constructor(attackName: string) {
    super(`Unknown attack: ${attackName}`);
    this.name = "UnknownAttackError";
  }
}

export class AttackNotUsableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AttackNotUsableError";
  }
}

export class InvalidBagItemError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidBagItemError";
  }
}

export class NoPendingLootError extends Error {
  constructor() {
    super("No pending loot to claim");
    this.name = "NoPendingLootError";
  }
}

export class InvalidLootPickError extends Error {
  constructor(itemId: string) {
    super(`"${itemId}" is not part of the current loot offer`);
    this.name = "InvalidLootPickError";
  }
}
