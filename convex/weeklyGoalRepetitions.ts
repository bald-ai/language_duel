/**
 * Weekly Goal Repetitions API - public Convex wiring for spaced-repetition flows.
 */

import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { getAuthenticatedUserOrNull } from "./helpers/auth";
import {
  EMPTY_BOARD,
  loadLaunchPreviewForUser,
  loadRepetitionBoardForUser,
} from "./weeklyGoalRepetitions/board";
import { createRepetitionChallengeForCurrentUser } from "./weeklyGoalRepetitions/challengeCreation";
import {
  completeRepetitionSoloPracticeForCurrentUser,
  recordRepetitionSoloMasteryForCurrentUser,
  startRepetitionSoloPracticeForCurrentUser,
} from "./weeklyGoalRepetitions/soloPractice";
import { ensureRepetitionRecordsForCompletedGoal } from "./weeklyGoalRepetitions/rules";
import { duelModeValidator } from "./schema";

export { completeRepetitionDuel } from "./weeklyGoalRepetitions/duelCompletion";
export { ensureRepetitionRecordsForCompletedGoal };

export const getBoard = query({
  args: {},
  handler: async (ctx) => {
    const auth = await getAuthenticatedUserOrNull(ctx);
    if (!auth) return EMPTY_BOARD;

    return await loadRepetitionBoardForUser(ctx, auth.user._id);
  },
});

export const getLaunchPreview = query({
  args: { weeklyGoalId: v.id("weeklyGoals") },
  handler: async (ctx, { weeklyGoalId }) => {
    const auth = await getAuthenticatedUserOrNull(ctx);
    if (!auth) return null;

    return await loadLaunchPreviewForUser(ctx, auth.user._id, weeklyGoalId);
  },
});

export const createRepetitionChallenge = mutation({
  args: { weeklyGoalId: v.id("weeklyGoals"), duelMode: duelModeValidator },
  handler: async (ctx, { weeklyGoalId, duelMode }) => {
    return await createRepetitionChallengeForCurrentUser(ctx, weeklyGoalId, duelMode);
  },
});

export const startRepetitionSoloPractice = mutation({
  args: { weeklyGoalId: v.id("weeklyGoals") },
  handler: async (ctx, { weeklyGoalId }) => {
    return await startRepetitionSoloPracticeForCurrentUser(ctx, weeklyGoalId);
  },
});

export const completeRepetitionSoloPractice = mutation({
  args: {
    soloPracticeSessionId: v.id("soloPracticeSessions"),
    completedStep: v.number(),
  },
  handler: async (ctx, args) => {
    return await completeRepetitionSoloPracticeForCurrentUser(ctx, args);
  },
});

export const recordRepetitionSoloMastery = mutation({
  args: {
    soloPracticeSessionId: v.id("soloPracticeSessions"),
    wordIndex: v.number(),
  },
  handler: async (ctx, args) => {
    return await recordRepetitionSoloMasteryForCurrentUser(ctx, args);
  },
});
