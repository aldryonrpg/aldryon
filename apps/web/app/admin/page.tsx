"use client";

import {
  type AttackAdminDto,
  type CreateAttackRequest,
  type CreateDungeonBossRequest,
  type CreateItemRequest,
  type CreateMonsterAttackRequest,
  type CreateMonsterRequest,
  DropPoolSchema,
  type DropTupleDto,
  type DungeonBossAdminDto,
  type ItemAdminDto,
  type MonsterAdminDto,
  type MonsterAttackAdminDto,
  type MonsterRegionAdminDto,
} from "@aldryon/dtos";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useEffect, useState } from "react";
import {
  ApiError,
  createAttackAdmin,
  createDungeonBossAdmin,
  createItemAdmin,
  createMonsterAdmin,
  createMonsterAttackAdmin,
  listAttacksAdmin,
  listDungeonBossesAdmin,
  listItemsAdmin,
  listMonsterAttacksAdmin,
  listMonstersAdmin,
  patchAttackAdmin,
  patchDungeonBossAdmin,
  patchItemAdmin,
  patchMonsterAdmin,
  patchMonsterAttackAdmin,
} from "@/lib/api";
import { createClient } from "@/lib/supabase/client";

const WILD_REGIONS = ["mountain", "forest", "bandit", "sewage", "ruins"] as const;
const MONSTER_TYPES = ["normal", "poisonous"] as const;
const ITEM_RARITIES = [
  "basic",
  "common",
  "uncommon",
  "rare",
  "very_rare",
  "legendary",
  "unique",
] as const;
const ITEM_SLOTS = [
  "helmet",
  "body",
  "boots",
  "gloves",
  "necklace",
  "bracelet",
  "weapon",
  "two_handed_weapon",
] as const;
/** The equipment sets seeded across supabase/migrations/*_equipment_sets*.sql,
 * ordered by tier (mirrors ITEM_RARITIES basic→legendary). Free text in the
 * DB (`set_name` has no CHECK constraint) since `equipmentSetBonus` only
 * needs matching strings across a full 6-slot group, not a real enum — but
 * these six are the only sets the game actually seeds, so the admin panel
 * offers them as a fixed list rather than a free-text field. */
const SET_TYPES = ["leather", "cloth", "iron", "silver", "gold", "platinum"] as const;
const ATTACK_SCALING_ATTRIBUTES = ["strength", "intelligence"] as const;
const BATTLE_EFFECT_KINDS = [
  "bleed",
  "poison",
  "burn",
  "fear",
  "magic_aura_blast",
  "stun",
] as const;

/** Converts an enum-style value (snake_case or camelCase) into Capitalized
 * Words With Spaces for display — "two_handed_weapon" → "Two Handed Weapon",
 * "dragonSet" → "Dragon Set". Used for the Slot and Set Type selectors. */
function formatEnumLabel(value: string): string {
  return value
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/_/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

/** The mutable fields a create/patch request carries — mirrors
 * CreateMonsterRequestSchema (apps/shared/dtos/src/admin.ts). Kept as its
 * own form-state shape (with drop pools as raw JSON text, not parsed arrays)
 * so the form doesn't need a dedicated item-picker UI for this first
 * version — an admin pastes a `[{"itemId":"...","dropRate":10}]` array. */
interface MonsterFormState {
  name: string;
  description: string;
  region: (typeof WILD_REGIONS)[number];
  monsterImage: string;
  hp: string;
  xpGain: string;
  level: string;
  maxStamina: string;
  strength: string;
  dexterity: string;
  agility: string;
  intelligence: string;
  vitality: string;
  luck: string;
  monsterType: (typeof MONSTER_TYPES)[number];
  ambushChance: string;
  drops: string;
  exclusiveDrops: string;
  legendaryDrops: string;
}

const EMPTY_FORM: MonsterFormState = {
  name: "",
  description: "",
  region: "mountain",
  monsterImage: "",
  hp: "100",
  xpGain: "10",
  level: "1",
  maxStamina: "100",
  strength: "1",
  dexterity: "1",
  agility: "1",
  intelligence: "1",
  vitality: "1",
  luck: "1",
  monsterType: "normal",
  ambushChance: "0",
  drops: "[]",
  exclusiveDrops: "[]",
  legendaryDrops: "[]",
};

function monsterToFormState(monster: MonsterAdminDto): MonsterFormState {
  return {
    name: monster.name,
    description: monster.description,
    region: WILD_REGIONS.includes(monster.region as (typeof WILD_REGIONS)[number])
      ? (monster.region as (typeof WILD_REGIONS)[number])
      : "mountain",
    monsterImage: monster.monsterImage,
    hp: String(monster.hp),
    xpGain: String(monster.xpGain),
    level: String(monster.level),
    maxStamina: String(monster.maxStamina),
    strength: String(monster.attributes.strength),
    dexterity: String(monster.attributes.dexterity),
    agility: String(monster.attributes.agility),
    intelligence: String(monster.attributes.intelligence),
    vitality: String(monster.attributes.vitality),
    luck: String(monster.attributes.luck),
    monsterType: monster.monsterType,
    ambushChance: String(monster.ambushChance),
    drops: JSON.stringify(monster.drops, null, 2),
    exclusiveDrops: JSON.stringify(monster.exclusiveDrops, null, 2),
    legendaryDrops: JSON.stringify(monster.legendaryDrops, null, 2),
  };
}

/** Validates against the exact same DropPoolSchema the backend enforces
 * (dropRate: integer, 1-1000 per-mille) — a bad pool is caught here with a
 * pointed message instead of surfacing as a raw 400 from the API. */
function parseDropPool(raw: string, fieldLabel: string): DropTupleDto[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`${fieldLabel} must be valid JSON, e.g. []`);
  }

  const result = DropPoolSchema.safeParse(parsed);
  if (!result.success) {
    const issue = result.error.issues[0];
    const path = issue?.path.join(".");
    const detail = issue?.message ?? "invalid drop pool";
    throw new Error(
      `${fieldLabel}${path ? ` [${path}]` : ""}: ${detail}. Each entry must be ` +
        `{"itemId": "...", "dropRate": <integer 1-1000>} — dropRate is per-mille ` +
        `(1000 = guaranteed, 100 = 10%).`,
    );
  }
  return result.data;
}

function formStateToRequest(form: MonsterFormState): CreateMonsterRequest {
  return {
    name: form.name,
    description: form.description,
    region: form.region,
    monsterImage: form.monsterImage,
    hp: Number(form.hp),
    xpGain: Number(form.xpGain),
    level: Number(form.level),
    maxStamina: Number(form.maxStamina),
    attributes: {
      strength: Number(form.strength),
      dexterity: Number(form.dexterity),
      agility: Number(form.agility),
      intelligence: Number(form.intelligence),
      vitality: Number(form.vitality),
      luck: Number(form.luck),
    },
    monsterType: form.monsterType,
    drops: parseDropPool(form.drops, "Drops"),
    exclusiveDrops: parseDropPool(form.exclusiveDrops, "Exclusive drops"),
    legendaryDrops: parseDropPool(form.legendaryDrops, "Legendary drops"),
    ambushChance: Number(form.ambushChance),
  };
}

/** Same shape convention as MonsterFormState — drop pools stay raw JSON
 * text. No region/level/ambushChance: a DungeonBoss row has none of those,
 * it's a base-stat template DungeonBossOfTheDayUseCase scales per tier. */
interface DungeonBossFormState {
  name: string;
  description: string;
  monsterImage: string;
  monsterType: (typeof MONSTER_TYPES)[number];
  baseHp: string;
  baseXpGain: string;
  baseMaxStamina: string;
  strength: string;
  dexterity: string;
  agility: string;
  intelligence: string;
  vitality: string;
  luck: string;
  drops: string;
  exclusiveDrops: string;
  legendaryDrops: string;
}

const EMPTY_BOSS_FORM: DungeonBossFormState = {
  name: "",
  description: "",
  monsterImage: "",
  monsterType: "normal",
  baseHp: "1000",
  baseXpGain: "500",
  baseMaxStamina: "150",
  strength: "10",
  dexterity: "10",
  agility: "10",
  intelligence: "10",
  vitality: "10",
  luck: "10",
  drops: "[]",
  exclusiveDrops: "[]",
  legendaryDrops: "[]",
};

function dungeonBossToFormState(dungeonBoss: DungeonBossAdminDto): DungeonBossFormState {
  return {
    name: dungeonBoss.name,
    description: dungeonBoss.description,
    monsterImage: dungeonBoss.monsterImage,
    monsterType: dungeonBoss.monsterType,
    baseHp: String(dungeonBoss.baseHp),
    baseXpGain: String(dungeonBoss.baseXpGain),
    baseMaxStamina: String(dungeonBoss.baseMaxStamina),
    strength: String(dungeonBoss.baseAttributes.strength),
    dexterity: String(dungeonBoss.baseAttributes.dexterity),
    agility: String(dungeonBoss.baseAttributes.agility),
    intelligence: String(dungeonBoss.baseAttributes.intelligence),
    vitality: String(dungeonBoss.baseAttributes.vitality),
    luck: String(dungeonBoss.baseAttributes.luck),
    drops: JSON.stringify(dungeonBoss.drops, null, 2),
    exclusiveDrops: JSON.stringify(dungeonBoss.exclusiveDrops, null, 2),
    legendaryDrops: JSON.stringify(dungeonBoss.legendaryDrops, null, 2),
  };
}

function bossFormStateToRequest(form: DungeonBossFormState): CreateDungeonBossRequest {
  return {
    name: form.name,
    description: form.description,
    monsterImage: form.monsterImage,
    monsterType: form.monsterType,
    baseHp: Number(form.baseHp),
    baseXpGain: Number(form.baseXpGain),
    baseMaxStamina: Number(form.baseMaxStamina),
    baseAttributes: {
      strength: Number(form.strength),
      dexterity: Number(form.dexterity),
      agility: Number(form.agility),
      intelligence: Number(form.intelligence),
      vitality: Number(form.vitality),
      luck: Number(form.luck),
    },
    drops: parseDropPool(form.drops, "Drops"),
    exclusiveDrops: parseDropPool(form.exclusiveDrops, "Exclusive drops"),
    legendaryDrops: parseDropPool(form.legendaryDrops, "Legendary drops"),
  };
}

/** No drop pools here — an Item is what gets dropped, not something that
 * drops something. `slot`/`hpRestore`/`setName`/`itemImage` are all
 * nullable on the domain (Item.ts) — kept as "" in form state meaning
 * null, same convention as the drop-pool JSON fields being "[]" for empty
 * rather than some other sentinel. */
interface ItemFormState {
  name: string;
  description: string;
  value: string;
  rarity: (typeof ITEM_RARITIES)[number];
  slot: "" | (typeof ITEM_SLOTS)[number];
  strength: string;
  dexterity: string;
  agility: string;
  intelligence: string;
  vitality: string;
  luck: string;
  hpRestore: string;
  revealsAllMonsterAttributes: boolean;
  setName: "" | (typeof SET_TYPES)[number];
  storePurchasable: boolean;
  itemImage: string;
  isPermanent: boolean;
}

const EMPTY_ITEM_FORM: ItemFormState = {
  name: "",
  description: "",
  value: "10",
  rarity: "common",
  slot: "",
  strength: "0",
  dexterity: "0",
  agility: "0",
  intelligence: "0",
  vitality: "0",
  luck: "0",
  hpRestore: "",
  revealsAllMonsterAttributes: false,
  setName: "",
  storePurchasable: true,
  itemImage: "",
  isPermanent: false,
};

function itemToFormState(item: ItemAdminDto): ItemFormState {
  return {
    name: item.name,
    description: item.description,
    value: String(item.value),
    rarity: item.rarity,
    slot: item.slot ?? "",
    strength: String(item.attributeBonuses.strength),
    dexterity: String(item.attributeBonuses.dexterity),
    agility: String(item.attributeBonuses.agility),
    intelligence: String(item.attributeBonuses.intelligence),
    vitality: String(item.attributeBonuses.vitality),
    luck: String(item.attributeBonuses.luck),
    hpRestore: item.hpRestore === null ? "" : String(item.hpRestore),
    revealsAllMonsterAttributes: item.revealsAllMonsterAttributes,
    setName:
      item.setName !== null && SET_TYPES.includes(item.setName as (typeof SET_TYPES)[number])
        ? (item.setName as (typeof SET_TYPES)[number])
        : "",
    storePurchasable: item.storePurchasable,
    itemImage: item.itemImage ?? "",
    isPermanent: item.isPermanent,
  };
}

function itemFormStateToRequest(form: ItemFormState): CreateItemRequest {
  return {
    name: form.name,
    description: form.description,
    value: Number(form.value),
    rarity: form.rarity,
    slot: form.slot === "" ? null : form.slot,
    attributeBonuses: {
      strength: Number(form.strength),
      dexterity: Number(form.dexterity),
      agility: Number(form.agility),
      intelligence: Number(form.intelligence),
      vitality: Number(form.vitality),
      luck: Number(form.luck),
    },
    hpRestore: form.hpRestore.trim() === "" ? null : Number(form.hpRestore),
    revealsAllMonsterAttributes: form.revealsAllMonsterAttributes,
    setName: form.setName === "" ? null : form.setName,
    storePurchasable: form.storePurchasable,
    itemImage: form.itemImage.trim() === "" ? null : form.itemImage,
    isPermanent: form.isPermanent,
  };
}

/** attributeRequirements has no upper bound in the domain (e.g. FIREBALL
 * SPELL requires Intelligence 30) — unlike an Item's attributeBonuses,
 * there's no -5..+5 cap here. */
interface AttackFormState {
  name: string;
  staminaCost: string;
  multiplier: string;
  scalingAttribute: (typeof ATTACK_SCALING_ATTRIBUTES)[number];
  minLevel: string;
  reqStrength: string;
  reqDexterity: string;
  reqAgility: string;
  reqIntelligence: string;
  reqVitality: string;
  reqLuck: string;
  revealsRandomMonsterAttribute: boolean;
}

const EMPTY_ATTACK_FORM: AttackFormState = {
  name: "",
  staminaCost: "0",
  multiplier: "1",
  scalingAttribute: "strength",
  minLevel: "1",
  reqStrength: "1",
  reqDexterity: "1",
  reqAgility: "1",
  reqIntelligence: "1",
  reqVitality: "1",
  reqLuck: "1",
  revealsRandomMonsterAttribute: false,
};

function attackToFormState(attack: AttackAdminDto): AttackFormState {
  return {
    name: attack.name,
    staminaCost: String(attack.staminaCost),
    multiplier: String(attack.multiplier),
    scalingAttribute: attack.scalingAttribute,
    minLevel: String(attack.minLevel),
    reqStrength: String(attack.attributeRequirements.strength),
    reqDexterity: String(attack.attributeRequirements.dexterity),
    reqAgility: String(attack.attributeRequirements.agility),
    reqIntelligence: String(attack.attributeRequirements.intelligence),
    reqVitality: String(attack.attributeRequirements.vitality),
    reqLuck: String(attack.attributeRequirements.luck),
    revealsRandomMonsterAttribute: attack.revealsRandomMonsterAttribute,
  };
}

function attackFormStateToRequest(form: AttackFormState): CreateAttackRequest {
  return {
    name: form.name,
    staminaCost: Number(form.staminaCost),
    multiplier: Number(form.multiplier),
    scalingAttribute: form.scalingAttribute,
    minLevel: Number(form.minLevel),
    attributeRequirements: {
      strength: Number(form.reqStrength),
      dexterity: Number(form.reqDexterity),
      agility: Number(form.reqAgility),
      intelligence: Number(form.reqIntelligence),
      vitality: Number(form.reqVitality),
      luck: Number(form.reqLuck),
    },
    revealsRandomMonsterAttribute: form.revealsRandomMonsterAttribute,
  };
}

/** Unlike a player Attack, a MonsterAttack has no level/attribute gating —
 * it adds special-attack charge mechanics instead (isSpecial/chargeTurns).
 * `appliesEffect` stays a normal editable field here (unlike Player
 * Attacks) — a monster's special attacks are how bleed/poison/fear/etc.
 * actually get inflicted in this game, so it's core to what this form is
 * for, not an edge case. */
interface MonsterAttackFormState {
  name: string;
  staminaCost: string;
  multiplier: string;
  scalingAttribute: (typeof ATTACK_SCALING_ATTRIBUTES)[number];
  appliesEffect: "" | (typeof BATTLE_EFFECT_KINDS)[number];
  isSpecial: boolean;
  chargeTurns: string;
}

const EMPTY_MONSTER_ATTACK_FORM: MonsterAttackFormState = {
  name: "",
  staminaCost: "0",
  multiplier: "1",
  scalingAttribute: "strength",
  appliesEffect: "",
  isSpecial: false,
  chargeTurns: "0",
};

function monsterAttackToFormState(monsterAttack: MonsterAttackAdminDto): MonsterAttackFormState {
  return {
    name: monsterAttack.name,
    staminaCost: String(monsterAttack.staminaCost),
    multiplier: String(monsterAttack.multiplier),
    scalingAttribute: monsterAttack.scalingAttribute,
    appliesEffect: monsterAttack.appliesEffect ?? "",
    isSpecial: monsterAttack.isSpecial,
    chargeTurns: String(monsterAttack.chargeTurns),
  };
}

function monsterAttackFormStateToRequest(form: MonsterAttackFormState): CreateMonsterAttackRequest {
  return {
    name: form.name,
    staminaCost: Number(form.staminaCost),
    multiplier: Number(form.multiplier),
    scalingAttribute: form.scalingAttribute,
    appliesEffect: form.appliesEffect === "" ? null : form.appliesEffect,
    isSpecial: form.isSpecial,
    chargeTurns: Number(form.chargeTurns),
  };
}

/** Shared explanation for all three drop-pool fields (Drops/Exclusive/
 * Legendary) in both MonsterForm and DungeonBossForm — dropRate is
 * per-mille, not a percent, and this is easy to get wrong once (e.g.
 * typing 10 meaning "10%" when it actually means 1%). */
function DropPoolHint() {
  return (
    <p className="text-xs text-stone-400">
      Each entry: <code>{'{ "itemId": "...", "dropRate": 1-1000 }'}</code> —{" "}
      <span className="text-stone-300">dropRate is per-mille (out of 1000)</span>, not a percent.{" "}
      <span className="font-bold text-stone-300">1000</span> = guaranteed drop,{" "}
      <span className="font-bold text-stone-300">100</span> = 10% chance,{" "}
      <span className="font-bold text-stone-300">1</span> = 0.1% chance.
    </p>
  );
}

function NumberField({
  label,
  value,
  onChange,
  min,
  max,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  min?: number;
  max?: number;
}) {
  return (
    <label className="flex flex-col gap-1 text-xs text-stone-400">
      {label}
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        min={min}
        max={max}
        className="border border-white bg-black px-2 py-1 text-sm text-stone-100"
      />
    </label>
  );
}

function CheckboxField({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2 text-xs text-stone-400">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4"
      />
      {label}
    </label>
  );
}

function MonsterForm({
  initial,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initial: MonsterFormState;
  submitLabel: string;
  onSubmit: (form: MonsterFormState) => Promise<void>;
  onCancel?: () => void;
}) {
  const [form, setForm] = useState(initial);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function field(key: keyof MonsterFormState) {
    return (value: string) => setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit(form);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 border border-white bg-black p-4">
      {error && <p className="text-sm text-red-400">{error}</p>}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-xs text-stone-400">
          Name
          <input
            value={form.name}
            onChange={(e) => field("name")(e.target.value)}
            required
            className="border border-white bg-black px-2 py-1 text-sm text-stone-100"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-stone-400">
          Region
          <select
            value={form.region}
            onChange={(e) => field("region")(e.target.value)}
            className="border border-white bg-black px-2 py-1 text-sm text-stone-100"
          >
            {WILD_REGIONS.map((region) => (
              <option key={region} value={region}>
                {formatEnumLabel(region)}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="flex flex-col gap-1 text-xs text-stone-400">
        Description
        <textarea
          value={form.description}
          onChange={(e) => field("description")(e.target.value)}
          required
          rows={2}
          className="border border-white bg-black px-2 py-1 text-sm text-stone-100"
        />
      </label>

      <label className="flex flex-col gap-1 text-xs text-stone-400">
        Monster image URL
        <input
          value={form.monsterImage}
          onChange={(e) => field("monsterImage")(e.target.value)}
          required
          className="border border-white bg-black px-2 py-1 text-sm text-stone-100"
        />
      </label>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <NumberField label="HP" value={form.hp} onChange={field("hp")} />
        <NumberField label="XP gain" value={form.xpGain} onChange={field("xpGain")} />
        <NumberField label="Level" value={form.level} onChange={field("level")} />
        <NumberField label="Max stamina" value={form.maxStamina} onChange={field("maxStamina")} />
      </div>

      <p className="text-xs text-stone-400">Attributes</p>
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
        <NumberField label="Strength" value={form.strength} onChange={field("strength")} />
        <NumberField label="Dexterity" value={form.dexterity} onChange={field("dexterity")} />
        <NumberField label="Agility" value={form.agility} onChange={field("agility")} />
        <NumberField
          label="Intelligence"
          value={form.intelligence}
          onChange={field("intelligence")}
        />
        <NumberField label="Vitality" value={form.vitality} onChange={field("vitality")} />
        <NumberField label="Luck" value={form.luck} onChange={field("luck")} />
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <label className="flex flex-col gap-1 text-xs text-stone-400">
          Monster type
          <select
            value={form.monsterType}
            onChange={(e) => field("monsterType")(e.target.value)}
            className="border border-white bg-black px-2 py-1 text-sm text-stone-100"
          >
            {MONSTER_TYPES.map((type) => (
              <option key={type} value={type}>
                {formatEnumLabel(type)}
              </option>
            ))}
          </select>
        </label>
        <NumberField
          label="Ambush chance (0-100)"
          value={form.ambushChance}
          onChange={field("ambushChance")}
        />
      </div>

      <DropPoolHint />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <label className="flex flex-col gap-1 text-xs text-stone-400">
          Drops (JSON)
          <textarea
            value={form.drops}
            onChange={(e) => field("drops")(e.target.value)}
            rows={6}
            className="border border-white bg-black px-2 py-1 font-mono text-xs text-stone-100"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-stone-400">
          Exclusive drops (JSON)
          <textarea
            value={form.exclusiveDrops}
            onChange={(e) => field("exclusiveDrops")(e.target.value)}
            rows={6}
            className="border border-white bg-black px-2 py-1 font-mono text-xs text-stone-100"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-stone-400">
          Legendary drops (JSON)
          <textarea
            value={form.legendaryDrops}
            onChange={(e) => field("legendaryDrops")(e.target.value)}
            rows={6}
            className="border border-white bg-black px-2 py-1 font-mono text-xs text-stone-100"
          />
        </label>
      </div>

      <div className="flex gap-2">
        <button type="submit" disabled={submitting} className="battle-button rounded-md px-4 py-2">
          {submitting ? "Saving..." : submitLabel}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="wood-gold-button rounded-md px-4 py-2"
          >
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}

function DungeonBossForm({
  initial,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initial: DungeonBossFormState;
  submitLabel: string;
  onSubmit: (form: DungeonBossFormState) => Promise<void>;
  onCancel?: () => void;
}) {
  const [form, setForm] = useState(initial);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function field(key: keyof DungeonBossFormState) {
    return (value: string) => setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit(form);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 border border-white bg-black p-4">
      {error && <p className="text-sm text-red-400">{error}</p>}

      <label className="flex flex-col gap-1 text-xs text-stone-400">
        Name
        <input
          value={form.name}
          onChange={(e) => field("name")(e.target.value)}
          required
          className="border border-white bg-black px-2 py-1 text-sm text-stone-100"
        />
      </label>

      <label className="flex flex-col gap-1 text-xs text-stone-400">
        Description
        <textarea
          value={form.description}
          onChange={(e) => field("description")(e.target.value)}
          required
          rows={2}
          className="border border-white bg-black px-2 py-1 text-sm text-stone-100"
        />
      </label>

      <label className="flex flex-col gap-1 text-xs text-stone-400">
        Monster image URL
        <input
          value={form.monsterImage}
          onChange={(e) => field("monsterImage")(e.target.value)}
          required
          className="border border-white bg-black px-2 py-1 text-sm text-stone-100"
        />
      </label>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <NumberField label="Base HP" value={form.baseHp} onChange={field("baseHp")} />
        <NumberField label="Base XP gain" value={form.baseXpGain} onChange={field("baseXpGain")} />
        <NumberField
          label="Base max stamina"
          value={form.baseMaxStamina}
          onChange={field("baseMaxStamina")}
        />
        <label className="flex flex-col gap-1 text-xs text-stone-400">
          Monster type
          <select
            value={form.monsterType}
            onChange={(e) => field("monsterType")(e.target.value)}
            className="border border-white bg-black px-2 py-1 text-sm text-stone-100"
          >
            {MONSTER_TYPES.map((type) => (
              <option key={type} value={type}>
                {formatEnumLabel(type)}
              </option>
            ))}
          </select>
        </label>
      </div>

      <p className="text-xs text-stone-400">Base attributes</p>
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
        <NumberField label="Strength" value={form.strength} onChange={field("strength")} />
        <NumberField label="Dexterity" value={form.dexterity} onChange={field("dexterity")} />
        <NumberField label="Agility" value={form.agility} onChange={field("agility")} />
        <NumberField
          label="Intelligence"
          value={form.intelligence}
          onChange={field("intelligence")}
        />
        <NumberField label="Vitality" value={form.vitality} onChange={field("vitality")} />
        <NumberField label="Luck" value={form.luck} onChange={field("luck")} />
      </div>

      <DropPoolHint />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <label className="flex flex-col gap-1 text-xs text-stone-400">
          Drops (JSON)
          <textarea
            value={form.drops}
            onChange={(e) => field("drops")(e.target.value)}
            rows={6}
            className="border border-white bg-black px-2 py-1 font-mono text-xs text-stone-100"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-stone-400">
          Exclusive drops (JSON)
          <textarea
            value={form.exclusiveDrops}
            onChange={(e) => field("exclusiveDrops")(e.target.value)}
            rows={6}
            className="border border-white bg-black px-2 py-1 font-mono text-xs text-stone-100"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-stone-400">
          Legendary drops (JSON)
          <textarea
            value={form.legendaryDrops}
            onChange={(e) => field("legendaryDrops")(e.target.value)}
            rows={6}
            className="border border-white bg-black px-2 py-1 font-mono text-xs text-stone-100"
          />
        </label>
      </div>

      <div className="flex gap-2">
        <button type="submit" disabled={submitting} className="battle-button rounded-md px-4 py-2">
          {submitting ? "Saving..." : submitLabel}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="wood-gold-button rounded-md px-4 py-2"
          >
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}

function ItemForm({
  initial,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initial: ItemFormState;
  submitLabel: string;
  onSubmit: (form: ItemFormState) => Promise<void>;
  onCancel?: () => void;
}) {
  const [form, setForm] = useState(initial);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function field(key: keyof ItemFormState) {
    return (value: string) => setForm((prev) => ({ ...prev, [key]: value }));
  }
  function boolField(key: keyof ItemFormState) {
    return (value: boolean) => setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit(form);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 border border-white bg-black p-4">
      {error && <p className="text-sm text-red-400">{error}</p>}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-xs text-stone-400">
          Name
          <input
            value={form.name}
            onChange={(e) => field("name")(e.target.value)}
            required
            className="border border-white bg-black px-2 py-1 text-sm text-stone-100"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-stone-400">
          Rarity
          <select
            value={form.rarity}
            onChange={(e) => field("rarity")(e.target.value)}
            className="border border-white bg-black px-2 py-1 text-sm text-stone-100"
          >
            {ITEM_RARITIES.map((rarity) => (
              <option key={rarity} value={rarity}>
                {formatEnumLabel(rarity)}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="flex flex-col gap-1 text-xs text-stone-400">
        Description
        <textarea
          value={form.description}
          onChange={(e) => field("description")(e.target.value)}
          required
          rows={2}
          className="border border-white bg-black px-2 py-1 text-sm text-stone-100"
        />
      </label>

      <label className="flex flex-col gap-1 text-xs text-stone-400">
        Image URL — served from <code>apps/web/public/items/</code>, e.g.{" "}
        <code>/items/sword.png</code> (shown on the Shop; blank falls back to a placeholder icon)
        <input
          value={form.itemImage}
          onChange={(e) => field("itemImage")(e.target.value)}
          placeholder="/items/sword.png"
          className="border border-white bg-black px-2 py-1 text-sm text-stone-100"
        />
      </label>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <NumberField label="Value (gold)" value={form.value} onChange={field("value")} />
        <label className="flex flex-col gap-1 text-xs text-stone-400">
          Slot
          <select
            value={form.slot}
            onChange={(e) => field("slot")(e.target.value)}
            className="border border-white bg-black px-2 py-1 text-sm text-stone-100"
          >
            <option value="">None (not equippable)</option>
            {ITEM_SLOTS.map((slot) => (
              <option key={slot} value={slot}>
                {formatEnumLabel(slot)}
              </option>
            ))}
          </select>
        </label>
        <NumberField
          label="HP restore (blank = none)"
          value={form.hpRestore}
          onChange={field("hpRestore")}
        />
        <label className="flex flex-col gap-1 text-xs text-stone-400">
          Set type
          <select
            value={form.setName}
            onChange={(e) => field("setName")(e.target.value)}
            className="border border-white bg-black px-2 py-1 text-sm text-stone-100"
          >
            <option value="">None</option>
            {SET_TYPES.map((setType) => (
              <option key={setType} value={setType}>
                {formatEnumLabel(setType)}
              </option>
            ))}
          </select>
        </label>
      </div>

      <p className="text-xs text-stone-400">Attribute bonuses (-5 to +5, integer)</p>
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
        <NumberField
          label="Strength"
          value={form.strength}
          onChange={field("strength")}
          min={-5}
          max={5}
        />
        <NumberField
          label="Dexterity"
          value={form.dexterity}
          onChange={field("dexterity")}
          min={-5}
          max={5}
        />
        <NumberField
          label="Agility"
          value={form.agility}
          onChange={field("agility")}
          min={-5}
          max={5}
        />
        <NumberField
          label="Intelligence"
          value={form.intelligence}
          onChange={field("intelligence")}
          min={-5}
          max={5}
        />
        <NumberField
          label="Vitality"
          value={form.vitality}
          onChange={field("vitality")}
          min={-5}
          max={5}
        />
        <NumberField label="Luck" value={form.luck} onChange={field("luck")} min={-5} max={5} />
      </div>

      <div className="flex flex-wrap gap-4">
        <CheckboxField
          label="Store purchasable"
          checked={form.storePurchasable}
          onChange={boolField("storePurchasable")}
        />
      </div>

      <div className="flex gap-2">
        <button type="submit" disabled={submitting} className="battle-button rounded-md px-4 py-2">
          {submitting ? "Saving..." : submitLabel}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="wood-gold-button rounded-md px-4 py-2"
          >
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}

function AttackForm({
  initial,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initial: AttackFormState;
  submitLabel: string;
  onSubmit: (form: AttackFormState) => Promise<void>;
  onCancel?: () => void;
}) {
  const [form, setForm] = useState(initial);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function field(key: keyof AttackFormState) {
    return (value: string) => setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit(form);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 border border-white bg-black p-4">
      {error && <p className="text-sm text-red-400">{error}</p>}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-xs text-stone-400">
          Name
          <input
            value={form.name}
            onChange={(e) => field("name")(e.target.value)}
            required
            className="border border-white bg-black px-2 py-1 text-sm text-stone-100"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-stone-400">
          Scaling attribute
          <select
            value={form.scalingAttribute}
            onChange={(e) => field("scalingAttribute")(e.target.value)}
            className="border border-white bg-black px-2 py-1 text-sm text-stone-100"
          >
            {ATTACK_SCALING_ATTRIBUTES.map((attribute) => (
              <option key={attribute} value={attribute}>
                {formatEnumLabel(attribute)}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <NumberField
          label="Stamina cost"
          value={form.staminaCost}
          onChange={field("staminaCost")}
        />
        <NumberField label="Multiplier" value={form.multiplier} onChange={field("multiplier")} />
        <NumberField label="Min level" value={form.minLevel} onChange={field("minLevel")} />
      </div>

      <p className="text-xs text-stone-400">Attribute requirements (min level/attribute to use)</p>
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
        <NumberField label="Strength" value={form.reqStrength} onChange={field("reqStrength")} />
        <NumberField label="Dexterity" value={form.reqDexterity} onChange={field("reqDexterity")} />
        <NumberField label="Agility" value={form.reqAgility} onChange={field("reqAgility")} />
        <NumberField
          label="Intelligence"
          value={form.reqIntelligence}
          onChange={field("reqIntelligence")}
        />
        <NumberField label="Vitality" value={form.reqVitality} onChange={field("reqVitality")} />
        <NumberField label="Luck" value={form.reqLuck} onChange={field("reqLuck")} />
      </div>

      <div className="flex gap-2">
        <button type="submit" disabled={submitting} className="battle-button rounded-md px-4 py-2">
          {submitting ? "Saving..." : submitLabel}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="wood-gold-button rounded-md px-4 py-2"
          >
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}

function MonsterAttackForm({
  initial,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initial: MonsterAttackFormState;
  submitLabel: string;
  onSubmit: (form: MonsterAttackFormState) => Promise<void>;
  onCancel?: () => void;
}) {
  const [form, setForm] = useState(initial);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function field(key: keyof MonsterAttackFormState) {
    return (value: string) => setForm((prev) => ({ ...prev, [key]: value }));
  }
  function boolField(key: keyof MonsterAttackFormState) {
    return (value: boolean) => setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit(form);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 border border-white bg-black p-4">
      {error && <p className="text-sm text-red-400">{error}</p>}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-xs text-stone-400">
          Name
          <input
            value={form.name}
            onChange={(e) => field("name")(e.target.value)}
            required
            className="border border-white bg-black px-2 py-1 text-sm text-stone-100"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-stone-400">
          Scaling attribute
          <select
            value={form.scalingAttribute}
            onChange={(e) => field("scalingAttribute")(e.target.value)}
            className="border border-white bg-black px-2 py-1 text-sm text-stone-100"
          >
            {ATTACK_SCALING_ATTRIBUTES.map((attribute) => (
              <option key={attribute} value={attribute}>
                {formatEnumLabel(attribute)}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <NumberField
          label="Stamina cost"
          value={form.staminaCost}
          onChange={field("staminaCost")}
        />
        <NumberField label="Multiplier" value={form.multiplier} onChange={field("multiplier")} />
        <label className="flex flex-col gap-1 text-xs text-stone-400">
          Applies effect
          <select
            value={form.appliesEffect}
            onChange={(e) => field("appliesEffect")(e.target.value)}
            className="border border-white bg-black px-2 py-1 text-sm text-stone-100"
          >
            <option value="">None</option>
            {BATTLE_EFFECT_KINDS.map((kind) => (
              <option key={kind} value={kind}>
                {formatEnumLabel(kind)}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-stone-400">
          Special attack
          <select
            value={form.isSpecial ? "yes" : "no"}
            onChange={(e) => boolField("isSpecial")(e.target.value === "yes")}
            className="border border-white bg-black px-2 py-1 text-sm text-stone-100"
          >
            <option value="no">No</option>
            <option value="yes">Yes (max 2 per moveset)</option>
          </select>
        </label>
        <NumberField
          label="Charge turns (specials only)"
          value={form.chargeTurns}
          onChange={field("chargeTurns")}
        />
      </div>

      <div className="flex gap-2">
        <button type="submit" disabled={submitting} className="battle-button rounded-md px-4 py-2">
          {submitting ? "Saving..." : submitLabel}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="wood-gold-button rounded-md px-4 py-2"
          >
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}

function regionLabel(region: MonsterRegionAdminDto): string {
  return region === "dungeon" ? "Dungeon (Materialized Boss)" : formatEnumLabel(region);
}

export default function AdminPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [monsters, setMonsters] = useState<MonsterAdminDto[]>([]);
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [regionFilter, setRegionFilter] = useState<"all" | (typeof WILD_REGIONS)[number]>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [dungeonBosses, setDungeonBosses] = useState<DungeonBossAdminDto[]>([]);
  const [creatingBoss, setCreatingBoss] = useState(false);
  const [editingBossId, setEditingBossId] = useState<string | null>(null);
  const [bossSearchQuery, setBossSearchQuery] = useState("");
  const [items, setItems] = useState<ItemAdminDto[]>([]);
  const [creatingItem, setCreatingItem] = useState(false);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [itemSearchQuery, setItemSearchQuery] = useState("");
  const [itemSlotFilter, setItemSlotFilter] = useState<
    "all" | "none" | (typeof ITEM_SLOTS)[number]
  >("all");
  const [itemSetTypeFilter, setItemSetTypeFilter] = useState<
    "all" | "none" | (typeof SET_TYPES)[number]
  >("all");
  const [itemPermanentFilter, setItemPermanentFilter] = useState<"all" | "yes" | "no">("all");
  const [attacks, setAttacks] = useState<AttackAdminDto[]>([]);
  const [creatingAttack, setCreatingAttack] = useState(false);
  const [editingAttackId, setEditingAttackId] = useState<string | null>(null);
  const [attackSearchQuery, setAttackSearchQuery] = useState("");
  const [monsterAttacks, setMonsterAttacks] = useState<MonsterAttackAdminDto[]>([]);
  const [creatingMonsterAttack, setCreatingMonsterAttack] = useState(false);
  const [editingMonsterAttackId, setEditingMonsterAttackId] = useState<string | null>(null);
  const [monsterAttackSearchQuery, setMonsterAttackSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<
    "monsters" | "bosses" | "items" | "attacks" | "monsterAttacks"
  >("monsters");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [
          monstersResult,
          dungeonBossesResult,
          itemsResult,
          attacksResult,
          monsterAttacksResult,
        ] = await Promise.all([
          listMonstersAdmin(),
          listDungeonBossesAdmin(),
          listItemsAdmin(),
          listAttacksAdmin(),
          listMonsterAttacksAdmin(),
        ]);
        if (cancelled) return;
        setMonsters(monstersResult.monsters);
        setDungeonBosses(dungeonBossesResult.dungeonBosses);
        setItems(itemsResult.items);
        setAttacks(attacksResult.attacks);
        setMonsterAttacks(monsterAttacksResult.monsterAttacks);
        setLoading(false);
      } catch (err) {
        if (cancelled) return;
        if (err instanceof ApiError && err.code === "FORBIDDEN") {
          router.replace("/");
          return;
        }
        setError(err instanceof Error ? err.message : "Failed to load the admin catalog");
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!cancelled) setUserEmail(user?.email ?? null);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleCreate(form: MonsterFormState) {
    const { monster } = await createMonsterAdmin(formStateToRequest(form));
    setMonsters((prev) => [...prev, monster].sort((a, b) => a.name.localeCompare(b.name)));
    setCreating(false);
  }

  async function handleEdit(id: string, form: MonsterFormState) {
    const { monster } = await patchMonsterAdmin(id, formStateToRequest(form));
    setMonsters((prev) => prev.map((m) => (m.id === id ? monster : m)));
    setEditingId(null);
  }

  async function handleCreateBoss(form: DungeonBossFormState) {
    const { dungeonBoss } = await createDungeonBossAdmin(bossFormStateToRequest(form));
    setDungeonBosses((prev) => [...prev, dungeonBoss].sort((a, b) => a.name.localeCompare(b.name)));
    setCreatingBoss(false);
  }

  async function handleEditBoss(id: string, form: DungeonBossFormState) {
    const { dungeonBoss } = await patchDungeonBossAdmin(id, bossFormStateToRequest(form));
    setDungeonBosses((prev) => prev.map((b) => (b.id === id ? dungeonBoss : b)));
    setEditingBossId(null);
  }

  async function handleCreateItem(form: ItemFormState) {
    const { item } = await createItemAdmin(itemFormStateToRequest(form));
    setItems((prev) => [...prev, item].sort((a, b) => a.name.localeCompare(b.name)));
    setCreatingItem(false);
  }

  async function handleEditItem(id: string, form: ItemFormState) {
    const { item } = await patchItemAdmin(id, itemFormStateToRequest(form));
    setItems((prev) => prev.map((i) => (i.id === id ? item : i)));
    setEditingItemId(null);
  }

  async function handleCreateAttack(form: AttackFormState) {
    const { attack } = await createAttackAdmin(attackFormStateToRequest(form));
    setAttacks((prev) => [...prev, attack].sort((a, b) => a.name.localeCompare(b.name)));
    setCreatingAttack(false);
  }

  async function handleEditAttack(id: string, form: AttackFormState) {
    const { attack } = await patchAttackAdmin(id, attackFormStateToRequest(form));
    setAttacks((prev) => prev.map((a) => (a.id === id ? attack : a)));
    setEditingAttackId(null);
  }

  async function handleCreateMonsterAttack(form: MonsterAttackFormState) {
    const { monsterAttack } = await createMonsterAttackAdmin(monsterAttackFormStateToRequest(form));
    setMonsterAttacks((prev) =>
      [...prev, monsterAttack].sort((a, b) => a.name.localeCompare(b.name)),
    );
    setCreatingMonsterAttack(false);
  }

  async function handleEditMonsterAttack(id: string, form: MonsterAttackFormState) {
    const { monsterAttack } = await patchMonsterAttackAdmin(
      id,
      monsterAttackFormStateToRequest(form),
    );
    setMonsterAttacks((prev) => prev.map((a) => (a.id === id ? monsterAttack : a)));
    setEditingMonsterAttackId(null);
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-black text-stone-100">
        Loading...
      </main>
    );
  }

  const normalizedQuery = searchQuery.trim().toLowerCase();
  const filteredMonsters = monsters.filter((monster) => {
    const matchesRegion = regionFilter === "all" || monster.region === regionFilter;
    const matchesQuery =
      normalizedQuery === "" || monster.name.toLowerCase().includes(normalizedQuery);
    return matchesRegion && matchesQuery;
  });

  const normalizedBossQuery = bossSearchQuery.trim().toLowerCase();
  const filteredDungeonBosses = dungeonBosses.filter(
    (dungeonBoss) =>
      normalizedBossQuery === "" || dungeonBoss.name.toLowerCase().includes(normalizedBossQuery),
  );

  const normalizedItemQuery = itemSearchQuery.trim().toLowerCase();
  const filteredItems = items.filter((item) => {
    const matchesSlot =
      itemSlotFilter === "all" ||
      (itemSlotFilter === "none" ? item.slot === null : item.slot === itemSlotFilter);
    const matchesSetType =
      itemSetTypeFilter === "all" ||
      (itemSetTypeFilter === "none" ? item.setName === null : item.setName === itemSetTypeFilter);
    const matchesPermanent =
      itemPermanentFilter === "all" || item.isPermanent === (itemPermanentFilter === "yes");
    const matchesQuery =
      normalizedItemQuery === "" || item.name.toLowerCase().includes(normalizedItemQuery);
    return matchesSlot && matchesSetType && matchesPermanent && matchesQuery;
  });

  const normalizedAttackQuery = attackSearchQuery.trim().toLowerCase();
  const filteredAttacks = attacks.filter(
    (attack) =>
      normalizedAttackQuery === "" || attack.name.toLowerCase().includes(normalizedAttackQuery),
  );

  const normalizedMonsterAttackQuery = monsterAttackSearchQuery.trim().toLowerCase();
  const filteredMonsterAttacks = monsterAttacks.filter(
    (monsterAttack) =>
      normalizedMonsterAttackQuery === "" ||
      monsterAttack.name.toLowerCase().includes(normalizedMonsterAttackQuery),
  );

  return (
    <main className="min-h-screen bg-black p-6 text-stone-100">
      <div className="mx-auto flex max-w-5xl flex-col gap-4">
        <div className="flex items-center justify-between border border-white bg-black px-4 py-2">
          <span className="font-bold">Administrative Panel{userEmail && ` - (${userEmail})`}</span>
          <Link href="/" className="wood-gold-button rounded-md px-3 py-1 text-sm">
            Return to Map
          </Link>
        </div>

        {error && <p className="text-sm text-red-400">{error}</p>}

        <div className="flex gap-4 border-b border-white/30">
          <button
            type="button"
            onClick={() => setActiveTab("monsters")}
            className={`px-2 pb-2 text-sm font-bold ${
              activeTab === "monsters"
                ? "border-b-2 border-amber-400 text-stone-100"
                : "text-stone-500 hover:text-stone-300"
            }`}
          >
            Monsters
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("bosses")}
            className={`px-2 pb-2 text-sm font-bold ${
              activeTab === "bosses"
                ? "border-b-2 border-amber-400 text-stone-100"
                : "text-stone-500 hover:text-stone-300"
            }`}
          >
            Bosses
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("items")}
            className={`px-2 pb-2 text-sm font-bold ${
              activeTab === "items"
                ? "border-b-2 border-amber-400 text-stone-100"
                : "text-stone-500 hover:text-stone-300"
            }`}
          >
            Items
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("attacks")}
            className={`px-2 pb-2 text-sm font-bold ${
              activeTab === "attacks"
                ? "border-b-2 border-amber-400 text-stone-100"
                : "text-stone-500 hover:text-stone-300"
            }`}
          >
            Player Attacks
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("monsterAttacks")}
            className={`px-2 pb-2 text-sm font-bold ${
              activeTab === "monsterAttacks"
                ? "border-b-2 border-amber-400 text-stone-100"
                : "text-stone-500 hover:text-stone-300"
            }`}
          >
            Monster Attacks
          </button>
        </div>

        {activeTab === "monsters" && (
          <>
            {creating ? (
              <MonsterForm
                initial={EMPTY_FORM}
                submitLabel="Create Monster"
                onSubmit={handleCreate}
                onCancel={() => setCreating(false)}
              />
            ) : (
              <button
                type="button"
                onClick={() => setCreating(true)}
                className="battle-button self-start rounded-md px-4 py-2"
              >
                New Monster
              </button>
            )}

            <div className="flex flex-wrap items-end gap-3 border border-white bg-black px-3 py-2">
              <label className="flex flex-col gap-1 text-xs text-stone-400">
                Search by name
                <input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Monster name..."
                  className="w-96 border border-white bg-black px-2 py-1 text-sm text-stone-100"
                />
              </label>
              <label className="flex flex-col gap-1 text-xs text-stone-400">
                Region
                <select
                  value={regionFilter}
                  onChange={(e) =>
                    setRegionFilter(e.target.value as "all" | (typeof WILD_REGIONS)[number])
                  }
                  className="border border-white bg-black px-2 py-1 text-sm text-stone-100"
                >
                  <option value="all">All regions</option>
                  {WILD_REGIONS.map((region) => (
                    <option key={region} value={region}>
                      {regionLabel(region)}
                    </option>
                  ))}
                </select>
              </label>
              <span className="text-xs text-stone-400">
                {filteredMonsters.length} of {monsters.length} monsters
              </span>
            </div>

            <div className="flex flex-col gap-2">
              {filteredMonsters.length === 0 && (
                <p className="text-sm text-stone-400">No monsters match this search/filter.</p>
              )}
              {filteredMonsters.map((monster) =>
                editingId === monster.id ? (
                  <MonsterForm
                    key={monster.id}
                    initial={monsterToFormState(monster)}
                    submitLabel="Save Changes"
                    onSubmit={(form) => handleEdit(monster.id, form)}
                    onCancel={() => setEditingId(null)}
                  />
                ) : (
                  <div
                    key={monster.id}
                    className="flex items-center justify-between gap-2 border border-white bg-black px-3 py-2 text-sm"
                  >
                    <span className="flex flex-1 flex-wrap items-center gap-x-3 gap-y-1">
                      <span className="font-bold">{monster.name}</span>
                      <span className="text-stone-400">{regionLabel(monster.region)}</span>
                      <span className="text-stone-400">Lv{monster.level}</span>
                      <span className="text-stone-400">{monster.hp} HP</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setEditingId(monster.id)}
                      className="wood-gold-button rounded-md px-3 py-1 text-xs"
                    >
                      Edit
                    </button>
                  </div>
                ),
              )}
            </div>
          </>
        )}

        {activeTab === "bosses" && (
          <>
            {creatingBoss ? (
              <DungeonBossForm
                initial={EMPTY_BOSS_FORM}
                submitLabel="Create Boss"
                onSubmit={handleCreateBoss}
                onCancel={() => setCreatingBoss(false)}
              />
            ) : (
              <button
                type="button"
                onClick={() => setCreatingBoss(true)}
                className="battle-button self-start rounded-md px-4 py-2"
              >
                New Boss
              </button>
            )}

            <div className="flex flex-wrap items-end gap-3 border border-white bg-black px-3 py-2">
              <label className="flex flex-col gap-1 text-xs text-stone-400">
                Search by name
                <input
                  value={bossSearchQuery}
                  onChange={(e) => setBossSearchQuery(e.target.value)}
                  placeholder="Boss name..."
                  className="w-96 border border-white bg-black px-2 py-1 text-sm text-stone-100"
                />
              </label>
              <span className="text-xs text-stone-400">
                {filteredDungeonBosses.length} of {dungeonBosses.length} bosses
              </span>
            </div>

            <div className="flex flex-col gap-2">
              {filteredDungeonBosses.length === 0 && (
                <p className="text-sm text-stone-400">
                  {dungeonBosses.length === 0
                    ? "No dungeon bosses configured yet."
                    : "No bosses match this search."}
                </p>
              )}
              {filteredDungeonBosses.map((dungeonBoss) =>
                editingBossId === dungeonBoss.id ? (
                  <DungeonBossForm
                    key={dungeonBoss.id}
                    initial={dungeonBossToFormState(dungeonBoss)}
                    submitLabel="Save Changes"
                    onSubmit={(form) => handleEditBoss(dungeonBoss.id, form)}
                    onCancel={() => setEditingBossId(null)}
                  />
                ) : (
                  <div
                    key={dungeonBoss.id}
                    className="flex items-center justify-between gap-2 border border-white bg-black px-3 py-2 text-sm"
                  >
                    <span className="flex flex-1 flex-wrap items-center gap-x-3 gap-y-1">
                      <span className="font-bold">{dungeonBoss.name}</span>
                      <span className="text-stone-400">{dungeonBoss.baseHp} base HP</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setEditingBossId(dungeonBoss.id)}
                      className="wood-gold-button rounded-md px-3 py-1 text-xs"
                    >
                      Edit
                    </button>
                  </div>
                ),
              )}
            </div>
          </>
        )}

        {activeTab === "items" && (
          <>
            {creatingItem ? (
              <ItemForm
                initial={EMPTY_ITEM_FORM}
                submitLabel="Create Item"
                onSubmit={handleCreateItem}
                onCancel={() => setCreatingItem(false)}
              />
            ) : (
              <button
                type="button"
                onClick={() => setCreatingItem(true)}
                className="battle-button self-start rounded-md px-4 py-2"
              >
                New Item
              </button>
            )}

            <div className="flex flex-wrap items-end gap-3 border border-white bg-black px-3 py-2">
              <label className="flex flex-col gap-1 text-xs text-stone-400">
                Search by name
                <input
                  value={itemSearchQuery}
                  onChange={(e) => setItemSearchQuery(e.target.value)}
                  placeholder="Item name..."
                  className="w-96 border border-white bg-black px-2 py-1 text-sm text-stone-100"
                />
              </label>
              <label className="flex flex-col gap-1 text-xs text-stone-400">
                Slot
                <select
                  value={itemSlotFilter}
                  onChange={(e) =>
                    setItemSlotFilter(
                      e.target.value as "all" | "none" | (typeof ITEM_SLOTS)[number],
                    )
                  }
                  className="border border-white bg-black px-2 py-1 text-sm text-stone-100"
                >
                  <option value="all">All slots</option>
                  <option value="none">None (not equippable)</option>
                  {ITEM_SLOTS.map((slot) => (
                    <option key={slot} value={slot}>
                      {formatEnumLabel(slot)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-xs text-stone-400">
                Set type
                <select
                  value={itemSetTypeFilter}
                  onChange={(e) =>
                    setItemSetTypeFilter(
                      e.target.value as "all" | "none" | (typeof SET_TYPES)[number],
                    )
                  }
                  className="border border-white bg-black px-2 py-1 text-sm text-stone-100"
                >
                  <option value="all">All set types</option>
                  <option value="none">None</option>
                  {SET_TYPES.map((setType) => (
                    <option key={setType} value={setType}>
                      {formatEnumLabel(setType)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-xs text-stone-400">
                Permanent
                <select
                  value={itemPermanentFilter}
                  onChange={(e) => setItemPermanentFilter(e.target.value as "all" | "yes" | "no")}
                  className="border border-white bg-black px-2 py-1 text-sm text-stone-100"
                >
                  <option value="all">All items</option>
                  <option value="yes">Permanent</option>
                  <option value="no">Not permanent</option>
                </select>
              </label>
              <span className="text-xs text-stone-400">
                {filteredItems.length} of {items.length} items
              </span>
            </div>

            <div className="flex flex-col gap-2">
              {filteredItems.length === 0 && (
                <p className="text-sm text-stone-400">
                  {items.length === 0 ? "No items configured yet." : "No items match this search."}
                </p>
              )}
              {filteredItems.map((item) =>
                editingItemId === item.id ? (
                  <ItemForm
                    key={item.id}
                    initial={itemToFormState(item)}
                    submitLabel="Save Changes"
                    onSubmit={(form) => handleEditItem(item.id, form)}
                    onCancel={() => setEditingItemId(null)}
                  />
                ) : (
                  <div
                    key={item.id}
                    className="flex items-center justify-between gap-2 border border-white bg-black px-3 py-2 text-sm"
                  >
                    <span className="flex flex-1 flex-wrap items-center gap-x-3 gap-y-1">
                      <span className="font-bold">{item.name}</span>
                      <span className="text-stone-400">{item.rarity}</span>
                      {item.slot && <span className="text-stone-400">{item.slot}</span>}
                      <span className="text-stone-400">{item.value}g</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setEditingItemId(item.id)}
                      className="wood-gold-button rounded-md px-3 py-1 text-xs"
                    >
                      Edit
                    </button>
                  </div>
                ),
              )}
            </div>
          </>
        )}

        {activeTab === "attacks" && (
          <>
            {creatingAttack ? (
              <AttackForm
                initial={EMPTY_ATTACK_FORM}
                submitLabel="Create Attack"
                onSubmit={handleCreateAttack}
                onCancel={() => setCreatingAttack(false)}
              />
            ) : (
              <button
                type="button"
                onClick={() => setCreatingAttack(true)}
                className="battle-button self-start rounded-md px-4 py-2"
              >
                New Attack
              </button>
            )}

            <div className="flex flex-wrap items-end gap-3 border border-white bg-black px-3 py-2">
              <label className="flex flex-col gap-1 text-xs text-stone-400">
                Search by name
                <input
                  value={attackSearchQuery}
                  onChange={(e) => setAttackSearchQuery(e.target.value)}
                  placeholder="Attack name..."
                  className="w-96 border border-white bg-black px-2 py-1 text-sm text-stone-100"
                />
              </label>
              <span className="text-xs text-stone-400">
                {filteredAttacks.length} of {attacks.length} attacks
              </span>
            </div>

            <div className="flex flex-col gap-2">
              {filteredAttacks.length === 0 && (
                <p className="text-sm text-stone-400">
                  {attacks.length === 0
                    ? "No player attacks configured yet."
                    : "No attacks match this search."}
                </p>
              )}
              {filteredAttacks.map((attack) =>
                editingAttackId === attack.id ? (
                  <AttackForm
                    key={attack.id}
                    initial={attackToFormState(attack)}
                    submitLabel="Save Changes"
                    onSubmit={(form) => handleEditAttack(attack.id, form)}
                    onCancel={() => setEditingAttackId(null)}
                  />
                ) : (
                  <div
                    key={attack.id}
                    className="flex items-center justify-between gap-2 border border-white bg-black px-3 py-2 text-sm"
                  >
                    <span className="flex flex-1 flex-wrap items-center gap-x-3 gap-y-1">
                      <span className="font-bold">{attack.name}</span>
                      <span className="text-stone-400">
                        {formatEnumLabel(attack.scalingAttribute)}
                      </span>
                      <span className="text-stone-400">Lv{attack.minLevel}+</span>
                      <span className="text-stone-400">{attack.staminaCost} stamina</span>
                      {attack.appliesEffect && (
                        <span className="text-stone-400">
                          {formatEnumLabel(attack.appliesEffect)}
                        </span>
                      )}
                    </span>
                    <button
                      type="button"
                      onClick={() => setEditingAttackId(attack.id)}
                      className="wood-gold-button rounded-md px-3 py-1 text-xs"
                    >
                      Edit
                    </button>
                  </div>
                ),
              )}
            </div>
          </>
        )}

        {activeTab === "monsterAttacks" && (
          <>
            {creatingMonsterAttack ? (
              <MonsterAttackForm
                initial={EMPTY_MONSTER_ATTACK_FORM}
                submitLabel="Create Monster Attack"
                onSubmit={handleCreateMonsterAttack}
                onCancel={() => setCreatingMonsterAttack(false)}
              />
            ) : (
              <button
                type="button"
                onClick={() => setCreatingMonsterAttack(true)}
                className="battle-button self-start rounded-md px-4 py-2"
              >
                New Monster Attack
              </button>
            )}

            <div className="flex flex-wrap items-end gap-3 border border-white bg-black px-3 py-2">
              <label className="flex flex-col gap-1 text-xs text-stone-400">
                Search by name
                <input
                  value={monsterAttackSearchQuery}
                  onChange={(e) => setMonsterAttackSearchQuery(e.target.value)}
                  placeholder="Monster attack name..."
                  className="w-96 border border-white bg-black px-2 py-1 text-sm text-stone-100"
                />
              </label>
              <span className="text-xs text-stone-400">
                {filteredMonsterAttacks.length} of {monsterAttacks.length} monster attacks
              </span>
            </div>

            <div className="flex flex-col gap-2">
              {filteredMonsterAttacks.length === 0 && (
                <p className="text-sm text-stone-400">
                  {monsterAttacks.length === 0
                    ? "No monster attacks configured yet."
                    : "No monster attacks match this search."}
                </p>
              )}
              {filteredMonsterAttacks.map((monsterAttack) =>
                editingMonsterAttackId === monsterAttack.id ? (
                  <MonsterAttackForm
                    key={monsterAttack.id}
                    initial={monsterAttackToFormState(monsterAttack)}
                    submitLabel="Save Changes"
                    onSubmit={(form) => handleEditMonsterAttack(monsterAttack.id, form)}
                    onCancel={() => setEditingMonsterAttackId(null)}
                  />
                ) : (
                  <div
                    key={monsterAttack.id}
                    className="flex items-center justify-between gap-2 border border-white bg-black px-3 py-2 text-sm"
                  >
                    <span className="flex flex-1 flex-wrap items-center gap-x-3 gap-y-1">
                      <span className="font-bold">{monsterAttack.name}</span>
                      <span className="text-stone-400">
                        {formatEnumLabel(monsterAttack.scalingAttribute)}
                      </span>
                      <span className="text-stone-400">{monsterAttack.staminaCost} stamina</span>
                      {monsterAttack.appliesEffect && (
                        <span className="text-stone-400">
                          {formatEnumLabel(monsterAttack.appliesEffect)}
                        </span>
                      )}
                      {monsterAttack.isSpecial && (
                        <span className="text-stone-400">
                          Special ({monsterAttack.chargeTurns} charge turns)
                        </span>
                      )}
                    </span>
                    <button
                      type="button"
                      onClick={() => setEditingMonsterAttackId(monsterAttack.id)}
                      className="wood-gold-button rounded-md px-3 py-1 text-xs"
                    >
                      Edit
                    </button>
                  </div>
                ),
              )}
            </div>
          </>
        )}
      </div>
    </main>
  );
}
