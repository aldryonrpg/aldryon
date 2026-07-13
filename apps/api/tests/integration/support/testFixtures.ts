import type { SQL } from "bun";

/**
 * Raw-SQL fixture helpers for integration tests — inserting directly keeps
 * each test in full control of exact stats (guaranteed hits, one-shot kills,
 * specific charge state) without depending on the seeded catalog's numbers.
 */

export async function createTestUser(
  sql: SQL,
  overrides: { isVip?: boolean } = {},
): Promise<string> {
  const id = Bun.randomUUIDv7();
  await sql`
    insert into users (id, external_auth_id, email, is_vip)
    values (${id}, ${`test-auth-${id}`}, ${`${id}@example.com`}, ${overrides.isVip ?? false})
  `;
  return id;
}

export interface TestPlayerOverrides {
  gold?: number;
  level?: number;
  xp?: number;
  attributePoints?: number;
  force?: number;
  dexterity?: number;
  agility?: number;
  intelligence?: number;
  vitality?: number;
  luck?: number;
  lastRunAt?: Date | null;
  lastDeathAt?: Date | null;
}

export async function createTestPlayer(
  sql: SQL,
  userId: string,
  overrides: TestPlayerOverrides = {},
): Promise<string> {
  const id = Bun.randomUUIDv7();
  await sql`
    insert into players (
      id, user_id, gold, level, xp, attribute_points,
      force, dexterity, agility, intelligence, vitality, luck,
      last_run_at, last_death_at
    ) values (
      ${id}, ${userId}, ${overrides.gold ?? 0}, ${overrides.level ?? 1}, ${overrides.xp ?? 0},
      ${overrides.attributePoints ?? 10},
      ${overrides.force ?? 1}, ${overrides.dexterity ?? 1}, ${overrides.agility ?? 1},
      ${overrides.intelligence ?? 1}, ${overrides.vitality ?? 1}, ${overrides.luck ?? 1},
      ${overrides.lastRunAt ?? null}, ${overrides.lastDeathAt ?? null}
    )
  `;
  return id;
}

export interface TestMonsterOverrides {
  region?: string;
  hp?: number;
  level?: number;
  xpGain?: number;
  maxStamina?: number;
  force?: number;
  dexterity?: number;
  agility?: number;
  intelligence?: number;
  vitality?: number;
  luck?: number;
  monsterType?: "normal" | "poisonous";
  ambushChance?: number;
  drops?: { itemId: string; dropRate: number }[];
  exclusiveDrops?: { itemId: string; dropRate: number }[];
}

export async function createTestMonster(
  sql: SQL,
  overrides: TestMonsterOverrides = {},
): Promise<string> {
  const id = Bun.randomUUIDv7();
  await sql`
    insert into monsters (
      id, name, description, region, monster_image, hp, xp_gain, level, max_stamina,
      force, dexterity, agility, intelligence, vitality, luck, monster_type,
      drops, exclusive_drops, ambush_chance
    ) values (
      ${id}, ${`Test Monster ${id}`}, 'test monster', ${overrides.region ?? "forest"},
      ${`data:image/svg+xml,test-${id}`},
      ${overrides.hp ?? 100}, ${overrides.xpGain ?? 50}, ${overrides.level ?? 1}, ${overrides.maxStamina ?? 100},
      ${overrides.force ?? 1}, ${overrides.dexterity ?? 1}, ${overrides.agility ?? 1},
      ${overrides.intelligence ?? 1}, ${overrides.vitality ?? 1}, ${overrides.luck ?? 1},
      ${overrides.monsterType ?? "normal"},
      ${JSON.stringify(overrides.drops ?? [])}::jsonb, ${JSON.stringify(overrides.exclusiveDrops ?? [])}::jsonb,
      ${overrides.ambushChance ?? 0}
    )
  `;
  return id;
}

export interface TestMonsterAttackOverrides {
  name?: string;
  staminaCost?: number;
  multiplier?: number;
  scalingAttribute?: "force" | "intelligence";
  appliesEffect?: "bleed" | "poison" | "burn" | "fear" | "magic_aura_blast" | "stun" | null;
  counterItemId?: string | null;
  isSpecial?: boolean;
  chargeTurns?: number;
}

export async function createTestMonsterAttack(
  sql: SQL,
  overrides: TestMonsterAttackOverrides = {},
): Promise<string> {
  const id = Bun.randomUUIDv7();
  await sql`
    insert into monster_attacks (
      id, name, stamina_cost, multiplier, scaling_attribute, applies_effect, counter_item_id,
      is_special, charge_turns
    ) values (
      ${id}, ${overrides.name ?? `Test Attack ${id}`}, ${overrides.staminaCost ?? 0}, ${overrides.multiplier ?? 1},
      ${overrides.scalingAttribute ?? "force"}, ${overrides.appliesEffect ?? null}, ${overrides.counterItemId ?? null},
      ${overrides.isSpecial ?? false}, ${overrides.chargeTurns ?? 0}
    )
  `;
  return id;
}

export async function linkMonsterMoveset(
  sql: SQL,
  monsterId: string,
  monsterAttackId: string,
): Promise<void> {
  await sql`
    insert into monster_movesets (monster_id, monster_attack_id) values (${monsterId}, ${monsterAttackId})
  `;
}

export interface TestItemOverrides {
  name?: string;
  value?: number;
  rarity?: "common" | "uncommon" | "rare" | "epic" | "legendary";
  slot?: string | null;
  hpRestore?: number | null;
  force?: number;
  dexterity?: number;
  agility?: number;
  intelligence?: number;
  vitality?: number;
  luck?: number;
}

export async function createTestItem(sql: SQL, overrides: TestItemOverrides = {}): Promise<string> {
  const id = Bun.randomUUIDv7();
  await sql`
    insert into items (
      id, name, description, value, rarity, slot, hp_restore,
      force, dexterity, agility, intelligence, vitality, luck
    ) values (
      ${id}, ${overrides.name ?? `Test Item ${id}`}, 'test item', ${overrides.value ?? 10},
      ${overrides.rarity ?? "common"}, ${overrides.slot ?? null}, ${overrides.hpRestore ?? null},
      ${overrides.force ?? 0}, ${overrides.dexterity ?? 0}, ${overrides.agility ?? 0},
      ${overrides.intelligence ?? 0}, ${overrides.vitality ?? 0}, ${overrides.luck ?? 0}
    )
  `;
  return id;
}

export interface TestPlayerAttackOverrides {
  name?: string;
  staminaCost?: number;
  multiplier?: number;
  scalingAttribute?: "force" | "intelligence";
  appliesEffect?: "bleed" | "poison" | "burn" | null;
  counterItemId?: string | null;
  minLevel?: number;
  reqForce?: number;
  reqDexterity?: number;
  reqAgility?: number;
  reqIntelligence?: number;
  reqVitality?: number;
  reqLuck?: number;
}

export async function createTestPlayerAttack(
  sql: SQL,
  overrides: TestPlayerAttackOverrides = {},
): Promise<string> {
  const id = Bun.randomUUIDv7();
  await sql`
    insert into attacks (
      id, name, stamina_cost, multiplier, scaling_attribute, applies_effect, counter_item_id, min_level,
      req_force, req_dexterity, req_agility, req_intelligence, req_vitality, req_luck
    ) values (
      ${id}, ${overrides.name ?? `Test Player Attack ${id}`}, ${overrides.staminaCost ?? 0}, ${overrides.multiplier ?? 1},
      ${overrides.scalingAttribute ?? "force"}, ${overrides.appliesEffect ?? null}, ${overrides.counterItemId ?? null},
      ${overrides.minLevel ?? 1},
      ${overrides.reqForce ?? 1}, ${overrides.reqDexterity ?? 1}, ${overrides.reqAgility ?? 1},
      ${overrides.reqIntelligence ?? 1}, ${overrides.reqVitality ?? 1}, ${overrides.reqLuck ?? 1}
    )
  `;
  return id;
}

export async function createTestPlayerItem(
  sql: SQL,
  playerId: string,
  itemId: string,
  overrides: { equippedSlot?: string | null; quantity?: number } = {},
): Promise<string> {
  const id = Bun.randomUUIDv7();
  await sql`
    insert into player_items (id, player_id, item_id, equipped_slot, quantity)
    values (${id}, ${playerId}, ${itemId}, ${overrides.equippedSlot ?? null}, ${overrides.quantity ?? 1})
  `;
  return id;
}
