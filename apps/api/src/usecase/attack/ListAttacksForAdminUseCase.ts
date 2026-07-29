import type { Attack } from "@/domain/attack/Attack";
import type { AttackRepository } from "@/usecase/attack/AttackRepository";

/** GET /admin/attacks — the full player attack catalog, same
 * uncached-at-this-call-site convention as ListItemsForAdminUseCase (the
 * repository's own whole-table cache still applies). */
export class ListAttacksForAdminUseCase {
  constructor(private readonly attackRepository: AttackRepository) {}

  async execute(): Promise<Attack[]> {
    return this.attackRepository.findAll();
  }
}
