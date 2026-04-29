import { afterEach, describe, expect, it, vi } from "vitest";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import {
  sendDailyWeeklyGoalReminderEmails,
  sendScheduledDuelReminders,
} from "@/convex/emails/reminderCrons";
import { getDraftGoalsExpiringSoon } from "@/convex/weeklyGoals";
import { WEEKLY_GOAL_DRAFT_TTL_MS } from "@/convex/constants";
import { DEFAULT_NOTIFICATION_PREFS } from "@/lib/notificationPreferences";
import { createIndexedQuery } from "./testUtils/inMemoryDb";

type ScheduledDuelDoc = Pick<
  Doc<"scheduledDuels">,
  "_id" | "proposerId" | "recipientId" | "scheduledTime" | "status" | "startedDuelId"
>;

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

const sendScheduledDuelRemindersHandler = (sendScheduledDuelReminders as unknown as {
  _handler: (ctx: unknown, args: Record<string, never>) => Promise<void>;
})._handler;

const sendDailyWeeklyGoalReminderEmailsHandler = (sendDailyWeeklyGoalReminderEmails as unknown as {
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

  it("continues scheduled duel reminders after one send fails", async () => {
    vi.useFakeTimers();
    const now = Date.UTC(2026, 3, 29, 10, 0, 0);
    vi.setSystemTime(now);
    const duel: ScheduledDuelDoc = {
      _id: "scheduled_1" as Id<"scheduledDuels">,
      proposerId: "user_1" as Id<"users">,
      recipientId: "user_2" as Id<"users">,
      scheduledTime: now + 6 * 60 * 1000,
      status: "accepted",
      startedDuelId: undefined,
    };
    const sends: Array<Id<"users">> = [];

    await sendScheduledDuelRemindersHandler(
      {
        runQuery: async (_fn: unknown, args: { userId?: Id<"users"> }) => {
          if (args.userId) {
            return {
              ...DEFAULT_NOTIFICATION_PREFS,
              userId: args.userId,
              scheduledDuelReminderOffsetMinutes: 15,
            };
          }
          return [duel];
        },
        runAction: async (
          _fn: unknown,
          args: { toUserId: Id<"users"> }
        ) => {
          sends.push(args.toUserId);
          if (args.toUserId === "user_1") {
            throw new Error("send failed");
          }
          return { sent: true };
        },
      } as never,
      {}
    );

    expect(sends).toEqual(["user_1", "user_2"]);
  });

  it("daily weekly goal emails run on the configured Prague hour even when minute differs", async () => {
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
});
