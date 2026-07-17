export interface DungeonEncounterProps {
  id: string;
  dungeonBossId: string;
}

/** The dungeon's current boss identity (plan3 §2c) — one row, all 3 tiers
 * share it, tier is purely a scaling multiplier applied at materialization
 * time. Each dungeon step now draws a random catalog monster rather than a
 * fixed gatekeeper (loot-system follow-up), so this no longer pairs with
 * any one monster. */
export class DungeonEncounter {
  private constructor(private readonly props: DungeonEncounterProps) {}

  static create(props: DungeonEncounterProps): DungeonEncounter {
    return new DungeonEncounter(props);
  }

  get id(): string {
    return this.props.id;
  }
  get dungeonBossId(): string {
    return this.props.dungeonBossId;
  }

  toProps(): DungeonEncounterProps {
    return { ...this.props };
  }
}
