import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { getAuthenticatedUser, getAuthenticatedUserOrNull } from "./helpers/auth";
import { buildChallengeBase, buildChallengeStartState } from "./helpers/challengeCreation";
import { summarizeSessionWords } from "./helpers/sessionWords";
import { loadUsersById } from "./helpers/users";
import { listWeeklyGoalThemeSnapshots } from "./helpers/weeklyGoalSnapshots";
import { buildSessionWords } from "../lib/sessionWords";
import {
  getLegacyCompletedGoalBackfillCompletedAt,
  getSpacedRepetitionBucket,
  getSpacedRepetitionCurrentStep,
  getSpacedRepetitionDaysRemaining,
  getSpacedRepetitionDueAt,
  isSpacedRepetitionDone,
  SPACED_REPETITION_INTERVAL_DAYS,
  SPACED_REPETITION_TOTAL_STEPS,
} from "../lib/spacedRepetition";

type CtxWithDb = QueryCtx | MutationCtx;
type UserSummary = { _id: Id<"users">; nickname?: string; email: string };
type SpacedRepetitionMode = "solo" | "classic";

type LoadedSnapshotContent =
  | {
      ok: true;
      sessionWords: ReturnType<typeof buildSessionWords>;
      themeCount: number;
      wordCount: number;
      themeSummary: string;
    }
  | {
      ok: false;
      message: string;
    };

function buildDeferredSnapshotContent(goal: Doc<"weeklyGoals">): LoadedSnapshotContent {
  return {
    ok: true,
    sessionWords: [],
    themeCount: goal.themes.length,
    wordCount: 0,
    themeSummary: "",
  };
}

function toUserSummary(user: Doc<"users"> | null): UserSummary | null {
  if (!user) return null;
  return { _id: user._id, nickname: user.nickname, email: user.email };
}

function getGoalPartnerId(goal: Doc<"weeklyGoals">, userId: Id<"users">): Id<"users"> {
  return goal.creatorId === userId ? goal.partnerId : goal.creatorId;
}

function isGoalParticipant(goal: Doc<"weeklyGoals">, userId: Id<"users">): boolean {
  return goal.creatorId === userId || goal.partnerId === userId;
}

async function getRepetitionRecord(
  ctx: CtxWithDb,
  weeklyGoalId: Id<"weeklyGoals">,
  userId: Id<"users">
) {
  return await ctx.db
    .query("weeklyGoalRepetitions")
    .withIndex("by_goal_user", (q) =>
      q.eq("weeklyGoalId", weeklyGoalId).eq("userId", userId)
    )
    .unique();
}

export async function ensureRepetitionRecordsForCompletedGoal(
  ctx: MutationCtx,
  goal: Doc<"weeklyGoals">,
  completedAt: number
): Promise<void> {
  for (const userId of [goal.creatorId, goal.partnerId]) {
    const existing = await getRepetitionRecord(ctx, goal._id, userId);
    if (existing) continue;

    await ctx.db.insert("weeklyGoalRepetitions", {
      weeklyGoalId: goal._id,
      userId,
      completedSteps: [],
      createdAt: completedAt,
      updatedAt: completedAt,
    });
  }
}

async function ensureLegacyRepetitionRecordForUser(
  ctx: MutationCtx,
  goal: Doc<"weeklyGoals">,
  userId: Id<"users">,
  now: number
) {
  const existing = await getRepetitionRecord(ctx, goal._id, userId);
  if (existing) {
    if (!goal.completedAt) {
      // Legacy completed goals are intentionally backdated so their first SR step is ready immediately.
      // Remove this backfill once pre-SR completed goals no longer need support.
      await ctx.db.patch(goal._id, {
        completedAt: getLegacyCompletedGoalBackfillCompletedAt(now),
      });
    }
    return existing;
  }

  const completedAt =
    goal.completedAt ?? getLegacyCompletedGoalBackfillCompletedAt(now);

  if (!goal.completedAt) {
    // Legacy completed goals are intentionally backdated so their first SR step is ready immediately.
    // Remove this backfill once pre-SR completed goals no longer need support.
    await ctx.db.patch(goal._id, { completedAt });
  }

  await ensureRepetitionRecordsForCompletedGoal(ctx, { ...goal, completedAt }, completedAt);
  return await getRepetitionRecord(ctx, goal._id, userId);
}

async function loadSpacedRepetitionSnapshotContent(
  ctx: CtxWithDb,
  goal: Doc<"weeklyGoals">
): Promise<LoadedSnapshotContent> {
  const snapshots = await listWeeklyGoalThemeSnapshots(ctx, goal._id);
  const snapshotsByOriginalThemeId = new Map(
    snapshots.map((snapshot) => [String(snapshot.originalThemeId), snapshot])
  );

  for (const theme of goal.themes) {
    const snapshot = snapshotsByOriginalThemeId.get(String(theme.themeId));
    if (!snapshot) {
      return {
        ok: false,
        message: `"${theme.themeName}" snapshot is missing. Spaced repetition cannot use live theme data.`,
      };
    }
    if (snapshot.words.length === 0) {
      return {
        ok: false,
        message: `"${theme.themeName}" snapshot has no words. Spaced repetition cannot start.`,
      };
    }
  }

  const sessionThemes = goal.themes.map((theme) => {
    const snapshot = snapshotsByOriginalThemeId.get(String(theme.themeId));
    if (!snapshot) {
      throw new Error("Missing validated weekly goal snapshot");
    }
    return {
      _id: snapshot.originalThemeId,
      name: snapshot.name,
      words: snapshot.words,
    };
  });
  const sessionWords = buildSessionWords(sessionThemes);

  if (sessionWords.length === 0) {
    return {
      ok: false,
      message: "This goal snapshot has no words. Spaced repetition cannot start.",
    };
  }

  return {
    ok: true,
    sessionWords,
    themeCount: sessionThemes.length,
    wordCount: sessionWords.length,
    themeSummary: summarizeSessionWords(sessionWords),
  };
}

function buildBoardItem(args: {
  goal: Doc<"weeklyGoals">;
  record: Doc<"weeklyGoalRepetitions">;
  partner: UserSummary | null;
  content: LoadedSnapshotContent;
  now: number;
}) {
  const completedAt =
    args.goal.completedAt ?? getLegacyCompletedGoalBackfillCompletedAt(args.now);
  const dueAt = getSpacedRepetitionDueAt({
    completedSteps: args.record.completedSteps,
    goalCompletedAt: completedAt,
  });
  const bucket = getSpacedRepetitionBucket(
    {
      completedSteps: args.record.completedSteps,
      goalCompletedAt: completedAt,
    },
    args.now
  );
  const step = getSpacedRepetitionCurrentStep(args.record.completedSteps);

  return {
    weeklyGoalId: args.goal._id,
    title: args.goal.themes.length === 1
      ? args.goal.themes[0].themeName
      : `${args.goal.themes[0]?.themeName ?? "Completed goal"} + ${Math.max(0, args.goal.themes.length - 1)} more`,
    partner: args.partner,
    themeCount: args.goal.themes.length,
    wordCount: args.content.ok ? args.content.wordCount : 0,
    completedSteps: args.record.completedSteps,
    step,
    totalSteps: SPACED_REPETITION_TOTAL_STEPS,
    bucket,
    dueAt,
    daysRemaining: getSpacedRepetitionDaysRemaining(dueAt, args.now),
    ready: bucket === "ready" && args.content.ok,
    contentAvailable: args.content.ok,
    unavailableReason: args.content.ok ? undefined : args.content.message,
    completedAt,
    updatedAt: args.record.updatedAt,
  };
}

export const getBoard = query({
  args: {},
  handler: async (ctx) => {
    const auth = await getAuthenticatedUserOrNull(ctx);
    if (!auth) {
      return {
        stats: { total: 0, ready: 0, comingUp: 0, done: 0 },
        needsBackfill: false,
        all: [],
        ready: [],
        comingUp: [],
        done: [],
      };
    }

    const now = Date.now();
    const records = await ctx.db
      .query("weeklyGoalRepetitions")
      .withIndex("by_user", (q) => q.eq("userId", auth.user._id))
      .collect();

    const completedGoalsAsCreator = await ctx.db
      .query("weeklyGoals")
      .withIndex("by_creator", (q) => q.eq("creatorId", auth.user._id))
      .filter((q) => q.eq(q.field("status"), "completed"))
      .collect();
    const completedGoalsAsPartner = await ctx.db
      .query("weeklyGoals")
      .withIndex("by_partner", (q) => q.eq("partnerId", auth.user._id))
      .filter((q) => q.eq(q.field("status"), "completed"))
      .collect();

    const goalsById = new Map<Id<"weeklyGoals">, Doc<"weeklyGoals">>();
    for (const goal of [...completedGoalsAsCreator, ...completedGoalsAsPartner]) {
      goalsById.set(goal._id, goal);
    }

    const recordByGoalId = new Map(records.map((record) => [String(record.weeklyGoalId), record]));
    const items = [];
    const partnerIds = Array.from(goalsById.values()).map((goal) =>
      getGoalPartnerId(goal, auth.user._id)
    );
    const usersById = await loadUsersById(ctx, partnerIds);
    let needsBackfill = false;

    for (const goal of goalsById.values()) {
      const record = recordByGoalId.get(String(goal._id));
      if (!record) {
        needsBackfill = true;
        continue;
      }
      const bucket = getSpacedRepetitionBucket(
        {
          completedSteps: record.completedSteps,
          goalCompletedAt: goal.completedAt ?? getLegacyCompletedGoalBackfillCompletedAt(now),
        },
        now
      );
      const content =
        bucket === "ready"
          ? await loadSpacedRepetitionSnapshotContent(ctx, goal)
          : buildDeferredSnapshotContent(goal);
      items.push(
        buildBoardItem({
          goal,
          record,
          partner: toUserSummary(usersById.get(getGoalPartnerId(goal, auth.user._id)) ?? null),
          content,
          now,
        })
      );
    }

    const ready = items
      .filter((item) => item.bucket === "ready")
      .sort((a, b) => (a.dueAt ?? 0) - (b.dueAt ?? 0));
    const comingUp = items
      .filter((item) => item.bucket === "coming_up")
      .sort((a, b) => (a.dueAt ?? 0) - (b.dueAt ?? 0));
    const done = items
      .filter((item) => item.bucket === "done")
      .sort((a, b) => b.updatedAt - a.updatedAt);

    return {
      stats: {
        total: items.length,
        ready: ready.length,
        comingUp: comingUp.length,
        done: done.length,
      },
      needsBackfill,
      all: [...ready, ...comingUp, ...done],
      ready,
      comingUp,
      done,
    };
  },
});

export const lazyBackfillForCurrentUser = mutation({
  args: {},
  handler: async (ctx) => {
    const { user } = await getAuthenticatedUser(ctx);
    const now = Date.now();

    const completedGoalsAsCreator = await ctx.db
      .query("weeklyGoals")
      .withIndex("by_creator", (q) => q.eq("creatorId", user._id))
      .filter((q) => q.eq(q.field("status"), "completed"))
      .collect();
    const completedGoalsAsPartner = await ctx.db
      .query("weeklyGoals")
      .withIndex("by_partner", (q) => q.eq("partnerId", user._id))
      .filter((q) => q.eq(q.field("status"), "completed"))
      .collect();

    const seen = new Set<string>();
    let created = 0;
    for (const goal of [...completedGoalsAsCreator, ...completedGoalsAsPartner]) {
      const key = String(goal._id);
      if (seen.has(key)) continue;
      seen.add(key);

      const before = await getRepetitionRecord(ctx, goal._id, user._id);
      await ensureLegacyRepetitionRecordForUser(ctx, goal, user._id, now);
      const after = await getRepetitionRecord(ctx, goal._id, user._id);
      if (!before && after) created += 1;
    }

    return { created };
  },
});

export const getLaunchPreview = query({
  args: { weeklyGoalId: v.id("weeklyGoals") },
  handler: async (ctx, { weeklyGoalId }) => {
    const auth = await getAuthenticatedUserOrNull(ctx);
    if (!auth) return null;

    const goal = await ctx.db.get(weeklyGoalId);
    if (!goal || goal.status !== "completed" || !isGoalParticipant(goal, auth.user._id)) {
      return null;
    }

    const record = await getRepetitionRecord(ctx, weeklyGoalId, auth.user._id);
    if (!record) return null;

    const now = Date.now();
    const content = await loadSpacedRepetitionSnapshotContent(ctx, goal);
    const partner = await ctx.db.get(getGoalPartnerId(goal, auth.user._id));
    const item = buildBoardItem({
      goal,
      record,
      partner: toUserSummary(partner),
      content,
      now,
    });

    return {
      ...item,
      themeSummary: content.ok ? content.themeSummary : "",
      livesTotal: goal.themes.length + 1,
    };
  },
});

async function advanceUserIfReady(args: {
  ctx: MutationCtx;
  goal: Doc<"weeklyGoals">;
  userId: Id<"users">;
  mode: SpacedRepetitionMode;
  challengeId?: Id<"challenges">;
  expectedStep?: number;
  now: number;
}) {
  const record = await getRepetitionRecord(args.ctx, args.goal._id, args.userId);
  if (!record || isSpacedRepetitionDone(record.completedSteps)) {
    return false;
  }

  const dueAt = getSpacedRepetitionDueAt({
    completedSteps: record.completedSteps,
    goalCompletedAt: args.goal.completedAt ?? getLegacyCompletedGoalBackfillCompletedAt(args.now),
  });
  if (dueAt === null || dueAt > args.now) {
    return false;
  }

  const step = getSpacedRepetitionCurrentStep(record.completedSteps);
  if (args.expectedStep !== undefined && step !== args.expectedStep) {
    return false;
  }

  const intervalDays = SPACED_REPETITION_INTERVAL_DAYS[step - 1];
  await args.ctx.db.patch(record._id, {
    completedSteps: [
      ...record.completedSteps,
      {
        step,
        intervalDays,
        completedAt: args.now,
        mode: args.mode,
        challengeId: args.challengeId,
      },
    ],
    updatedAt: args.now,
  });
  return true;
}

export async function completeSpacedRepetitionDuel(
  ctx: MutationCtx,
  challenge: Doc<"challenges">,
  now: number
) {
  if (
    challenge.weeklyGoalChallengeType !== "spaced_repetition" ||
    !challenge.weeklyGoalId ||
    typeof challenge.spacedRepetitionStep !== "number" ||
    typeof challenge.bossLivesRemaining !== "number" ||
    challenge.bossLivesRemaining <= 0
  ) {
    return;
  }

  const goal = await ctx.db.get(challenge.weeklyGoalId);
  if (!goal || goal.status !== "completed") return;

  await advanceUserIfReady({
    ctx,
    goal,
    userId: challenge.challengerId,
    mode: "classic",
    challengeId: challenge._id,
    expectedStep: challenge.spacedRepetitionStep,
    now,
  });
  await advanceUserIfReady({
    ctx,
    goal,
    userId: challenge.opponentId,
    mode: "classic",
    challengeId: challenge._id,
    expectedStep: challenge.spacedRepetitionStep,
    now,
  });
}

export const startDuel = mutation({
  args: { weeklyGoalId: v.id("weeklyGoals") },
  handler: async (ctx, { weeklyGoalId }) => {
    const { user } = await getAuthenticatedUser(ctx);
    const now = Date.now();
    const goal = await ctx.db.get(weeklyGoalId);
    if (!goal || goal.status !== "completed") {
      throw new Error("Spaced repetition is only available for completed goals.");
    }
    if (!isGoalParticipant(goal, user._id)) {
      throw new Error("Not authorized");
    }

    const record = await getRepetitionRecord(ctx, weeklyGoalId, user._id);
    if (!record) {
      throw new Error("Spaced repetition is not ready yet. Refresh the board and try again.");
    }
    const bucket = getSpacedRepetitionBucket(
      {
        completedSteps: record.completedSteps,
        goalCompletedAt: goal.completedAt ?? getLegacyCompletedGoalBackfillCompletedAt(now),
      },
      now
    );
    if (bucket !== "ready") {
      throw new Error("This repetition is not ready yet.");
    }

    const content = await loadSpacedRepetitionSnapshotContent(ctx, goal);
    if (!content.ok) {
      throw new Error(content.message);
    }

    const step = getSpacedRepetitionCurrentStep(record.completedSteps);
    const activeAttempts = await ctx.db
      .query("challenges")
      .withIndex("by_weeklyGoalId", (q) => q.eq("weeklyGoalId", weeklyGoalId))
      .collect();
    const duplicateAttempt = activeAttempts.find(
      (challenge) =>
        challenge.weeklyGoalChallengeType === "spaced_repetition" &&
        challenge.spacedRepetitionStep === step &&
        (challenge.status === "pending" || challenge.status === "accepted")
    );
    if (duplicateAttempt) {
      throw new Error("A spaced repetition duel is already in progress.");
    }

    const opponentId = getGoalPartnerId(goal, user._id);
    const challengeBase = buildChallengeBase({
      challengerId: user._id,
      opponentId,
      sessionWords: content.sessionWords,
      mode: "classic",
      createdAt: now,
    });
    const challengeId = await ctx.db.insert("challenges", {
      ...challengeBase,
      weeklyGoalId,
      weeklyGoalChallengeType: "spaced_repetition",
      spacedRepetitionStep: step,
      bossLivesTotal: content.themeCount + 1,
      bossLivesRemaining: content.themeCount + 1,
      challengerPerfectRun: true,
      opponentPerfectRun: true,
      status: "pending",
    });

    await ctx.db.insert("notifications", {
      type: "duel_challenge",
      fromUserId: user._id,
      toUserId: opponentId,
      status: "pending",
      payload: {
        challengeId,
        themeName: `Spaced Repetition ${step}/${SPACED_REPETITION_TOTAL_STEPS}: ${content.themeSummary}`,
        mode: challengeBase.mode,
        classicDifficultyPreset: challengeBase.classicDifficultyPreset,
      },
      createdAt: now,
    });

    await ctx.scheduler.runAfter(0, internal.emails.notificationEmails.sendNotificationEmail, {
      trigger: "immediate_duel_challenge",
      toUserId: opponentId,
      fromUserId: user._id,
      challengeId,
    });

    return challengeId;
  },
});

export const startSolo = mutation({
  args: { weeklyGoalId: v.id("weeklyGoals") },
  handler: async (ctx, { weeklyGoalId }) => {
    const { user } = await getAuthenticatedUser(ctx);
    const now = Date.now();
    const goal = await ctx.db.get(weeklyGoalId);
    if (!goal || goal.status !== "completed") {
      throw new Error("Spaced repetition is only available for completed goals.");
    }
    if (!isGoalParticipant(goal, user._id)) {
      throw new Error("Not authorized");
    }

    const record = await getRepetitionRecord(ctx, weeklyGoalId, user._id);
    if (!record) {
      throw new Error("Spaced repetition is not ready yet. Refresh the board and try again.");
    }
    const bucket = getSpacedRepetitionBucket(
      {
        completedSteps: record.completedSteps,
        goalCompletedAt: goal.completedAt ?? getLegacyCompletedGoalBackfillCompletedAt(now),
      },
      now
    );
    if (bucket !== "ready") {
      throw new Error("This repetition is not ready yet.");
    }

    const content = await loadSpacedRepetitionSnapshotContent(ctx, goal);
    if (!content.ok) {
      throw new Error(content.message);
    }

    const challengeBase = buildChallengeBase({
      challengerId: user._id,
      opponentId: user._id,
      sessionWords: content.sessionWords,
      mode: "solo",
      createdAt: now,
    });
    const startState = buildChallengeStartState({
      mode: "solo",
      wordCount: content.sessionWords.length,
      now,
      seed: challengeBase.seed,
    });
    const step = getSpacedRepetitionCurrentStep(record.completedSteps);

    return await ctx.db.insert("challenges", {
      ...challengeBase,
      weeklyGoalId,
      weeklyGoalChallengeType: "spaced_repetition",
      spacedRepetitionStep: step,
      ...startState,
    });
  },
});

export const completeSolo = mutation({
  args: {
    challengeId: v.id("challenges"),
    completedStep: v.number(),
  },
  handler: async (ctx, { challengeId, completedStep }) => {
    const { user } = await getAuthenticatedUser(ctx);
    const now = Date.now();
    const challenge = await ctx.db.get(challengeId);
    if (
      !challenge ||
      challenge.weeklyGoalChallengeType !== "spaced_repetition" ||
      !challenge.weeklyGoalId ||
      challenge.mode !== "solo" ||
      challenge.status !== "challenging" ||
      typeof challenge.spacedRepetitionStep !== "number" ||
      challenge.challengerId !== user._id ||
      challenge.opponentId !== user._id
    ) {
      return { advanced: false };
    }

    const wordCount = challenge.sessionWords.length;
    if (
      !Number.isInteger(completedStep) ||
      completedStep !== challenge.spacedRepetitionStep
    ) {
      return { advanced: false };
    }

    const goal = await ctx.db.get(challenge.weeklyGoalId);
    if (!goal || goal.status !== "completed") {
      return { advanced: false };
    }

    const advanced = await advanceUserIfReady({
      ctx,
      goal,
      userId: user._id,
      mode: "solo",
      challengeId,
      expectedStep: challenge.spacedRepetitionStep,
      now,
    });

    await ctx.db.patch(challengeId, {
      status: "completed",
      currentWordIndex: wordCount,
      challengerScore: wordCount,
      opponentScore: wordCount,
      questionStartTime: undefined,
    });

    return { advanced };
  },
});
