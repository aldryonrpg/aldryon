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

export class DuplicateMonsterAttackNameError extends Error {
  constructor(name: string) {
    super(`A monster attack named "${name}" already exists`);
    this.name = "DuplicateMonsterAttackNameError";
  }
}

export class MonsterAttackNotFoundError extends Error {
  constructor() {
    super("Monster attack not found");
    this.name = "MonsterAttackNotFoundError";
  }
}
