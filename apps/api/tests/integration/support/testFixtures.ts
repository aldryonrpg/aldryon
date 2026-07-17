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
  strength?: number;
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
      strength, dexterity, agility, intelligence, vitality, luck,
      last_run_at, last_death_at
    ) values (
      ${id}, ${userId}, ${overrides.gold ?? 0}, ${overrides.level ?? 1}, ${overrides.xp ?? 0},
      ${overrides.attributePoints ?? 10},
      ${overrides.strength ?? 1}, ${overrides.dexterity ?? 1}, ${overrides.agility ?? 1},
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
  strength?: number;
  dexterity?: number;
  agility?: number;
  intelligence?: number;
  vitality?: number;
  luck?: number;
  monsterType?: "normal" | "poisonous";
  ambushChance?: number;
  drops?: { itemId: string; dropRate: number }[];
  exclusiveDrops?: { itemId: string; dropRate: number }[];
  legendaryDrops?: { itemId: string; dropRate: number }[];
}

export async function createTestMonster(
  sql: SQL,
  overrides: TestMonsterOverrides = {},
): Promise<string> {
  const id = Bun.randomUUIDv7();
  await sql`
    insert into monsters (
      id, name, description, region, monster_image, hp, xp_gain, level, max_stamina,
      strength, dexterity, agility, intelligence, vitality, luck, monster_type,
      drops, exclusive_drops, legendary_drops, ambush_chance
    ) values (
      ${id}, ${`Test Monster ${id}`}, 'test monster', ${overrides.region ?? "forest"},
      ${`data:image/svg+xml,test-${id}`},
      ${overrides.hp ?? 100}, ${overrides.xpGain ?? 50}, ${overrides.level ?? 1}, ${overrides.maxStamina ?? 100},
      ${overrides.strength ?? 1}, ${overrides.dexterity ?? 1}, ${overrides.agility ?? 1},
      ${overrides.intelligence ?? 1}, ${overrides.vitality ?? 1}, ${overrides.luck ?? 1},
      ${overrides.monsterType ?? "normal"},
      ${JSON.stringify(overrides.drops ?? [])}::jsonb, ${JSON.stringify(overrides.exclusiveDrops ?? [])}::jsonb,
      ${JSON.stringify(overrides.legendaryDrops ?? [])}::jsonb,
      ${overrides.ambushChance ?? 0}
    )
  `;

  // `monsters_seed_head_drop` (see the Monster Head migration) always appends
  // one more "<Name> Head" entry to `drops`, after whatever was just
  // inserted — strip it back off so `drops` matches `overrides.drops`
  // exactly. Tests here seed exact RNG sequences against `drops`'s length
  // and dropRates (tuple-roll-per-entry, then a winner-index roll among
  // successes — see rollDropPool), so an uncontrolled extra entry breaks
  // that determinism; the head-drop feature itself isn't what these tests
  // are about; it has no dedicated test coverage of its own yet.
  await sql`
    update monsters set drops = drops - (jsonb_array_length(drops) - 1) where id = ${id}
  `;

  return id;
}

// No createTestDungeonBoss/createTestDungeonEncounter fixtures: unlike every
// other fixture here, dungeon_encounters is a true production singleton
// (plan3 §2c — exactly one gatekeeper/boss pairing row, ever), and
// DungeonEncounterRepository.findOne() has no ordering to make a second row
// deterministic. Tests that need a dungeon encounter use the real
// migration-seeded Snake/Dragon pairing instead of inserting their own.

export async function setPlayerDungeonAttempts(
  sql: SQL,
  playerId: string,
  attempt1: Date | null,
  attempt2: Date | null,
): Promise<void> {
  await sql`
    update players set dungeon_attempt_1 = ${attempt1}, dungeon_attempt_2 = ${attempt2}
    where id = ${playerId}
  `;
}

/** Sets a player's dungeon-run progress directly (loot-system follow-up) —
 * lets ContinueDungeonUseCase tests start from "mid-run" without replaying
 * every prior step through StartDungeonUseCase. Pass all nulls to simulate
 * "no run in progress" (a finished/exited run). */
export async function setPlayerDungeonRun(
  sql: SQL,
  playerId: string,
  tier: 1 | 2 | 3 | null,
  step: number | null,
  totalSteps: number | null,
): Promise<void> {
  await sql`
    update players set
      dungeon_run_tier = ${tier}, dungeon_run_step = ${step}, dungeon_run_total_steps = ${totalSteps}
    where id = ${playerId}
  `;
}

export interface TestMonsterAttackOverrides {
  name?: string;
  staminaCost?: number;
  multiplier?: number;
  scalingAttribute?: "strength" | "intelligence";
  appliesEffect?: "bleed" | "poison" | "burn" | "fear" | "magic_aura_blast" | "stun" | null;
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
      id, name, stamina_cost, multiplier, scaling_attribute, applies_effect,
      is_special, charge_turns
    ) values (
      ${id}, ${overrides.name ?? `Test Attack ${id}`}, ${overrides.staminaCost ?? 0}, ${overrides.multiplier ?? 1},
      ${overrides.scalingAttribute ?? "strength"}, ${overrides.appliesEffect ?? null},
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
  rarity?: "basic" | "common" | "uncommon" | "rare" | "very_rare" | "legendary" | "unique";
  slot?: string | null;
  hpRestore?: number | null;
  strength?: number;
  dexterity?: number;
  agility?: number;
  intelligence?: number;
  vitality?: number;
  luck?: number;
  revealsAllMonsterAttributes?: boolean;
  setName?: string | null;
  storePurchasable?: boolean;
  itemImage?: string | null;
}

export async function createTestItem(sql: SQL, overrides: TestItemOverrides = {}): Promise<string> {
  const id = Bun.randomUUIDv7();
  await sql`
    insert into items (
      id, name, description, value, rarity, slot, hp_restore,
      strength, dexterity, agility, intelligence, vitality, luck,
      reveals_all_monster_attributes, set_name, store_purchasable, item_image
    ) values (
      ${id}, ${overrides.name ?? `Test Item ${id}`}, 'test item', ${overrides.value ?? 10},
      ${overrides.rarity ?? "common"}, ${overrides.slot ?? null}, ${overrides.hpRestore ?? null},
      ${overrides.strength ?? 0}, ${overrides.dexterity ?? 0}, ${overrides.agility ?? 0},
      ${overrides.intelligence ?? 0}, ${overrides.vitality ?? 0}, ${overrides.luck ?? 0},
      ${overrides.revealsAllMonsterAttributes ?? false}, ${overrides.setName ?? null},
      ${overrides.storePurchasable ?? true}, ${overrides.itemImage ?? null}
    )
  `;
  return id;
}

export interface TestPlayerAttackOverrides {
  name?: string;
  staminaCost?: number;
  multiplier?: number;
  scalingAttribute?: "strength" | "intelligence";
  appliesEffect?: "bleed" | "poison" | "burn" | null;
  minLevel?: number;
  reqStrength?: number;
  reqDexterity?: number;
  reqAgility?: number;
  reqIntelligence?: number;
  reqVitality?: number;
  reqLuck?: number;
  revealsRandomMonsterAttribute?: boolean;
}

export async function createTestPlayerAttack(
  sql: SQL,
  overrides: TestPlayerAttackOverrides = {},
): Promise<string> {
  const id = Bun.randomUUIDv7();
  await sql`
    insert into attacks (
      id, name, stamina_cost, multiplier, scaling_attribute, applies_effect, min_level,
      req_strength, req_dexterity, req_agility, req_intelligence, req_vitality, req_luck,
      reveals_random_monster_attribute
    ) values (
      ${id}, ${overrides.name ?? `Test Player Attack ${id}`}, ${overrides.staminaCost ?? 0}, ${overrides.multiplier ?? 1},
      ${overrides.scalingAttribute ?? "strength"}, ${overrides.appliesEffect ?? null},
      ${overrides.minLevel ?? 1},
      ${overrides.reqStrength ?? 1}, ${overrides.reqDexterity ?? 1}, ${overrides.reqAgility ?? 1},
      ${overrides.reqIntelligence ?? 1}, ${overrides.reqVitality ?? 1}, ${overrides.reqLuck ?? 1},
      ${overrides.revealsRandomMonsterAttribute ?? false}
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
