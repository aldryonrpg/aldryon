import { z } from "zod";
import {
  AvailableAttackSchema,
  BattleMonsterSchema,
  BattleOutcomeSchema,
  BattleStatusSchema,
} from "./battle";

// --- POST /dungeon/start ---

export const StartDungeonResponseSchema = z.object({
  monster: BattleMonsterSchema.nullable(),
  message: z.string().nullable(),
  playerStatus: BattleStatusSchema.nullable(),
  monsterStatus: BattleStatusSchema.nullable(),
  availableAttacks: z.array(AvailableAttackSchema),
  ambushOccurred: z.boolean(),
  outcome: BattleOutcomeSchema.nullable(),
});
export type StartDungeonResponse = z.infer<typeof StartDungeonResponseSchema>;

// --- GET /dungeon/leaderboard ---

export const DungeonLeaderboardEntrySchema = z.object({
  playerName: z.string().nullable(),
  kills: z.number(),
  lastKillAt: z.string().nullable(),
});
export type DungeonLeaderboardEntryDto = z.infer<typeof DungeonLeaderboardEntrySchema>;

export const DungeonLeaderboardResponseSchema = z.array(DungeonLeaderboardEntrySchema);
export type DungeonLeaderboardResponse = z.infer<typeof DungeonLeaderboardResponseSchema>;
