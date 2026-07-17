const MAX_OWNER_HISTORY = 5;

export interface OwnerHistoryEntry {
  playerId: string;
  timestampOfLastOwnership: string;
}

export interface UniqueItemOwnershipProps {
  itemId: string;
  currentOwnerPlayerId: string | null;
  ownerHistory: OwnerHistoryEntry[];
}

/**
 * Tracks the single current owner (if any) of a unique-rarity item
 * (loot-system follow-up) — a unique item may exist at most once across
 * the whole server. One row exists per unique item once it's ever dropped;
 * `currentOwnerPlayerId` goes back to null (never deleted) when the owner
 * destroys or sells it, so the item can be dropped again later.
 */
export class UniqueItemOwnership {
  private constructor(private readonly props: UniqueItemOwnershipProps) {}

  static create(props: UniqueItemOwnershipProps): UniqueItemOwnership {
    return new UniqueItemOwnership(props);
  }

  get itemId(): string {
    return this.props.itemId;
  }
  get currentOwnerPlayerId(): string | null {
    return this.props.currentOwnerPlayerId;
  }
  get ownerHistory(): OwnerHistoryEntry[] {
    return [...this.props.ownerHistory];
  }

  toProps(): UniqueItemOwnershipProps {
    return { ...this.props, ownerHistory: [...this.props.ownerHistory] };
  }
}

/**
 * Appends a new owner-history entry, truncated to the last 5 (oldest
 * dropped first) so the history never bloats — pure, no I/O.
 */
export function appendOwnerHistory(
  history: OwnerHistoryEntry[],
  entry: OwnerHistoryEntry,
): OwnerHistoryEntry[] {
  return [...history, entry].slice(-MAX_OWNER_HISTORY);
}
