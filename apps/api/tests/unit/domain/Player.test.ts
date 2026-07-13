import { describe, expect, it } from "bun:test";
import { Player } from "@/domain/player/Player";

const BASE_PROPS = {
  id: "player-1",
  userId: "user-1",
  gold: 0,
  level: 1,
  xp: 0,
  attributePoints: 10,
  attributes: { force: 1, dexterity: 1, agility: 1, intelligence: 1, vitality: 1, luck: 1 },
  lastDeathAt: null,
  lastRunAt: null,
  pendingLoot: [],
};

describe("Player playerName", () => {
  it("starts null until the player sets one", () => {
    const player = Player.create({ ...BASE_PROPS, playerName: null });
    expect(player.playerName).toBeNull();
  });

  it("accepts a 5-40 alphanumeric name", () => {
    const player = Player.create({ ...BASE_PROPS, playerName: "DragonSlayer99" });
    expect(player.playerName).toBe("DragonSlayer99");
  });

  it("rejects a name shorter than 5 characters", () => {
    expect(() => Player.create({ ...BASE_PROPS, playerName: "Ab1" })).toThrow();
  });

  it("rejects a name with non-alphanumeric characters", () => {
    expect(() => Player.create({ ...BASE_PROPS, playerName: "Dragon_Slayer" })).toThrow();
  });
});
