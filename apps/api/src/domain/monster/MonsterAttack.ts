export type AttackScaling = "force" | "intelligence";
/**
 * bleed/poison/burn are damage-over-time. fear/magic_aura_blast are
 * percentage stat-decay debuffs (Force/Intelligence); stun voids the
 * player's next turns. The latter three are delivered exclusively via
 * special attacks and have no counter item — they just run their course.
 */
export type BattleEffectKind = "bleed" | "poison" | "burn" | "fear" | "magic_aura_blast" | "stun";

export interface MonsterAttackProps {
  id: string;
  name: string;
  staminaCost: number;
  multiplier: number;
  scalingAttribute: AttackScaling;
  appliesEffect: BattleEffectKind | null;
  counterItemId: string | null;
  isSpecial: boolean;
  chargeTurns: number;
}

/**
 * Monster attack catalog entry (plan2 §3f). Unlike player Attack, carries no
 * level/attribute gating but adds the special-attack charge mechanics.
 */
export class MonsterAttack {
  private constructor(private readonly props: MonsterAttackProps) {}

  static create(props: MonsterAttackProps): MonsterAttack {
    if (props.staminaCost < 0) {
      throw new Error("MonsterAttack staminaCost must be >= 0");
    }
    if (props.isSpecial && props.chargeTurns < 1) {
      throw new Error("Special MonsterAttack requires chargeTurns >= 1");
    }
    if (props.counterItemId !== null && props.appliesEffect === null) {
      throw new Error("MonsterAttack counterItemId requires appliesEffect to be set");
    }
    return new MonsterAttack(props);
  }

  get id(): string {
    return this.props.id;
  }
  get name(): string {
    return this.props.name;
  }
  get staminaCost(): number {
    return this.props.staminaCost;
  }
  get multiplier(): number {
    return this.props.multiplier;
  }
  get scalingAttribute(): AttackScaling {
    return this.props.scalingAttribute;
  }
  get appliesEffect(): BattleEffectKind | null {
    return this.props.appliesEffect;
  }
  get counterItemId(): string | null {
    return this.props.counterItemId;
  }
  get isSpecial(): boolean {
    return this.props.isSpecial;
  }
  get chargeTurns(): number {
    return this.props.chargeTurns;
  }

  toProps(): MonsterAttackProps {
    return { ...this.props };
  }
}
