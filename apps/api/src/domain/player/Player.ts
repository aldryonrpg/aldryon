import {
  maxHp as computeMaxHp,
  maxStamina as computeMaxStamina,
} from "@/domain/battle/battleConfig";
import { Attributes, type AttributeValues } from "@/domain/shared/Attributes";

const PLAYER_NAME_PATTERN = /^[A-Za-z0-9]{5,40}$/;

export interface PlayerProps {
  id: string;
  userId: string;
  /** The on-screen name — null until the player sets one (moved off User, plan2 §3a). */
  playerName: string | null;
  gold: number;
  level: number;
  xp: number;
  attributePoints: number;
  attributes: AttributeValues;
  lastDeathAt: Date | null;
  lastRunAt: Date | null;
  /** Item ids awaiting the player's pick from the last kill (plan2 §5e). */
  pendingLoot: string[];
}

/**
 * Player gameplay aggregate — 1:1 with User but its own aggregate; auth/
 * profile stays in User (plan2 §3a/§10). Immutable, like User: usecases
 * build a new Player.create(...) with merged props when persisting updates.
 */
export class Player {
  private readonly attributes: Attributes;

  private constructor(
    private readonly props: Omit<PlayerProps, "attributes">,
    attributes: Attributes,
  ) {
    this.attributes = attributes;
  }

  static create(props: PlayerProps): Player {
    if (props.gold < 0) throw new Error("Player gold must be >= 0");
    if (props.level < 1) throw new Error("Player level must be >= 1");
    if (props.xp < 0) throw new Error("Player xp must be >= 0");
    if (props.attributePoints < 0) throw new Error("Player attributePoints must be >= 0");
    if (props.playerName !== null && !PLAYER_NAME_PATTERN.test(props.playerName)) {
      throw new Error("Player name must be 5-40 alphanumeric characters");
    }

    const { attributes, ...rest } = props;
    return new Player(rest, Attributes.create(attributes));
  }

  get id(): string {
    return this.props.id;
  }
  get userId(): string {
    return this.props.userId;
  }
  get playerName(): string | null {
    return this.props.playerName;
  }
  get gold(): number {
    return this.props.gold;
  }
  get level(): number {
    return this.props.level;
  }
  get xp(): number {
    return this.props.xp;
  }
  get attributePoints(): number {
    return this.props.attributePoints;
  }
  get lastDeathAt(): Date | null {
    return this.props.lastDeathAt;
  }
  get lastRunAt(): Date | null {
    return this.props.lastRunAt;
  }
  get pendingLoot(): string[] {
    return [...this.props.pendingLoot];
  }

  getAttributes(): Attributes {
    return this.attributes;
  }

  /** Effective attributes = base + sum of equipped item bonuses, floored at 1 (plan2 §2). */
  effectiveAttributes(equippedBonuses: Partial<AttributeValues>): Attributes {
    return this.attributes.withBonuses(equippedBonuses);
  }

  /** Max HP = 100 + 10*Vitality + 1*Force, using effective attributes (plan2 §3a). */
  maxHp(effective: Attributes): number {
    return computeMaxHp(effective.vitality, effective.force);
  }

  /** Max Stamina = min(100, 20 + 5*level) (plan2 §3a). */
  maxStamina(): number {
    return computeMaxStamina(this.props.level);
  }

  toProps(): PlayerProps {
    return {
      ...this.props,
      attributes: this.attributes.toValues(),
      pendingLoot: [...this.props.pendingLoot],
    };
  }
}
