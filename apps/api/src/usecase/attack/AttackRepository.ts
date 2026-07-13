import type { Attack } from "@/domain/attack/Attack";

/** Port implemented by infrastructure (Postgres) for the player attack catalog. */
export interface AttackRepository {
  findAll(): Promise<Attack[]>;
  findByName(name: string): Promise<Attack | null>;
}
