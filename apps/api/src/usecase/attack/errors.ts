export class DuplicateAttackNameError extends Error {
  constructor(name: string) {
    super(`An attack named "${name}" already exists`);
    this.name = "DuplicateAttackNameError";
  }
}

export class AttackNotFoundError extends Error {
  constructor() {
    super("Attack not found");
    this.name = "AttackNotFoundError";
  }
}
