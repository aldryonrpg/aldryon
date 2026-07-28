export class DuplicateMonsterNameError extends Error {
  constructor(name: string) {
    super(`A monster named "${name}" already exists`);
    this.name = "DuplicateMonsterNameError";
  }
}

export class MonsterNotFoundError extends Error {
  constructor() {
    super("Monster not found");
    this.name = "MonsterNotFoundError";
  }
}
