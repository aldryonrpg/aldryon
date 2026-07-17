"use client";

import type {
  ActiveBattleResponse,
  AttackResultDto,
  AvailableAttackDto,
  ItemCatalogResponse,
  PlayerProfileResponse,
  TurnReportDto,
} from "@aldryon/dtos";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { ActionButtons } from "@/components/battle/ActionButtons";
import { AttacksPanel } from "@/components/battle/AttacksPanel";
import { AttributesPanel } from "@/components/battle/AttributesPanel";
import { BagPanel } from "@/components/battle/BagPanel";
import { BattleLog } from "@/components/battle/BattleLog";
import { EquipmentPanel } from "@/components/battle/EquipmentPanel";
import { LootScreen } from "@/components/battle/LootScreen";
import { MonsterPanel } from "@/components/battle/MonsterPanel";
import { PlayerStatusBar } from "@/components/battle/PlayerStatusBar";
import { SetBonusStatus } from "@/components/battle/SetBonusStatus";
import {
  attack,
  claimLoot,
  // Aliased: it's a plain fetch call (POST /battle/bag), not a React hook —
  // the "use" prefix just matches the domain action's name (plan2 §5c).
  useBagItem as consumeBagItem,
  continueDungeon,
  destroyBagItem,
  equipItem,
  exitDungeonRun,
  getActiveBattle,
  getItemCatalog,
  getPlayerProfile,
  rest,
  runFromBattle,
  startBattle,
  unequipItem,
} from "@/lib/api";
import { loadRarityColors } from "@/lib/rarityColors";

type MonsterView = NonNullable<ActiveBattleResponse>["monster"];
type StatusView = NonNullable<ActiveBattleResponse>["playerStatus"];
type MonsterStatusView = NonNullable<ActiveBattleResponse>["monsterStatus"];
type Outcome = "ongoing" | "won" | "lost" | "fled" | null;

function describeAttack(label: string, result: AttackResultDto): string {
  const outcome = result.hit ? `${result.damage} damage` : "missed";
  const effect = result.effectApplied ? ` (${result.effectApplied})` : "";
  return `${label} used ${result.attackName}: ${outcome}${effect}`;
}

export default function BattlePage() {
  const router = useRouter();
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [player, setPlayer] = useState<PlayerProfileResponse | null>(null);
  const [itemCatalog, setItemCatalog] = useState<ItemCatalogResponse>([]);
  const [monster, setMonster] = useState<MonsterView | null>(null);
  const [playerStatus, setPlayerStatus] = useState<StatusView | null>(null);
  const [monsterStatus, setMonsterStatus] = useState<MonsterStatusView | null>(null);
  const [availableAttacks, setAvailableAttacks] = useState<AvailableAttackDto[]>([]);
  // The full battle log for this page visit — every turn's attacks and
  // messages append here (never replaced), so the player can scroll back.
  const [logLines, setLogLines] = useState<string[]>([]);
  const [outcome, setOutcome] = useState<Outcome>(null);
  const [lootOffer, setLootOffer] = useState<string[] | null>(null);
  // Set when Continue rolls an empty encounter (wild miss) — distinct from
  // the very first "no battle in progress" load, which never shows
  // Continue/Exit at all.
  const [emptyMessage, setEmptyMessage] = useState<string | null>(null);
  const [openPanel, setOpenPanel] = useState<"attacks" | "bag" | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const itemDetailsById = new Map(
    itemCatalog.map((item) => [
      item.id,
      {
        name: item.name,
        rarity: item.rarity,
        setName: item.setName,
        attributeBonuses: item.attributeBonuses,
      },
    ]),
  );

  const refreshPlayer = useCallback(async () => {
    setPlayer(await getPlayerProfile());
  }, []);

  const refreshBattle = useCallback(async () => {
    const active = await getActiveBattle();
    if (!active) return;
    setMonster(active.monster);
    setPlayerStatus(active.playerStatus);
    setMonsterStatus(active.monsterStatus);
    setAvailableAttacks(active.availableAttacks);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [active, profile, items] = await Promise.all([
          getActiveBattle(),
          getPlayerProfile(),
          getItemCatalog(),
          loadRarityColors(),
        ]);
        if (cancelled) return;
        setPlayer(profile);
        setItemCatalog(items);
        if (active) {
          setMonster(active.monster);
          setPlayerStatus(active.playerStatus);
          setMonsterStatus(active.monsterStatus);
          setAvailableAttacks(active.availableAttacks);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load");
      } finally {
        if (!cancelled) setLoadingInitial(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleTurnResult(reportPromise: Promise<TurnReportDto>) {
    setActionLoading(true);
    setError(null);
    try {
      const report = await reportPromise;
      setPlayerStatus(report.playerStatus);
      setMonsterStatus(report.monsterStatus);
      setMonster((prev) => (prev ? { ...prev, attributes: report.monsterAttributes } : prev));
      const newLines: string[] = [];
      if (report.playerAttack) newLines.push(describeAttack("You", report.playerAttack));
      if (report.monsterAttack) newLines.push(describeAttack("The monster", report.monsterAttack));
      newLines.push(...report.messages);
      setLogLines((prev) => [...prev, ...newLines]);
      setOutcome(report.outcome);
      setOpenPanel(null);
      if (report.lootOffer && report.lootOffer.length > 0) {
        setLootOffer(report.lootOffer);
      }
      if (report.outcome === "ongoing") {
        await refreshBattle();
      } else {
        // won/lost/fled: XP/level/attributePoints/bag/dungeon-run may have changed.
        await refreshPlayer();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleClaim(itemId: string) {
    setActionLoading(true);
    setError(null);
    try {
      await claimLoot([itemId]);
      setLootOffer((prev) => (prev ? prev.filter((id) => id !== itemId) : prev));
      await refreshPlayer();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to claim item");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleDestroy(playerItemId: string) {
    setActionLoading(true);
    setError(null);
    try {
      await destroyBagItem(playerItemId);
      await refreshPlayer();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to destroy item");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleContinue() {
    setActionLoading(true);
    setError(null);
    try {
      const isDungeonRun = player?.dungeonRun != null;
      const response = isDungeonRun ? await continueDungeon() : await startBattle("forest");

      setLootOffer(null);
      const message = response.message;
      if (message) setLogLines((prev) => [...prev, message]);
      setAvailableAttacks(response.availableAttacks);

      if (response.monster && response.playerStatus && response.monsterStatus) {
        setMonster(response.monster);
        setPlayerStatus(response.playerStatus);
        setMonsterStatus(response.monsterStatus);
        setOutcome("ongoing");
        setEmptyMessage(null);
      } else {
        setMonster(null);
        setOutcome(null);
        setEmptyMessage(response.message ?? "You found nothing.");
      }
      await refreshPlayer();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to continue");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleExit() {
    setActionLoading(true);
    setError(null);
    try {
      if (player?.dungeonRun != null) {
        await exitDungeonRun();
      }
      router.push("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to exit");
      setActionLoading(false);
    }
  }

  async function handleUnequip(playerItemId: string) {
    setActionLoading(true);
    setError(null);
    try {
      await unequipItem(playerItemId);
      await refreshPlayer();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to unequip");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleEquip(playerItemId: string) {
    setActionLoading(true);
    setError(null);
    try {
      await equipItem(playerItemId);
      await refreshPlayer();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to equip");
    } finally {
      setActionLoading(false);
    }
  }

  if (loadingInitial) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-black text-stone-100">
        Loading...
      </main>
    );
  }

  if (!player) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-black text-stone-100">
        <p>{error ?? "Failed to load your profile."}</p>
        <Link href="/" className="border border-white px-4 py-2 hover:bg-stone-800">
          Return to Map
        </Link>
      </main>
    );
  }

  // A Continue that rolled an empty encounter — no monster, but the
  // Continue/Exit choice is still offered rather than dead-ending.
  if (emptyMessage !== null) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-black p-6 text-stone-100">
        <p className="max-w-md text-center">{emptyMessage}</p>
        {error && <p className="text-sm text-red-400">{error}</p>}
        <div className="flex gap-4">
          <button
            type="button"
            onClick={handleContinue}
            disabled={actionLoading}
            className="border border-white bg-white px-6 py-2 font-medium text-black hover:enabled:bg-stone-200 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Continue
          </button>
          <button
            type="button"
            onClick={handleExit}
            disabled={actionLoading}
            className="border border-white px-6 py-2 font-medium hover:enabled:bg-stone-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Exit
          </button>
        </div>
      </main>
    );
  }

  if (!monster || !playerStatus || !monsterStatus) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-black text-stone-100">
        <p>No battle in progress.</p>
        <Link href="/" className="border border-white px-4 py-2 hover:bg-stone-800">
          Return to Map
        </Link>
      </main>
    );
  }

  const battleOver = outcome !== null && outcome !== "ongoing";

  return (
    <main className="min-h-screen bg-black p-6 text-stone-100">
      <div className="mx-auto flex max-w-5xl flex-col gap-4">
        <MonsterPanel
          name={monster.name}
          monsterImage={monster.monsterImage}
          currentHp={monsterStatus.currentHp}
          maxHp={monsterStatus.maxHp}
          attributes={monster.attributes}
        />

        <p className="border border-white bg-black p-3 text-sm text-stone-400 italic">
          {monster.description}
        </p>

        <PlayerStatusBar
          currentHp={playerStatus.currentHp}
          maxHp={playerStatus.maxHp}
          currentStamina={playerStatus.currentStamina}
          maxStamina={playerStatus.maxStamina}
        />

        <BattleLog lines={logLines} />

        {error && <p className="text-sm text-red-400">{error}</p>}

        {outcome === "won" ? (
          <div className="flex justify-center">
            <LootScreen
              bag={player.bag}
              lootOfferIds={lootOffer ?? []}
              itemDetailsById={itemDetailsById}
              busy={actionLoading}
              onDestroy={handleDestroy}
              onClaim={handleClaim}
              onContinue={handleContinue}
              onExit={handleExit}
              continueLabel={player.dungeonRun != null ? "Continue" : "Continue"}
            />
          </div>
        ) : (
          <div className="flex flex-wrap items-start justify-between gap-6">
            <AttributesPanel
              attributes={player.attributes}
              attributeBonuses={player.attributeBonuses}
            />
            <div className="flex flex-col gap-1">
              <EquipmentPanel
                equipped={player.equipped}
                onUnequip={handleUnequip}
                disabled={actionLoading}
              />
              <SetBonusStatus
                equipped={player.equipped}
                setAttributeBonus={player.setAttributeBonus}
              />
            </div>
            <div className="flex flex-col items-center gap-2">
              {battleOver ? (
                <div className="flex flex-col items-center gap-3 border border-white bg-black p-4">
                  <p className="font-bold">
                    {outcome === "lost" && "You died..."}
                    {outcome === "fled" && "You fled the battle."}
                  </p>
                  <Link href="/" className="border border-white px-4 py-2 hover:bg-stone-800">
                    Return to Map
                  </Link>
                </div>
              ) : (
                <>
                  <ActionButtons
                    openPanel={openPanel}
                    disabled={actionLoading}
                    onAttackClick={() => setOpenPanel(openPanel === "attacks" ? null : "attacks")}
                    onBagClick={() => setOpenPanel(openPanel === "bag" ? null : "bag")}
                    onRest={() => handleTurnResult(rest())}
                    onRun={() => handleTurnResult(runFromBattle())}
                  />
                  {openPanel === "attacks" && (
                    <AttacksPanel
                      attacks={availableAttacks}
                      onSelect={(name) => handleTurnResult(attack(name))}
                      disabled={actionLoading}
                    />
                  )}
                  {openPanel === "bag" && (
                    <BagPanel
                      bag={player.bag}
                      onUse={(id) => handleTurnResult(consumeBagItem(id))}
                      onEquip={handleEquip}
                      disabled={actionLoading}
                    />
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
