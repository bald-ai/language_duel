import { ConvexError } from "convex/values";
import type { MutationCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import { getAuthenticatedUser } from "../helpers/auth";
import { buildSoloPracticeSession } from "../helpers/sessionCreation";
import {
  advanceUserIfReady,
  loadReadyRepetitionContext,
} from "./attemptMutations";

export async function startRepetitionSoloPracticeForCurrentUser(
  ctx: MutationCtx,
  weeklyGoalId: Id<"weeklyGoals">
): Promise<Id<"soloPracticeSessions">> {
  const { user } = await getAuthenticatedUser(ctx);
  const now = Date.now();
  const { content, step } = await loadReadyRepetitionContext({
    ctx,
    weeklyGoalId,
    userId: user._id,
    now,
  });

  return await ctx.db.insert(
    "soloPracticeSessions",
    buildSoloPracticeSession({
      userId: user._id,
      sessionItems: content.sessionItems,
      sourceType: "spaced_repetition",
      weeklyGoalId,
      spacedRepetitionStep: step,
      startsInLearning: true,
      createdAt: now,
    })
  );
}

export async function completeRepetitionSoloPracticeForCurrentUser(
  ctx: MutationCtx,
  args: {
    soloPracticeSessionId: Id<"soloPracticeSessions">;
    completedStep: number;
  }
): Promise<{ advanced: boolean }> {
  const { user } = await getAuthenticatedUser(ctx);
  const now = Date.now();
  const session = await ctx.db.get(args.soloPracticeSessionId);
  if (
    !session ||
    session.sourceType !== "spaced_repetition" ||
    typeof session.spacedRepetitionStep !== "number" ||
    session.userId !== user._id
  ) {
    console.warn(
      "Skipping spaced repetition solo completion: session is not a matching SR session.",
      { soloPracticeSessionId: args.soloPracticeSessionId }
    );
    return { advanced: false };
  }
  if (session.status === "completed") {
    console.warn(
      "Skipping spaced repetition solo completion: session is already completed.",
      { soloPracticeSessionId: args.soloPracticeSessionId }
    );
    return { advanced: false };
  }

  const wordCount = session.sessionItems.length;
  const masteredWordIndices = new Set(session.masteredWordIndices ?? []);
  const hasServerOwnedCompletion = session.sessionItems.every((_, index) =>
    masteredWordIndices.has(index)
  );
  if (!hasServerOwnedCompletion) {
    console.warn(
      "Skipping spaced repetition solo completion: server progress is incomplete.",
      {
        soloPracticeSessionId: args.soloPracticeSessionId,
        masteredCount: masteredWordIndices.size,
        wordCount,
      }
    );
    return { advanced: false };
  }

  if (
    !Number.isInteger(args.completedStep) ||
    args.completedStep !== session.spacedRepetitionStep
  ) {
    console.warn(
      "Skipping spaced repetition solo completion: completed step mismatch.",
      {
        soloPracticeSessionId: args.soloPracticeSessionId,
        completedStep: args.completedStep,
        expectedStep: session.spacedRepetitionStep,
      }
    );
    return { advanced: false };
  }

  const goal = await ctx.db.get(session.weeklyGoalId);
  if (!goal || goal.status !== "completed") {
    console.warn(
      "Skipping spaced repetition solo completion: goal is missing or not completed.",
      {
        soloPracticeSessionId: args.soloPracticeSessionId,
        weeklyGoalId: session.weeklyGoalId,
      }
    );
    return { advanced: false };
  }

  const advanced = await advanceUserIfReady({
    ctx,
    goal,
    userId: user._id,
    completedVia: "solo_practice",
    soloPracticeSessionId: args.soloPracticeSessionId,
    expectedStep: session.spacedRepetitionStep,
    now,
  });

  await ctx.db.patch(args.soloPracticeSessionId, {
    status: "completed",
    completedAt: now,
  });

  return { advanced };
}

export async function recordRepetitionSoloMasteryForCurrentUser(
  ctx: MutationCtx,
  args: {
    soloPracticeSessionId: Id<"soloPracticeSessions">;
    wordIndex: number;
  }
): Promise<{ masteredCount: number; totalCount: number }> {
  const { user } = await getAuthenticatedUser(ctx);
  const session = await ctx.db.get(args.soloPracticeSessionId);
  if (
    !session ||
    session.sourceType !== "spaced_repetition" ||
    session.userId !== user._id ||
    session.status === "completed"
  ) {
    throw new ConvexError({
      code: "INVALID_STATE",
      message: "Spaced repetition solo practice is not active.",
    });
  }

  if (
    !Number.isInteger(args.wordIndex) ||
    args.wordIndex < 0 ||
    args.wordIndex >= session.sessionItems.length
  ) {
    throw new ConvexError({
      code: "INVALID_INPUT",
      message: "Invalid solo practice word index.",
    });
  }

  const masteredWordIndices = Array.from(
    new Set([...(session.masteredWordIndices ?? []), args.wordIndex])
  ).sort((a, b) => a - b);
  const now = Date.now();

  await ctx.db.patch(args.soloPracticeSessionId, {
    masteredWordIndices,
    progressUpdatedAt: now,
  });

  if (masteredWordIndices.length === session.sessionItems.length) {
    const goal = await ctx.db.get(session.weeklyGoalId);
    if (
      goal?.status === "completed" &&
      typeof session.spacedRepetitionStep === "number"
    ) {
      await advanceUserIfReady({
        ctx,
        goal,
        userId: user._id,
        completedVia: "solo_practice",
        soloPracticeSessionId: args.soloPracticeSessionId,
        expectedStep: session.spacedRepetitionStep,
        now,
      });
      await ctx.db.patch(args.soloPracticeSessionId, {
        status: "completed",
        completedAt: now,
      });
    }
  }

  return {
    masteredCount: masteredWordIndices.length,
    totalCount: session.sessionItems.length,
  };
}
