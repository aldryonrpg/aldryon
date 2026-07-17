import type { UniqueItemOwnership } from "@/domain/item/UniqueItemOwnership";

/** Port implemented by infrastructure (Postgres) for unique-item ownership
 * tracking (loot-system follow-up). */
export interface UniqueItemOwnershipRepository {
  findByItemId(itemId: string): Promise<UniqueItemOwnership | null>;
  /** Atomically claims the item for playerId if it's currently unowned (or
   * has never been dropped before) — returns whether the claim succeeded.
   * Two concurrent claims for the same never-before-owned item can only
   * ever have one winner. */
  tryClaim(itemId: string, playerId: string, now: Date): Promise<boolean>;
  /** Clears current ownership (the item was destroyed or sold), appending
   * the outgoing owner + timestamp to the bounded history. A no-op if
   * playerId isn't actually the current owner. */
  release(itemId: string, playerId: string, now: Date): Promise<void>;
}
