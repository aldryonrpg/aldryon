export class DuplicateItemNameError extends Error {
  constructor(name: string) {
    super(`An item named "${name}" already exists`);
    this.name = "DuplicateItemNameError";
  }
}

export class ItemNotFoundError extends Error {
  constructor() {
    super("Item not found");
    this.name = "ItemNotFoundError";
  }
}
