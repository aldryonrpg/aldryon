import type { AttackScaling, BattleEffectKind } from "@/domain/monster/MonsterAttack";
import { ATTRIBUTE_KEYS, type AttributeValues } from "@/domain/shared/Attributes";

export interface AttackProps {
  id: string;
  name: string;
  staminaCost: number;
  multiplier: number;
  scalingAttribute: AttackScaling;
  appliesEffect: BattleEffectKind | null;
  minLevel: number;
  attributeRequirements: AttributeValues;
  /** REVEAL SPELL only — reveals one random not-yet-known monster attribute
   * on a successful hit. */
  revealsRandomMonsterAttribute: boolean;
}

/**
 * Player attack catalog entry (plan2 §3e). meetsRequirements gates two
 * things on the API side: which attacks are unlocked (level/base attribute
 * requirements) and therefore included in the response at all, and which of
 * those are currently usable (same check against debuffed attributes, plus
 * Reveal Spell exhaustion) so the client can grey them out. Re-checked
 * server-side on every /battle/attack regardless (the client can't be
 * trusted).
 */
export class Attack {
  private constructor(private readonly props: AttackProps) {}

  static create(props: AttackProps): Attack {
    if (props.staminaCost < 0) {
      throw new Error("Attack staminaCost must be >= 0");
    }
    if (props.minLevel < 1) {
      throw new Error("Attack minLevel must be >= 1");
    }
    return new Attack(props);
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
  get minLevel(): number {
    return this.props.minLevel;
  }
  get attributeRequirements(): AttributeValues {
    return { ...this.props.attributeRequirements };
  }
  get revealsRandomMonsterAttribute(): boolean {
    return this.props.revealsRandomMonsterAttribute;
  }

  /** Level/attribute gating only — stamina affordability is checked separately. */
  meetsRequirements(level: number, effectiveAttributes: AttributeValues): boolean {
    if (level < this.props.minLevel) return false;
    for (const key of ATTRIBUTE_KEYS) {
      if (effectiveAttributes[key] < this.props.attributeRequirements[key]) return false;
    }
    return true;
  }

  toProps(): AttackProps {
    return { ...this.props, attributeRequirements: { ...this.props.attributeRequirements } };
  }
}
