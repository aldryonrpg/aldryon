export interface DungeonEncounterProps {
  id: string;
  gatekeeperMonsterId: string;
  dungeonBossId: string;
}

/** Gatekeeper/boss pairing (plan3 §2c) — one row covers all 3 tiers, tier is
 * purely a scaling multiplier applied at materialization time. */
export class DungeonEncounter {
  private constructor(private readonly props: DungeonEncounterProps) {}

  static create(props: DungeonEncounterProps): DungeonEncounter {
    return new DungeonEncounter(props);
  }

  get id(): string {
    return this.props.id;
  }
  get gatekeeperMonsterId(): string {
    return this.props.gatekeeperMonsterId;
  }
  get dungeonBossId(): string {
    return this.props.dungeonBossId;
  }

  toProps(): DungeonEncounterProps {
    return { ...this.props };
  }
}
