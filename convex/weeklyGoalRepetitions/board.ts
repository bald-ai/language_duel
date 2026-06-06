import type { QueryCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import { loadUsersById } from "../helpers/users";
import {
  getSpacedRepetitionBucket,
  type SpacedRepetitionBucket,
} from "../../lib/spacedRepetition";
import {
  assertSnapshotContentReady,
  buildDeferredSnapshotContent,
  loadSpacedRepetitionSnapshotContent,
} from "./contentLoading";
import { buildBoardItem } from "./readModel";
import { toUserSummary } from "../helpers/userSummary";
import {
  getGoalPartnerIdForViewer,
  getRepetitionRecord,
  isGoalParticipant,
} from "./rules";
import type { LoadedSnapshotContent } from "./types";

type BoardItem = ReturnType<typeof buildBoardItem>;

export type RepetitionBoard = {
  stats: { total: number; ready: number; comingUp: number; done: number };
  all: BoardItem[];
  ready: BoardItem[];
  comingUp: BoardItem[];
  done: BoardItem[];
};

const EMPTY_BOARD: RepetitionBoard = {
  stats: { total: 0, ready: 0, comingUp: 0, done: 0 },
  all: [],
  ready: [],
  comingUp: [],
  done: [],
};

// The board only renders the availability flag/reason, never itemCount, so for
// ready items run the cheap snapshot probe and reuse the item-free deferred
// content shape when it passes. The launch preview keeps the full loader because
// it shows itemCount/themeSummary.
async function loadBoardContent(
  ctx: QueryCtx,
  goal: Doc<"weeklyGoals">,
  bucket: SpacedRepetitionBucket
): Promise<LoadedSnapshotContent> {
  if (bucket !== "ready") return buildDeferredSnapshotContent(goal);
  const ready = await assertSnapshotContentReady(ctx, goal);
  return ready.ok ? buildDeferredSnapshotContent(goal) : ready;
}

async function loadCompletedGoalsForUser(
  ctx: QueryCtx,
  userId: Id<"users">
): Promise<Doc<"weeklyGoals">[]> {
  const completedGoalsAsCreator = await ctx.db
    .query("weeklyGoals")
    .withIndex("by_creator", (q) => q.eq("creatorId", userId))
    .filter((q) => q.eq(q.field("status"), "completed"))
    .collect();
  const completedGoalsAsPartner = await ctx.db
    .query("weeklyGoals")
    .withIndex("by_partner", (q) => q.eq("partnerId", userId))
    .filter((q) => q.eq(q.field("status"), "completed"))
    .collect();

  const goalsById = new Map<Id<"weeklyGoals">, Doc<"weeklyGoals">>();
  for (const goal of [...completedGoalsAsCreator, ...completedGoalsAsPartner]) {
    goalsById.set(goal._id, goal);
  }
  return Array.from(goalsById.values());
}

export async function loadRepetitionBoardForUser(
  ctx: QueryCtx,
  userId: Id<"users">
): Promise<RepetitionBoard> {
  const now = Date.now();
  const records = await ctx.db
    .query("weeklyGoalRepetitions")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .collect();

  const goals = await loadCompletedGoalsForUser(ctx, userId);
  const recordByGoalId = new Map(
    records.map((record) => [String(record.weeklyGoalId), record])
  );
  const partnerIds = goals.flatMap((goal) => {
    const partnerId = getGoalPartnerIdForViewer(goal, userId);
    return partnerId === undefined ? [] : [partnerId];
  });
  const usersById = await loadUsersById(ctx, partnerIds);

  const items: BoardItem[] = [];

  for (const goal of goals) {
    const record = recordByGoalId.get(String(goal._id));
    if (!record || typeof goal.completedAt !== "number") {
      continue;
    }
    const bucket = getSpacedRepetitionBucket(
      {
        completedSteps: record.completedSteps,
        goalCompletedAt: goal.completedAt,
      },
      now
    );
    const content = await loadBoardContent(ctx, goal, bucket);
    const partnerId = getGoalPartnerIdForViewer(goal, userId);
    items.push(
      buildBoardItem({
        goal,
        record,
        partner: toUserSummary(
          partnerId === undefined ? null : usersById.get(partnerId) ?? null
        ),
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
    all: [...ready, ...comingUp, ...done],
    ready,
    comingUp,
    done,
  };
}

export async function loadLaunchPreviewForUser(
  ctx: QueryCtx,
  userId: Id<"users">,
  weeklyGoalId: Id<"weeklyGoals">
) {
  const goal = await ctx.db.get(weeklyGoalId);
  if (
    !goal ||
    goal.status !== "completed" ||
    typeof goal.completedAt !== "number" ||
    !isGoalParticipant(goal, userId)
  ) {
    return null;
  }

  const record = await getRepetitionRecord(ctx, weeklyGoalId, userId);
  if (!record) return null;

  const now = Date.now();
  const bucket = getSpacedRepetitionBucket(
    {
      completedSteps: record.completedSteps,
      goalCompletedAt: goal.completedAt,
    },
    now
  );
  const content =
    bucket === "ready"
      ? await loadSpacedRepetitionSnapshotContent(ctx, goal)
      : buildDeferredSnapshotContent(goal);
  const partnerId = getGoalPartnerIdForViewer(goal, userId);
  const partner = partnerId === undefined ? null : await ctx.db.get(partnerId);
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
    duelAvailable: goal.mode === "shared" && partner !== null,
  };
}

export { EMPTY_BOARD };
