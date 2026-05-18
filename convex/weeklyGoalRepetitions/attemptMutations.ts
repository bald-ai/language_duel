import { ConvexError } from "convex/values";
import type { MutationCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import {
  getSpacedRepetitionBucket,
  getSpacedRepetitionCurrentStep,
  getSpacedRepetitionDueAt,
  isSpacedRepetitionDone,
} from "../../lib/spacedRepetition";
import type {
  CtxWithDb,
  ReadyRepetitionContext,
  SpacedRepetitionCompletion,
} from "./types";
import { loadSpacedRepetitionSnapshotContent } from "./contentLoading";
import {
  getRepetitionRecord,
  isGoalParticipant,
} from "./rules";

export async function loadReadyRepetitionContext(args: {
  ctx: CtxWithDb;
  weeklyGoalId: Id<"weeklyGoals">;
  userId: Id<"users">;
  now: number;
}): Promise<ReadyRepetitionContext> {
  const goal = await args.ctx.db.get(args.weeklyGoalId);
  if (!goal || goal.status !== "completed") {
    throw new ConvexError({ code: "INVALID_STATE", message: "Spaced repetition is only available for completed goals." });
  }
  if (typeof goal.completedAt !== "number") {
    throw new ConvexError({ code: "INTERNAL_ERROR", message: "Spaced repetition is not available for this completed goal." });
  }
  if (!isGoalParticipant(goal, args.userId)) {
    throw new ConvexError({ code: "NOT_AUTHORIZED", message: "Not authorized" });
  }

  const record = await getRepetitionRecord(args.ctx, args.weeklyGoalId, args.userId);
  if (!record) {
    throw new ConvexError({ code: "INVALID_STATE", message: "Spaced repetition is not ready yet. Refresh the board and try again." });
  }
  const bucket = getSpacedRepetitionBucket(
    {
      completedSteps: record.completedSteps,
      goalCompletedAt: goal.completedAt,
    },
    args.now
  );
  if (bucket !== "ready") {
    throw new ConvexError({ code: "INVALID_STATE", message: "This repetition is not ready yet." });
  }

  const content = await loadSpacedRepetitionSnapshotContent(args.ctx, goal);
  if (!content.ok) {
    throw new ConvexError({ code: "INTERNAL_ERROR", message: content.message });
  }

  const step = getSpacedRepetitionCurrentStep(record.completedSteps);
  if (step === null) {
    throw new ConvexError({ code: "INVALID_STATE", message: "This repetition is already complete." });
  }

  return { goal, record, bucket, content, step };
}

export async function advanceUserIfReady(args: {
  ctx: MutationCtx;
  goal: Doc<"weeklyGoals">;
  userId: Id<"users">;
  now: number;
  completedVia: SpacedRepetitionCompletion;
  duelId?: Id<"duels">;
  soloPracticeSessionId?: Id<"soloPracticeSessions">;
  expectedStep?: number;
}) {
  const record = await getRepetitionRecord(args.ctx, args.goal._id, args.userId);
  if (!record || isSpacedRepetitionDone(record.completedSteps)) {
    console.warn("Skipping spaced repetition advance: record missing or already done.", {
      weeklyGoalId: args.goal._id,
      userId: args.userId,
    });
    return false;
  }

  if (typeof args.goal.completedAt !== "number") {
    console.warn("Skipping spaced repetition advance: completed goal is missing completedAt.", {
      weeklyGoalId: args.goal._id,
      userId: args.userId,
    });
    return false;
  }

  const dueAt = getSpacedRepetitionDueAt({
    completedSteps: record.completedSteps,
    goalCompletedAt: args.goal.completedAt,
  });
  if (dueAt === null || dueAt > args.now) {
    console.warn("Skipping spaced repetition advance: repetition is not due.", {
      weeklyGoalId: args.goal._id,
      userId: args.userId,
      dueAt,
      now: args.now,
    });
    return false;
  }

  const step = getSpacedRepetitionCurrentStep(record.completedSteps);
  if (step === null || (args.expectedStep !== undefined && step !== args.expectedStep)) {
    console.warn("Skipping spaced repetition advance: step mismatch.", {
      weeklyGoalId: args.goal._id,
      userId: args.userId,
      expectedStep: args.expectedStep,
      actualStep: step,
    });
    return false;
  }

  await args.ctx.db.patch(record._id, {
    completedSteps: [
      ...record.completedSteps,
      {
        completedAt: args.now,
        completedVia: args.completedVia,
        duelId: args.duelId,
        soloPracticeSessionId: args.soloPracticeSessionId,
      },
    ],
    updatedAt: args.now,
  });

  return true;
}
