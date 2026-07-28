"use client";

import type {
  CreateDungeonBossRequest,
  CreateMonsterRequest,
  DropTupleDto,
  DungeonBossAdminDto,
  MonsterAdminDto,
  MonsterRegionAdminDto,
} from "@aldryon/dtos";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useEffect, useState } from "react";
import {
  ApiError,
  createDungeonBossAdmin,
  createMonsterAdmin,
  listDungeonBossesAdmin,
  listMonstersAdmin,
  patchDungeonBossAdmin,
  patchMonsterAdmin,
} from "@/lib/api";

const WILD_REGIONS = ["mountain", "forest", "bandit", "sewage", "ruins"] as const;
const MONSTER_TYPES = ["normal", "poisonous"] as const;

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
    drops: JSON.stringify(monster.drops),
    exclusiveDrops: JSON.stringify(monster.exclusiveDrops),
    legendaryDrops: JSON.stringify(monster.legendaryDrops),
  };
}

function parseDropPool(raw: string, fieldLabel: string): DropTupleDto[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`${fieldLabel} must be valid JSON, e.g. []`);
  }
  if (!Array.isArray(parsed)) {
    throw new Error(`${fieldLabel} must be a JSON array`);
  }
  return parsed as DropTupleDto[];
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
    drops: JSON.stringify(dungeonBoss.drops),
    exclusiveDrops: JSON.stringify(dungeonBoss.exclusiveDrops),
    legendaryDrops: JSON.stringify(dungeonBoss.legendaryDrops),
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

function NumberField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="flex flex-col gap-1 text-xs text-stone-400">
      {label}
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="border border-white bg-black px-2 py-1 text-sm text-stone-100"
      />
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
                {region}
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
                {type}
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

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <label className="flex flex-col gap-1 text-xs text-stone-400">
          Drops (JSON)
          <textarea
            value={form.drops}
            onChange={(e) => field("drops")(e.target.value)}
            rows={2}
            className="border border-white bg-black px-2 py-1 font-mono text-xs text-stone-100"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-stone-400">
          Exclusive drops (JSON)
          <textarea
            value={form.exclusiveDrops}
            onChange={(e) => field("exclusiveDrops")(e.target.value)}
            rows={2}
            className="border border-white bg-black px-2 py-1 font-mono text-xs text-stone-100"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-stone-400">
          Legendary drops (JSON)
          <textarea
            value={form.legendaryDrops}
            onChange={(e) => field("legendaryDrops")(e.target.value)}
            rows={2}
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
                {type}
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

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <label className="flex flex-col gap-1 text-xs text-stone-400">
          Drops (JSON)
          <textarea
            value={form.drops}
            onChange={(e) => field("drops")(e.target.value)}
            rows={2}
            className="border border-white bg-black px-2 py-1 font-mono text-xs text-stone-100"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-stone-400">
          Exclusive drops (JSON)
          <textarea
            value={form.exclusiveDrops}
            onChange={(e) => field("exclusiveDrops")(e.target.value)}
            rows={2}
            className="border border-white bg-black px-2 py-1 font-mono text-xs text-stone-100"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-stone-400">
          Legendary drops (JSON)
          <textarea
            value={form.legendaryDrops}
            onChange={(e) => field("legendaryDrops")(e.target.value)}
            rows={2}
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

function regionLabel(region: MonsterRegionAdminDto): string {
  return region === "dungeon" ? "dungeon (materialized boss)" : region;
}

export default function AdminPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [monsters, setMonsters] = useState<MonsterAdminDto[]>([]);
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [regionFilter, setRegionFilter] = useState<"all" | (typeof WILD_REGIONS)[number]>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [dungeonBosses, setDungeonBosses] = useState<DungeonBossAdminDto[]>([]);
  const [creatingBoss, setCreatingBoss] = useState(false);
  const [editingBossId, setEditingBossId] = useState<string | null>(null);
  const [bossSearchQuery, setBossSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"monsters" | "bosses">("monsters");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [monstersResult, dungeonBossesResult] = await Promise.all([
          listMonstersAdmin(),
          listDungeonBossesAdmin(),
        ]);
        if (cancelled) return;
        setMonsters(monstersResult.monsters);
        setDungeonBosses(dungeonBossesResult.dungeonBosses);
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

  return (
    <main className="min-h-screen bg-black p-6 text-stone-100">
      <div className="mx-auto flex max-w-5xl flex-col gap-4">
        <div className="flex items-center justify-between border border-white bg-black px-4 py-2">
          <span className="font-bold">Monster Admin</span>
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
      </div>
    </main>
  );
}
