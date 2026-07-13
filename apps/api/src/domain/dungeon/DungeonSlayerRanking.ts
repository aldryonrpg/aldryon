export interface DungeonSlayerRankingProps {
  playerId: string;
  kills: number;
  lastKillAt: Date | null;
}

/** One row per player who has ever killed the tier-3 dungeon boss (plan3
 * §2g) — no row at all until their first kill. */
export class DungeonSlayerRanking {
  private constructor(private readonly props: DungeonSlayerRankingProps) {}

  static create(props: DungeonSlayerRankingProps): DungeonSlayerRanking {
    if (props.kills < 0) throw new Error("DungeonSlayerRanking kills must be >= 0");
    return new DungeonSlayerRanking(props);
  }

  get playerId(): string {
    return this.props.playerId;
  }
  get kills(): number {
    return this.props.kills;
  }
  get lastKillAt(): Date | null {
    return this.props.lastKillAt;
  }

  toProps(): DungeonSlayerRankingProps {
    return { ...this.props };
  }
}
