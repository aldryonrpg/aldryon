export class ItemNotPurchasableError extends Error {
  constructor() {
    super("This item is not available in the store");
    this.name = "ItemNotPurchasableError";
  }
}

export class InsufficientGoldError extends Error {
  constructor(
    public readonly price: number,
    public readonly gold: number,
  ) {
    super(`Not enough gold: costs ${price}, you have ${gold}`);
    this.name = "InsufficientGoldError";
  }
}

export class BagFullError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BagFullError";
  }
}

export class CannotSellEquippedItemError extends Error {
  constructor() {
    super("Cannot sell an equipped item — unequip it first");
    this.name = "CannotSellEquippedItemError";
  }
}
