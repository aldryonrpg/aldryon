import type { Attack } from "@/domain/attack/Attack";

/** Port implemented by infrastructure (Postgres) for the player attack catalog. */
export interface AttackRepository {
  findAll(): Promise<Attack[]>;
  findById(id: string): Promise<Attack | null>;
  findByName(name: string): Promise<Attack | null>;
  /** Admin create. */
  create(attack: Attack): Promise<Attack>;
  /** Admin patch. */
  update(attack: Attack): Promise<Attack>;
}
