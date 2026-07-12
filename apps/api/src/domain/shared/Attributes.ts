export interface AttributeValues {
  force: number;
  dexterity: number;
  agility: number;
  intelligence: number;
  vitality: number;
  luck: number;
}

export type AttributeKey = keyof AttributeValues;

export const ATTRIBUTE_KEYS: readonly AttributeKey[] = [
  "force",
  "dexterity",
  "agility",
  "intelligence",
  "vitality",
  "luck",
];

/**
 * Fighter attributes (players, monsters): integers, default 1, can never go
 * below 1 (plan2 §2). Reused by Player and Monster — item bonuses are a
 * looser shape (see `zeroAttributeValues`/`clampEffective` below) since they
 * start at 0 and may be negative.
 */
export class Attributes {
  private constructor(private readonly values: Readonly<AttributeValues>) {}

  static create(values: AttributeValues): Attributes {
    for (const key of ATTRIBUTE_KEYS) {
      const value = values[key];
      if (!Number.isInteger(value) || value < 1) {
        throw new Error(`Attribute "${key}" must be an integer >= 1, got ${value}`);
      }
    }
    return new Attributes({ ...values });
  }

  get force(): number {
    return this.values.force;
  }
  get dexterity(): number {
    return this.values.dexterity;
  }
  get agility(): number {
    return this.values.agility;
  }
  get intelligence(): number {
    return this.values.intelligence;
  }
  get vitality(): number {
    return this.values.vitality;
  }
  get luck(): number {
    return this.values.luck;
  }

  get(key: AttributeKey): number {
    return this.values[key];
  }

  toValues(): AttributeValues {
    return { ...this.values };
  }

  /**
   * A player's effective attributes = max(1, base + sum of equipped item
   * bonuses) per attribute (plan2 §2). The >=1 floor holds for the fighter
   * even when items drag a stat down; bonuses themselves are unclamped.
   */
  withBonuses(bonuses: Partial<AttributeValues>): Attributes {
    const next = {} as AttributeValues;
    for (const key of ATTRIBUTE_KEYS) {
      next[key] = Math.max(1, this.values[key] + (bonuses[key] ?? 0));
    }
    return new Attributes(next);
  }
}

/** Item attribute bonuses: default 0, may be negative — no floor (plan2 §2). */
export const ZERO_ATTRIBUTE_BONUSES: AttributeValues = {
  force: 0,
  dexterity: 0,
  agility: 0,
  intelligence: 0,
  vitality: 0,
  luck: 0,
};

export function sumAttributeBonuses(bonuses: AttributeValues[]): AttributeValues {
  const total = { ...ZERO_ATTRIBUTE_BONUSES };
  for (const bonus of bonuses) {
    for (const key of ATTRIBUTE_KEYS) {
      total[key] += bonus[key];
    }
  }
  return total;
}
