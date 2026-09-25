import { ConvexError } from "convex/values";
import type { MutationCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import { getAuthenticatedUser } from "../helpers/auth";
import { buildSoloPracticeSession } from "../helpers/sessionCreation";
import {
  advanceUserIfReady,
  loadReadyRepetitionContext,
} from "./attemptMutations";

export async function startRepetitionSoloPracticeForCurrentUser(
  ctx: MutationCtx,
  weeklyGoalId: Id<"weeklyGoals">,
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
    }),
  );
}

export async function completeRepetitionSoloPracticeForCurrentUser(
  ctx: MutationCtx,
  args: {
    soloPracticeSessionId: Id<"soloPracticeSessions">;
    completedStep: number;
  },
): Promise<{ advanced: boolean }> {
  const { user } = await getAuthenticatedUser(ctx);
  const now = Date.now();
  const session = await ctx.db.get(args.soloPracticeSessionId);
  if (
    !isOwnedRepetitionSession(session, user._id) ||
    typeof session.spacedRepetitionStep !== "number"
  ) {
    console.warn(
      "Skipping spaced repetition solo completion: session is not a matching SR session.",
      { soloPracticeSessionId: args.soloPracticeSessionId },
    );
    return { advanced: false };
  }
  if (session.status === "completed") {
    console.warn(
      "Skipping spaced repetition solo completion: session is already completed.",
      { soloPracticeSessionId: args.soloPracticeSessionId },
    );
    return { advanced: false };
  }

  if (!canCompleteSoloRepetition(session, args.completedStep))
    return { advanced: false };

  const goal = await ctx.db.get(session.weeklyGoalId);
  if (!goal || goal.status !== "completed") {
    console.warn(
      "Skipping spaced repetition solo completion: goal is missing or not completed.",
      {
        soloPracticeSessionId: args.soloPracticeSessionId,
        weeklyGoalId: session.weeklyGoalId,
      },
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
    itemIndex: number;
  },
): Promise<{ masteredCount: number; totalCount: number }> {
  const { user } = await getAuthenticatedUser(ctx);
  const session = await ctx.db.get(args.soloPracticeSessionId);
  if (
    !isOwnedRepetitionSession(session, user._id) ||
    session.status === "completed"
  ) {
    throw new ConvexError({
      code: "INVALID_STATE",
      message: "Spaced repetition solo practice is not active.",
    });
  }

  validateMasteryIndex(args.itemIndex, session.sessionItems.length);

  const masteredItemIndices = Array.from(
    new Set([...(session.masteredItemIndices ?? []), args.itemIndex]),
  ).sort((a, b) => a - b);
  const now = Date.now();

  await ctx.db.patch(args.soloPracticeSessionId, {
    masteredItemIndices,
    progressUpdatedAt: now,
  });

  if (masteredItemIndices.length === session.sessionItems.length) {
    await completeMasteredRepetition(ctx, session, now);
  }

  return {
    masteredCount: masteredItemIndices.length,
    totalCount: session.sessionItems.length,
  };
}

/** Completion uses persisted mastery and the session's assigned step. */
function canCompleteSoloRepetition(
  session: Doc<"soloPracticeSessions">,
  completedStep: number,
): boolean {
  const itemCount = session.sessionItems.length;
  const masteredItemIndices = new Set(session.masteredItemIndices ?? []);
  const hasServerOwnedCompletion = session.sessionItems.every((_, index) =>
    masteredItemIndices.has(index),
  );
  if (!hasServerOwnedCompletion) {
    console.warn(
      "Skipping spaced repetition solo completion: server progress is incomplete.",
      {
        soloPracticeSessionId: session._id,
        masteredCount: masteredItemIndices.size,
        itemCount,
      },
    );
    return false;
  }

  if (
    !Number.isInteger(completedStep) ||
    completedStep !== session.spacedRepetitionStep
  ) {
    console.warn(
      "Skipping spaced repetition solo completion: completed step mismatch.",
      {
        soloPracticeSessionId: session._id,
        completedStep: completedStep,
        expectedStep: session.spacedRepetitionStep,
      },
    );
    return false;
  }

  return true;
}

function validateMasteryIndex(itemIndex: number, itemCount: number) {
  if (!Number.isInteger(itemIndex) || itemIndex < 0 || itemIndex >= itemCount) {
    throw new ConvexError({
      code: "INVALID_INPUT",
      message: "Invalid solo practice item index.",
    });
  }
}

async function completeMasteredRepetition(
  ctx: MutationCtx,
  session: Doc<"soloPracticeSessions">,
  now: number,
) {
  const goal = await ctx.db.get(session.weeklyGoalId);
  if (
    goal?.status === "completed" &&
    typeof session.spacedRepetitionStep === "number"
  ) {
    await advanceUserIfReady({
      ctx,
      goal,
      userId: session.userId,
      completedVia: "solo_practice",
      soloPracticeSessionId: session._id,
      expectedStep: session.spacedRepetitionStep,
      now,
    });
    await ctx.db.patch(session._id, {
      status: "completed",
      completedAt: now,
    });
  }
}

function isOwnedRepetitionSession(
  session: Doc<"soloPracticeSessions"> | null,
  userId: Id<"users">,
): session is Doc<"soloPracticeSessions"> {
  return (
    !!session &&
    session.sourceType === "spaced_repetition" &&
    session.userId === userId
  );
}
