import { Attributes, type AttributeValues } from "@/domain/shared/Attributes";

export type MonsterRegion = "mountain" | "forest" | "dungeon" | "bandit" | "sewage" | "ruins";
export type MonsterType = "normal" | "poisonous";

export interface DropTuple {
  itemId: string;
  /** Percent, in (0, 100]. */
  dropRate: number;
}

export interface MonsterProps {
  id: string;
  name: string;
  description: string;
  region: MonsterRegion;
  monsterImage: string;
  hp: number;
  xpGain: number;
  /** Fixed catalog data — monsters don't level up, but the shared damage
   * formula (plan2 §6) needs a defender_level "the same way" for both sides. */
  level: number;
  attributes: AttributeValues;
  monsterType: MonsterType;
  drops: DropTuple[];
  exclusiveDrops: DropTuple[];
  ambushChance: number;
}

function validateDropPool(pool: DropTuple[], poolName: string): void {
  for (const drop of pool) {
    if (drop.dropRate <= 0 || drop.dropRate > 100) {
      throw new Error(`Monster ${poolName} dropRate must be in (0, 100], got ${drop.dropRate}`);
    }
  }
}

/** Monster catalog entry (plan2 §3c). */
export class Monster {
  private readonly attributes: Attributes;

  private constructor(
    private readonly props: Omit<MonsterProps, "attributes">,
    attributes: Attributes,
  ) {
    this.attributes = attributes;
  }

  static create(props: MonsterProps): Monster {
    if (props.hp < 1) {
      throw new Error("Monster hp must be >= 1");
    }
    if (props.level < 1) {
      throw new Error("Monster level must be >= 1");
    }
    if (props.xpGain < 0) {
      throw new Error("Monster xpGain must be >= 0");
    }
    if (props.ambushChance < 0 || props.ambushChance > 100) {
      throw new Error("Monster ambushChance must be between 0 and 100");
    }
    validateDropPool(props.drops, "drops");
    validateDropPool(props.exclusiveDrops, "exclusiveDrops");

    const { attributes, ...rest } = props;
    return new Monster(rest, Attributes.create(attributes));
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
  get region(): MonsterRegion {
    return this.props.region;
  }
  get monsterImage(): string {
    return this.props.monsterImage;
  }
  get hp(): number {
    return this.props.hp;
  }
  get xpGain(): number {
    return this.props.xpGain;
  }
  get level(): number {
    return this.props.level;
  }
  get monsterType(): MonsterType {
    return this.props.monsterType;
  }
  get drops(): DropTuple[] {
    return [...this.props.drops];
  }
  get exclusiveDrops(): DropTuple[] {
    return [...this.props.exclusiveDrops];
  }
  get ambushChance(): number {
    return this.props.ambushChance;
  }

  getAttributes(): Attributes {
    return this.attributes;
  }

  /** The type DoT this monster inflicts on a successful proc (plan2 §3c/§6a). */
  get innateEffectKind(): "bleed" | "poison" {
    return this.monsterType === "poisonous" ? "poison" : "bleed";
  }

  toProps(): MonsterProps {
    return { ...this.props, attributes: this.attributes.toValues() };
  }
}
