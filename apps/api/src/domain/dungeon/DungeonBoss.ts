import type { DropTuple, MonsterType } from "@/domain/monster/Monster";
import type { AttributeValues } from "@/domain/shared/Attributes";

export interface DungeonBossProps {
  id: string;
  name: string;
  description: string;
  monsterImage: string;
  monsterType: MonsterType;
  baseHp: number;
  baseXpGain: number;
  baseMaxStamina: number;
  baseAttributes: AttributeValues;
  drops: DropTuple[];
  exclusiveDrops: DropTuple[];
  /** Third pool, unique to dungeon bosses: legendary-rarity items at a very
   * low dropRate (plan3 §2c). */
  legendaryDrops: DropTuple[];
}

/** Dungeon boss catalog entry (plan3 §2c) — base stats at the tier-1/level-10
 * baseline, scaled on demand by scaleDungeonBossStats. */
export class DungeonBoss {
  private constructor(private readonly props: DungeonBossProps) {}

  static create(props: DungeonBossProps): DungeonBoss {
    if (props.baseHp < 1) throw new Error("DungeonBoss baseHp must be >= 1");
    if (props.baseXpGain < 0) throw new Error("DungeonBoss baseXpGain must be >= 0");
    if (props.baseMaxStamina < 1) throw new Error("DungeonBoss baseMaxStamina must be >= 1");
    return new DungeonBoss(props);
  }

  get id(): string {
    return this.props.id;
  }
  get name(): string {
    return this.props.name;
  }
  get description(): string {
    return this.props.description;
  }
  get monsterImage(): string {
    return this.props.monsterImage;
  }
  get monsterType(): MonsterType {
    return this.props.monsterType;
  }
  get baseHp(): number {
    return this.props.baseHp;
  }
  get baseXpGain(): number {
    return this.props.baseXpGain;
  }
  get baseMaxStamina(): number {
    return this.props.baseMaxStamina;
  }
  get baseAttributes(): AttributeValues {
    return { ...this.props.baseAttributes };
  }
  get drops(): DropTuple[] {
    return [...this.props.drops];
  }
  get exclusiveDrops(): DropTuple[] {
    return [...this.props.exclusiveDrops];
  }
  get legendaryDrops(): DropTuple[] {
    return [...this.props.legendaryDrops];
  }

  toProps(): DungeonBossProps {
    return { ...this.props, baseAttributes: { ...this.props.baseAttributes } };
  }
}
