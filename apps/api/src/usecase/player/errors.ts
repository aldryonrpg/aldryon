export class PlayerItemNotFoundError extends Error {
  constructor() {
    super("Player item not found");
    this.name = "PlayerItemNotFoundError";
  }
}

export class ItemNotEquippableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ItemNotEquippableError";
  }
}

export class InsufficientAttributePointsError extends Error {
  constructor() {
    super("Not enough attribute points to allocate");
    this.name = "InsufficientAttributePointsError";
  }
}
