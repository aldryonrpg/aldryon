import { z } from "zod";
import {
  AvailableAttackSchema,
  BattleMonsterSchema,
  BattleOutcomeSchema,
  BattleStatusSchema,
  MonsterStatusSchema,
} from "./battle";

// --- POST /dungeon/start ---

export const StartDungeonResponseSchema = z.object({
  monster: BattleMonsterSchema.nullable(),
  message: z.string().nullable(),
  playerStatus: BattleStatusSchema.nullable(),
  monsterStatus: MonsterStatusSchema.nullable(),
  availableAttacks: z.array(AvailableAttackSchema),
  ambushOccurred: z.boolean(),
  outcome: BattleOutcomeSchema.nullable(),
});
export type StartDungeonResponse = z.infer<typeof StartDungeonResponseSchema>;

// --- POST /dungeon/continue (loot-system follow-up) ---
// Same shape as starting a run — advances to the next step or reveals the
// boss, as a fresh fight each time.
export const ContinueDungeonResponseSchema = StartDungeonResponseSchema;
export type ContinueDungeonResponse = z.infer<typeof ContinueDungeonResponseSchema>;

// --- POST /dungeon/exit (loot-system follow-up) ---

export const ExitDungeonRunResponseSchema = z.object({});
export type ExitDungeonRunResponse = z.infer<typeof ExitDungeonRunResponseSchema>;

// --- GET /dungeon/leaderboard ---

export const DungeonLeaderboardEntrySchema = z.object({
  playerName: z.string().nullable(),
  kills: z.number(),
  lastKillAt: z.string().nullable(),
});
export type DungeonLeaderboardEntryDto = z.infer<typeof DungeonLeaderboardEntrySchema>;

export const DungeonLeaderboardResponseSchema = z.array(DungeonLeaderboardEntrySchema);
export type DungeonLeaderboardResponse = z.infer<typeof DungeonLeaderboardResponseSchema>;
