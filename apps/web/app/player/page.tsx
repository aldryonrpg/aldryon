"use client";

import type { AttributeKeyDto, PlayerProfileResponse } from "@aldryon/dtos";
import Link from "next/link";
import { useEffect, useState } from "react";
import { BagPanel } from "@/components/battle/BagPanel";
import { EquipmentPanel } from "@/components/battle/EquipmentPanel";
import {
  allocateAttributePoints,
  equipItem,
  getPlayerProfile,
  unequipItem,
  updatePlayerName,
} from "@/lib/api";
import { loadRarityColors } from "@/lib/rarityColors";

const PLAYER_NAME_PATTERN = /^[A-Za-z0-9]{5,40}$/;

const ROWS: { label: string; key: AttributeKeyDto }[] = [
  { label: "Agility", key: "agility" },
  { label: "Strength", key: "strength" },
  { label: "Intelligence", key: "intelligence" },
  { label: "Dexterity", key: "dexterity" },
  { label: "Luck", key: "luck" },
  { label: "Vitality", key: "vitality" },
];

export default function PlayerSheet() {
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<PlayerProfileResponse | null>(null);
  const [staged, setStaged] = useState<Partial<Record<AttributeKeyDto, number>>>({});
  const [saving, setSaving] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nameInput, setNameInput] = useState("");
  const [savingName, setSavingName] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.all([getPlayerProfile(), loadRarityColors()])
      .then(([result]) => {
        if (!cancelled) {
          setProfile(result);
          setNameInput(result.playerName ?? "");
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load profile");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const stagedTotal = Object.values(staged).reduce((sum, value) => sum + (value ?? 0), 0);
  const remaining = (profile?.attributePoints ?? 0) - stagedTotal;

  function handleStage(key: AttributeKeyDto) {
    if (remaining <= 0) return;
    setStaged((prev) => ({ ...prev, [key]: (prev[key] ?? 0) + 1 }));
  }

  function handleReset() {
    setStaged({});
  }

  async function handleSave() {
    if (!profile || stagedTotal === 0) return;
    setSaving(true);
    setError(null);
    try {
      const result = await allocateAttributePoints(staged);
      setProfile({
        ...profile,
        attributes: result.attributes,
        attributePoints: result.attributePoints,
      });
      setStaged({});
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to allocate points");
    } finally {
      setSaving(false);
    }
  }

  async function refreshProfile() {
    setProfile(await getPlayerProfile());
  }

  async function handleEquip(playerItemId: string) {
    setActionLoading(true);
    setError(null);
    try {
      await equipItem(playerItemId);
      await refreshProfile();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to equip");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleUnequip(playerItemId: string) {
    setActionLoading(true);
    setError(null);
    try {
      await unequipItem(playerItemId);
      await refreshProfile();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to unequip");
    } finally {
      setActionLoading(false);
    }
  }

  function handleUse() {
    setError("Consumables can only be used during battle.");
  }

  async function handleSaveName() {
    if (!profile || !PLAYER_NAME_PATTERN.test(nameInput)) return;
    setSavingName(true);
    setError(null);
    try {
      const result = await updatePlayerName(nameInput);
      setProfile({ ...profile, playerName: result.playerName });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to set player name");
    } finally {
      setSavingName(false);
    }
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-black text-stone-100">
        Loading...
      </main>
    );
  }

  if (!profile) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-black text-stone-100">
        <p>{error ?? "Failed to load your profile."}</p>
        <Link href="/" className="border border-white px-4 py-2 hover:bg-stone-800">
          Return to Map
        </Link>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black p-6 text-stone-100">
      <div className="mx-auto flex max-w-3xl flex-col gap-4">
        <div className="flex items-center justify-between border border-white bg-black px-4 py-2">
          <span className="font-bold">Player Sheet</span>
          <Link href="/" className="border border-white px-3 py-1 text-sm hover:bg-stone-800">
            Return to Map
          </Link>
        </div>

        <div className="flex items-center justify-between border border-white bg-black px-4 py-2 text-sm">
          <span>Level {profile.level}</span>
          <span>XP: {profile.xp}</span>
          <span>Pending points: {remaining}</span>
        </div>

        <div className="flex items-center gap-3 border border-white bg-black px-4 py-2 text-sm">
          <span className="text-stone-400">Player Name</span>
          <input
            type="text"
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            placeholder="5-40 letters/numbers"
            disabled={savingName}
            className="flex-1 border border-white bg-black px-2 py-1 text-stone-100 disabled:cursor-not-allowed disabled:opacity-50"
          />
          <button
            type="button"
            onClick={handleSaveName}
            disabled={savingName || !PLAYER_NAME_PATTERN.test(nameInput)}
            className="border border-white bg-white px-3 py-1 font-medium text-black hover:enabled:bg-stone-200 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {savingName ? "Saving..." : "Set Name"}
          </button>
        </div>

        {error && <p className="text-sm text-red-400">{error}</p>}

        <div className="flex flex-wrap items-start gap-6">
          <div className="border border-white bg-black">
            <div className="grid grid-cols-3 border-b border-white text-xs text-stone-400">
              <div className="border-r border-white px-2 py-1">Attribute</div>
              <div className="border-r border-white px-2 py-1">Value</div>
              <div className="px-2 py-1">Add</div>
            </div>
            {ROWS.map((row) => {
              const base = profile.attributes[row.key];
              const add = staged[row.key] ?? 0;
              return (
                <div
                  key={row.key}
                  className="grid grid-cols-3 border-b border-white last:border-b-0"
                >
                  <div className="border-r border-white px-2 py-1">{row.label}</div>
                  <div className="border-r border-white px-2 py-1">
                    {base}
                    {add > 0 && <span className="text-green-500"> (+{add})</span>}
                  </div>
                  <button
                    type="button"
                    disabled={saving || remaining <= 0}
                    onClick={() => handleStage(row.key)}
                    className="px-2 py-1 text-center hover:bg-stone-800 disabled:cursor-not-allowed disabled:opacity-30"
                  >
                    +1
                  </button>
                </div>
              );
            })}
          </div>

          <EquipmentPanel
            equipped={profile.equipped}
            onUnequip={handleUnequip}
            disabled={actionLoading}
          />

          <BagPanel
            bag={profile.bag}
            onUse={handleUse}
            onEquip={handleEquip}
            disabled={actionLoading}
          />
        </div>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || stagedTotal === 0}
            className="border border-white bg-white px-4 py-2 font-medium text-black hover:enabled:bg-stone-200 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save"}
          </button>
          <button
            type="button"
            onClick={handleReset}
            disabled={saving || stagedTotal === 0}
            className="border border-white px-4 py-2 hover:enabled:bg-stone-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Reset
          </button>
        </div>
      </div>
    </main>
  );
}
