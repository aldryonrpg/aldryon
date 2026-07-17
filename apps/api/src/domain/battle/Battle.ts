import type { BattleEffect } from "@/domain/battle/BattleEffect";
import type { AttributeKey } from "@/domain/shared/Attributes";

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
  /** Rounds left before a Stun/Fear/Magic-Aura-Blast-applying special can be
   * selected again — 0 means usable. One shared field for all three status-
   * effect kinds (not one per kind): set to the configured cooldown whenever
   * any of them unleashes, decrements by 1 every round regardless of what
   * the monster does (plan2 §6a, extended to cover the stat-decay debuffs
   * too — re-landing the same one back-to-back barely matters since
   * addBattleEffect refreshes rather than stacks it). */
  statusCooldownRoundsLeft: number;
  /** Null for every ordinary (non-dungeon) battle. Set at /dungeon/start or
   * /dungeon/continue — locked in per-battle rather than re-derived from the
   * player's level later, so a mid-fight level-up doesn't change which tier
   * the player is fighting partway through a step. */
  dungeonTier: 1 | 2 | 3 | null;
  /** True only when the monster in THIS battle is the tier's materialized
   * boss (loot-system follow-up) — the single discriminator settleTurn
   * needs to gate the Dungeon Slayer ranking upsert on, since every kill
   * (step or boss) now fully settles its own battle. False for every
   * regular dungeon step and every ordinary battle. */
  dungeonIsBossFight: boolean;
  /** Which of the monster's 6 attributes the player has revealed this battle
   * (REVEAL SPELL adds one at a time; Knowledge Potion adds all at once) —
   * everything else stays hidden ("??"), never sent to the client at all. */
  revealedMonsterAttributes: AttributeKey[];
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
    if (props.statusCooldownRoundsLeft < 0) {
      throw new Error("Battle statusCooldownRoundsLeft must be >= 0");
    }
    if (props.dungeonTier !== null && ![1, 2, 3].includes(props.dungeonTier)) {
      throw new Error("Battle dungeonTier must be 1, 2, or 3 when set");
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
  get statusCooldownRoundsLeft(): number {
    return this.props.statusCooldownRoundsLeft;
  }
  get dungeonTier(): 1 | 2 | 3 | null {
    return this.props.dungeonTier;
  }
  get dungeonIsBossFight(): boolean {
    return this.props.dungeonIsBossFight;
  }
  get revealedMonsterAttributes(): AttributeKey[] {
    return [...this.props.revealedMonsterAttributes];
  }

  toProps(): BattleProps {
    return {
      ...this.props,
      playerEffects: [...this.props.playerEffects],
      monsterEffects: [...this.props.monsterEffects],
      monsterAttackWeights: { ...this.props.monsterAttackWeights },
      revealedMonsterAttributes: [...this.props.revealedMonsterAttributes],
    };
  }
}
