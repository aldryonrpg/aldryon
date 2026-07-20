import type { EquipmentSlot, Item, ItemRarity } from "@/domain/item/Item";
import { normalBagCapacity } from "@/domain/player/Bag";
import { computeSetBonus } from "@/domain/player/equipmentSetBonus";
import type { EquipmentPosition } from "@/domain/player/PlayerItem";
import { type AttributeValues, sumAttributeBonuses } from "@/domain/shared/Attributes";
import type { DungeonSlayerRankingRepository } from "@/usecase/dungeon/DungeonSlayerRankingRepository";
import type { ItemRepository } from "@/usecase/item/ItemRepository";
import type { PlayerItemRepository } from "@/usecase/player/PlayerItemRepository";
import type { PlayerRepository } from "@/usecase/player/PlayerRepository";

export interface GetPlayerProfileInput {
  playerId: string;
}

export interface EquippedItemOutput {
  playerItemId: string;
  itemId: string;
  name: string;
  rarity: ItemRarity;
  setName: string | null;
  attributeBonuses: AttributeValues;
}

export type EquippedItemsOutput = Record<EquipmentPosition, EquippedItemOutput | null>;

export interface BagItemOutput {
  id: string;
  itemId: string;
  name: string;
  quantity: number;
  slot: EquipmentSlot | null;
  rarity: ItemRarity;
  setName: string | null;
  attributeBonuses: AttributeValues;
  /** The catalog's per-unit value — doubles as both the store's buy price
   * and (Store-only) sell price. */
  value: number;
  /** True for Bandage/Antidote/the POT variants — the client uses this to
   * group the Bag UI into Permanent vs Normal slots. */
  isPermanent: boolean;
}

export interface DungeonRunStatusOutput {
  tier: 1 | 2 | 3;
  step: number;
  totalSteps: number;
}

export interface GetPlayerProfileOutput {
  playerName: string | null;
  gold: number;
  level: number;
  xp: number;
  lastDeathAt: string | null;
  attributePoints: number;
  attributes: AttributeValues;
  /** Combined equipped-item + full-set-completion bonus per attribute
   * (equipment-sets/naming follow-up) — always present, 0 where nothing
   * applies. `attributes[key] + attributeBonuses[key]` is the effective
   * total shown on the Battle Screen. */
  attributeBonuses: AttributeValues;
  dungeonSlayerKills: number;
  dungeonSlayerLastKillAt: string | null;
  dungeonRun: DungeonRunStatusOutput | null;
  equipped: EquippedItemsOutput;
  bag: BagItemOutput[];
  /** Flat per-attribute bonus a complete 6-piece equipment set grants
   * (env-configurable, `SET_ATTRIBUTE_BONUS`) — surfaced so the client
   * can render "+N" set-completion messaging without hardcoding the value. */
  setAttributeBonus: number;
  /** The Normal Slots capacity (20, or 25 for VIP) — surfaced so the client
   * can render "X/Y Slots" without duplicating the VIP capacity rule. Only
   * covers Normal Slots; Permanent Slots (Bandage/Antidote/POTs) have their
   * own separate caps (see domain/player/Bag.ts). */
  normalSlotCapacity: number;
}

/**
 * GET /player — the authenticated player's full profile: attributes,
 * equipped items (incl. the Bracelet/Ring slot), bag contents, and Dungeon
 * Slayer standing (plan3 §4b). Closest existing template:
 * usecase/player/effectiveAttributes.ts's multi-repo read composition.
 */
export class GetPlayerProfileUseCase {
  constructor(
    private readonly playerRepository: PlayerRepository,
    private readonly playerItemRepository: PlayerItemRepository,
    private readonly itemRepository: ItemRepository,
    private readonly dungeonSlayerRankingRepository: DungeonSlayerRankingRepository,
    private readonly setAttributeBonus: number,
  ) {}

  async execute(input: GetPlayerProfileInput): Promise<GetPlayerProfileOutput> {
    const player = await this.playerRepository.findById(input.playerId);
    if (!player) throw new Error("Player not found");

    const playerItems = await this.playerItemRepository.findByPlayerId(player.id);
    const items = await this.itemRepository.findByIds(playerItems.map((pi) => pi.itemId));
    const itemById = new Map(items.map((item) => [item.id, item]));

    const equipped: EquippedItemsOutput = {
      helmet: null,
      body: null,
      boots: null,
      gloves: null,
      necklace: null,
      bracelet: null,
      weapon_1: null,
      weapon_2: null,
    };
    const bag: BagItemOutput[] = [];
    const equippedItems: Item[] = [];

    for (const playerItem of playerItems) {
      const item = itemById.get(playerItem.itemId);
      // A dangling itemId logs + skips, never crashes the profile read (same
      // defensive convention as drop rolls, plan2 §3c).
      if (!item) continue;

      if (playerItem.equippedSlot) {
        equipped[playerItem.equippedSlot] = {
          playerItemId: playerItem.id,
          itemId: item.id,
          name: item.name,
          rarity: item.rarity,
          setName: item.setName,
          attributeBonuses: item.attributeBonuses,
        };
        equippedItems.push(item);
      } else {
        bag.push({
          id: playerItem.id,
          itemId: item.id,
          name: item.name,
          quantity: playerItem.quantity,
          slot: item.slot,
          rarity: item.rarity,
          setName: item.setName,
          attributeBonuses: item.attributeBonuses,
          value: item.value,
          isPermanent: item.isPermanent,
        });
      }
    }

    const itemBonuses = sumAttributeBonuses(equippedItems.map((item) => item.attributeBonuses));
    const setBonus = computeSetBonus(
      equippedItems
        .filter((item) => item.slot !== null)
        .map((item) => ({ slot: item.slot as string, setName: item.setName })),
      this.setAttributeBonus,
    );
    const attributeBonuses = sumAttributeBonuses([itemBonuses, setBonus]);

    const ranking = await this.dungeonSlayerRankingRepository.findByPlayerId(player.id);
    const dungeonRun: DungeonRunStatusOutput | null =
      player.dungeonRunTier !== null &&
      player.dungeonRunStep !== null &&
      player.dungeonRunTotalSteps !== null
        ? {
            tier: player.dungeonRunTier,
            step: player.dungeonRunStep,
            totalSteps: player.dungeonRunTotalSteps,
          }
        : null;

    return {
      playerName: player.playerName,
      gold: player.gold,
      level: player.level,
      xp: player.xp,
      lastDeathAt: player.lastDeathAt?.toISOString() ?? null,
      attributePoints: player.attributePoints,
      attributes: player.getAttributes().toValues(),
      attributeBonuses,
      dungeonSlayerKills: ranking?.kills ?? 0,
      dungeonSlayerLastKillAt: ranking?.lastKillAt?.toISOString() ?? null,
      dungeonRun,
      equipped,
      bag,
      setAttributeBonus: this.setAttributeBonus,
      normalSlotCapacity: normalBagCapacity(player.isVip),
    };
  }
}
