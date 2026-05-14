import { afterEach, describe, expect, it, vi } from "vitest";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import {
  sendDailyWeeklyGoalReminderEmails,
  sendDraftExpiryReminders,
} from "@/convex/emails/reminderCrons";
import { getDraftGoalsExpiringSoon } from "@/convex/weeklyGoals";
import { WEEKLY_GOAL_DRAFT_TTL_MS } from "@/convex/constants";
import { DEFAULT_NOTIFICATION_PREFS } from "@/lib/notificationPreferences";
import { createIndexedQuery } from "./testUtils/inMemoryDb";

type WeeklyGoalDoc = Pick<
  Doc<"weeklyGoals">,
  | "_id"
  | "_creationTime"
  | "creatorId"
  | "partnerId"
  | "themes"
  | "creatorLocked"
  | "partnerLocked"
  | "status"
  | "createdAt"
  | "miniBossStatus"
  | "bossStatus"
  | "endDate"
>;

class InMemoryDb {
  constructor(public weeklyGoals: WeeklyGoalDoc[]) {}

  query(_table: "weeklyGoals") {
    return createIndexedQuery(this.weeklyGoals);
  }
}

const sendDailyWeeklyGoalReminderEmailsHandler = (sendDailyWeeklyGoalReminderEmails as unknown as {
  _handler: (ctx: unknown, args: Record<string, never>) => Promise<void>;
})._handler;
const sendDraftExpiryRemindersHandler = (sendDraftExpiryReminders as unknown as {
  _handler: (ctx: unknown, args: Record<string, never>) => Promise<void>;
})._handler;

const getDraftGoalsExpiringSoonHandler = (getDraftGoalsExpiringSoon as unknown as {
  _handler: (ctx: unknown, args: Record<string, never>) => Promise<WeeklyGoalDoc[]>;
})._handler;

function buildGoal(overrides: Partial<WeeklyGoalDoc> = {}): WeeklyGoalDoc {
  return {
    _id: "goal_1" as Id<"weeklyGoals">,
    _creationTime: 1,
    creatorId: "user_1" as Id<"users">,
    partnerId: "user_2" as Id<"users">,
    themes: [],
    creatorLocked: true,
    partnerLocked: true,
    status: "locked",
    createdAt: 1,
    miniBossStatus: "unavailable",
    bossStatus: "unavailable",
    endDate: Date.now() + 86_400_000,
    ...overrides,
  };
}

describe("reminder crons", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("sends daily weekly goal reminder emails to both participants", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(Date.UTC(2026, 3, 29, 10, 5, 0));
    const goal = buildGoal();
    const sends: Array<{ trigger: string; toUserId: Id<"users"> }> = [];
    let goalQueryCount = 0;

    await sendDailyWeeklyGoalReminderEmailsHandler(
      {
        runQuery: async (_fn: unknown, args: { userId?: Id<"users"> }) => {
          if (args.userId) return { ...DEFAULT_NOTIFICATION_PREFS, userId: args.userId };
          goalQueryCount++;
          return goalQueryCount === 1 ? [goal] : [];
        },
        runAction: async (
          _fn: unknown,
          args: { trigger: string; toUserId: Id<"users"> }
        ) => {
          sends.push(args);
          return { sent: true };
        },
      } as never,
      {}
    );

    expect(sends.map((send) => send.toUserId)).toEqual(["user_1", "user_2"]);
  });

  it("selects draft expiry reminders from a 2 hour created-at window", async () => {
    vi.useFakeTimers();
    const now = Date.UTC(2026, 3, 29, 10, 0, 0);
    vi.setSystemTime(now);
    const insideOlderEdge = buildGoal({
      _id: "goal_inside_older" as Id<"weeklyGoals">,
      status: "draft",
      createdAt: now - WEEKLY_GOAL_DRAFT_TTL_MS + 22 * 60 * 60 * 1000,
    });
    const insideNewerEdge = buildGoal({
      _id: "goal_inside_newer" as Id<"weeklyGoals">,
      status: "draft",
      createdAt: now - WEEKLY_GOAL_DRAFT_TTL_MS + 23 * 60 * 60 * 1000,
    });
    const outside = buildGoal({
      _id: "goal_outside" as Id<"weeklyGoals">,
      status: "draft",
      createdAt: now - WEEKLY_GOAL_DRAFT_TTL_MS + 21 * 60 * 60 * 1000,
    });
    const db = new InMemoryDb([insideOlderEdge, insideNewerEdge, outside]);

    const result = await getDraftGoalsExpiringSoonHandler({ db } as never, {});

    expect(result.map((goal) => goal._id)).toEqual([
      "goal_inside_older",
      "goal_inside_newer",
    ]);
  });

  it("creates in-app draft-expiry notification but no email log when email is disabled", async () => {
    const goal = buildGoal({
      _id: "goal_draft_1" as Id<"weeklyGoals">,
      status: "draft",
      creatorId: "user_1" as Id<"users">,
    });
    const mutationCalls: string[] = [];
    const actionCalls: string[] = [];

    await sendDraftExpiryRemindersHandler(
      {
        runQuery: async (_fn: unknown, args: { userId?: Id<"users">; trigger?: string }) => {
          if (args.userId) {
            return {
              ...DEFAULT_NOTIFICATION_PREFS,
              weeklyGoalDraftExpiringEmailEnabled: false,
            };
          }
          if (args.trigger === "weekly_goal_draft_expiring") return false;
          return [goal];
        },
        runMutation: async (fn: { name?: string }) => {
          mutationCalls.push(fn.name ?? "unknownMutation");
          return { created: true };
        },
        runAction: async (fn: { name?: string }) => {
          actionCalls.push(fn.name ?? "unknownAction");
          return { sent: false, reason: "disabled_by_user" };
        },
      } as never,
      {}
    );

    expect(mutationCalls).toHaveLength(1);
    expect(actionCalls).toHaveLength(0);
  });

  it("does not write email log when recipient has no email", async () => {
    const goal = buildGoal({
      _id: "goal_draft_2" as Id<"weeklyGoals">,
      status: "draft",
      creatorId: "user_1" as Id<"users">,
    });
    const mutationCalls: string[] = [];
    const actionCalls: string[] = [];

    await sendDraftExpiryRemindersHandler(
      {
        runQuery: async (_fn: unknown, args: { userId?: Id<"users">; trigger?: string }) => {
          if (args.userId) return DEFAULT_NOTIFICATION_PREFS;
          if (args.trigger === "weekly_goal_draft_expiring") return false;
          return [goal];
        },
        runMutation: async (fn: { name?: string }) => {
          mutationCalls.push(fn.name ?? "unknownMutation");
          return { created: true };
        },
        runAction: async (fn: { name?: string }) => {
          actionCalls.push(fn.name ?? "unknownAction");
          return { sent: false, reason: "no_email" };
        },
      } as never,
      {}
    );

    expect(mutationCalls).toHaveLength(1);
    expect(actionCalls).toHaveLength(1);
  });

  it("allows one email send after re-enabling draft-expiry emails", async () => {
    const goal = buildGoal({
      _id: "goal_draft_3" as Id<"weeklyGoals">,
      status: "draft",
      creatorId: "user_1" as Id<"users">,
    });
    let alreadySent = false;
    let emailSendCount = 0;

    const runOnce = async (prefs: typeof DEFAULT_NOTIFICATION_PREFS) => {
      await sendDraftExpiryRemindersHandler(
        {
          runQuery: async (_fn: unknown, args: { userId?: Id<"users">; trigger?: string }) => {
            if (args.userId) return prefs;
            if (args.trigger === "weekly_goal_draft_expiring") return alreadySent;
            return [goal];
          },
          runMutation: async () => ({ created: true }),
          runAction: async () => {
            emailSendCount++;
            alreadySent = true;
            return { sent: true };
          },
        } as never,
        {}
      );
    };

    await runOnce({
      ...DEFAULT_NOTIFICATION_PREFS,
      weeklyGoalDraftExpiringEmailEnabled: false,
    });
    expect(emailSendCount).toBe(0);

    await runOnce(DEFAULT_NOTIFICATION_PREFS);
    expect(emailSendCount).toBe(1);

    await runOnce(DEFAULT_NOTIFICATION_PREFS);
    expect(emailSendCount).toBe(1);
  });
});
