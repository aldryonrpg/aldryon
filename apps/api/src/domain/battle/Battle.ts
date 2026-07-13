import type { BattleEffect } from "@/domain/battle/BattleEffect";

export type BattleOutcome = "ongoing" | "won" | "lost" | "fled";

export interface BattleProps {
  id: string;
  playerId: string;
  monsterId: string;
  playerCurrentHp: number;
  playerCurrentStamina: number;
  monsterCurrentHp: number;
  monsterCurrentStamina: number;
  round: number;
  playerEffects: BattleEffect[];
  monsterEffects: BattleEffect[];
  monsterChargingAttackId: string | null;
  chargeRoundsLeft: number;
  /** Turns-since-last-picked per non-special monster_attacks.id — drives the
   * AI's damage+weight attack selection (plan2 §6a). */
  monsterAttackWeights: Record<string, number>;
  /** Rounds left before a Stun-applying special can be selected again — 0
   * means usable. Set to the configured cooldown on unleash, decrements by
   * 1 every round regardless of what the monster does (plan2 §6a). */
  stunCooldownRoundsLeft: number;
}

/**
 * The only stateful table (plan2 §3h) — exists only while the battle is
 * live; deleted on kill/death/flee. A player has at most one at a time,
 * enforced by a UNIQUE(player_id) DB constraint.
 */
export class Battle {
  private constructor(private readonly props: BattleProps) {}

  static create(props: BattleProps): Battle {
    if (props.playerCurrentHp < 0) throw new Error("Battle playerCurrentHp must be >= 0");
    if (props.playerCurrentStamina < 0) throw new Error("Battle playerCurrentStamina must be >= 0");
    if (props.monsterCurrentHp < 0) throw new Error("Battle monsterCurrentHp must be >= 0");
    if (props.monsterCurrentStamina < 0) {
      throw new Error("Battle monsterCurrentStamina must be >= 0");
    }
    if (props.stunCooldownRoundsLeft < 0) {
      throw new Error("Battle stunCooldownRoundsLeft must be >= 0");
    }
    return new Battle(props);
  }

  get id(): string {
    return this.props.id;
  }
  get playerId(): string {
    return this.props.playerId;
  }
  get monsterId(): string {
    return this.props.monsterId;
  }
  get playerCurrentHp(): number {
    return this.props.playerCurrentHp;
  }
  get playerCurrentStamina(): number {
    return this.props.playerCurrentStamina;
  }
  get monsterCurrentHp(): number {
    return this.props.monsterCurrentHp;
  }
  get monsterCurrentStamina(): number {
    return this.props.monsterCurrentStamina;
  }
  get round(): number {
    return this.props.round;
  }
  get playerEffects(): BattleEffect[] {
    return [...this.props.playerEffects];
  }
  get monsterEffects(): BattleEffect[] {
    return [...this.props.monsterEffects];
  }
  get monsterChargingAttackId(): string | null {
    return this.props.monsterChargingAttackId;
  }
  get chargeRoundsLeft(): number {
    return this.props.chargeRoundsLeft;
  }
  get isMonsterCharging(): boolean {
    return this.props.monsterChargingAttackId !== null && this.props.chargeRoundsLeft > 0;
  }
  get monsterAttackWeights(): Record<string, number> {
    return { ...this.props.monsterAttackWeights };
  }
  get stunCooldownRoundsLeft(): number {
    return this.props.stunCooldownRoundsLeft;
  }

  toProps(): BattleProps {
    return {
      ...this.props,
      playerEffects: [...this.props.playerEffects],
      monsterEffects: [...this.props.monsterEffects],
      monsterAttackWeights: { ...this.props.monsterAttackWeights },
    };
  }
}
