import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import {
  sendNotificationEmail,
} from "@/convex/emails/notificationEmails";
import {
  claimNotificationSend,
  markNotificationSendFailed,
  markNotificationSendSent,
} from "@/convex/emails/emailNotificationLog";
import { DEFAULT_NOTIFICATION_PREFS } from "@/lib/notificationPreferences";
import { createIndexedQuery, deleteRow, insertRow } from "./testUtils/inMemoryDb";

type UserDoc = Pick<
  Doc<"users">,
  "_id" | "_creationTime" | "clerkId" | "email" | "name" | "imageUrl" | "nickname"
>;

type EmailLogDoc = Pick<
  Doc<"emailNotificationLog">,
  | "_id"
  | "_creationTime"
  | "toUserId"
  | "trigger"
  | "challengeId"
  | "duelId"
  | "soloPracticeSessionId"
  | "weeklyGoalId"
  | "reminderOffsetMinutes"
  | "dedupeKey"
  | "status"
  | "claimedAt"
  | "sentAt"
  | "failedAt"
>;

class InMemoryDb {
  private emailLogCounter = 10;

  constructor(
    public users: UserDoc[] = [],
    public emailNotificationLog: EmailLogDoc[] = []
  ) {}

  query(table: "users" | "emailNotificationLog") {
    if (table === "users") {
      return createIndexedQuery(this.users);
    }
    return createIndexedQuery(this.emailNotificationLog);
  }

  async insert(_table: "emailNotificationLog", value: Record<string, unknown>) {
    const { id, nextCounter } = insertRow(
      this.emailNotificationLog,
      "email_log",
      this.emailLogCounter,
      value
    );
    this.emailLogCounter = nextCounter;
    return id as Id<"emailNotificationLog">;
  }

  async delete(id: Id<"emailNotificationLog">) {
    deleteRow(this.emailNotificationLog, id);
  }

  async patch(id: Id<"emailNotificationLog">, value: Record<string, unknown>) {
    const row = this.emailNotificationLog.find((log) => log._id === id);
    if (!row) return;
    Object.assign(row, value);
  }
}

function buildUser(overrides: Partial<UserDoc> = {}): UserDoc {
  return {
    _id: "user_1" as Id<"users">,
    _creationTime: 1,
    clerkId: "clerk_1",
    email: "player@example.com",
    name: "Player",
    imageUrl: undefined,
    nickname: "Player",
    ...overrides,
  };
}

const claimNotificationSendHandler = (claimNotificationSend as unknown as {
  _handler: (
    ctx: unknown,
    args: {
      toUserId: Id<"users">;
      trigger: "weekly_goal_draft_expiring";
      weeklyGoalId?: Id<"weeklyGoals">;
      duelId?: Id<"duels">;
      soloPracticeSessionId?: Id<"soloPracticeSessions">;
      dedupeKey?: string;
    }
  ) => Promise<{ claimed: boolean; claimId?: Id<"emailNotificationLog"> }>;
})._handler;

const markNotificationSendSentHandler = (markNotificationSendSent as unknown as {
  _handler: (
    ctx: unknown,
    args: { claimId: Id<"emailNotificationLog"> }
  ) => Promise<void>;
})._handler;

const markNotificationSendFailedHandler = (markNotificationSendFailed as unknown as {
  _handler: (
    ctx: unknown,
    args: { claimId: Id<"emailNotificationLog"> }
  ) => Promise<void>;
})._handler;

const sendNotificationEmailHandler = (sendNotificationEmail as unknown as {
  _handler: (
    ctx: unknown,
    args: {
      toUserId: Id<"users">;
      trigger: "weekly_goal_draft_expiring";
      weeklyGoalId?: Id<"weeklyGoals">;
    }
  ) => Promise<{ sent: boolean; reason?: string }>;
})._handler;

describe("notification email claim-before-send", () => {
  const originalAppUrl = process.env.APP_URL;

  beforeEach(() => {
    process.env.APP_URL = "https://app.example.com";
  });

  afterEach(() => {
    if (originalAppUrl === undefined) {
      delete process.env.APP_URL;
    } else {
      process.env.APP_URL = originalAppUrl;
    }
  });

  it("skips when an existing claim already matches", async () => {
    const db = new InMemoryDb([], [
      {
        _id: "email_log_1" as Id<"emailNotificationLog">,
        _creationTime: 1,
        toUserId: "user_1" as Id<"users">,
        trigger: "weekly_goal_draft_expiring",
        status: "sent",
        weeklyGoalId: "goal_1" as Id<"weeklyGoals">,
        sentAt: 123,
      },
    ]);

    const result = await claimNotificationSendHandler(
      { db } as never,
      {
        toUserId: "user_1" as Id<"users">,
        trigger: "weekly_goal_draft_expiring",
        weeklyGoalId: "goal_1" as Id<"weeklyGoals">,
      }
    );

    expect(result.claimed).toBe(false);
    expect(db.emailNotificationLog).toHaveLength(1);
  });

  it("dedupes duel-scoped claims by duelId", async () => {
    const db = new InMemoryDb([], [
      {
        _id: "email_log_1" as Id<"emailNotificationLog">,
        _creationTime: 1,
        toUserId: "user_1" as Id<"users">,
        trigger: "weekly_goal_draft_expiring",
        status: "sent",
        duelId: "duel_1" as Id<"duels">,
        sentAt: 123,
      },
    ]);

    const result = await claimNotificationSendHandler(
      { db } as never,
      {
        toUserId: "user_1" as Id<"users">,
        trigger: "weekly_goal_draft_expiring",
        duelId: "duel_1" as Id<"duels">,
      }
    );

    expect(result.claimed).toBe(false);
    expect(db.emailNotificationLog).toHaveLength(1);
  });

  it("uses duelId over weeklyGoalId when both are present", async () => {
    const db = new InMemoryDb([], [
      {
        _id: "email_log_1" as Id<"emailNotificationLog">,
        _creationTime: 1,
        toUserId: "user_1" as Id<"users">,
        trigger: "weekly_goal_draft_expiring",
        status: "sent",
        duelId: "duel_1" as Id<"duels">,
        sentAt: 123,
      },
    ]);

    const result = await claimNotificationSendHandler(
      { db } as never,
      {
        toUserId: "user_1" as Id<"users">,
        trigger: "weekly_goal_draft_expiring",
        duelId: "duel_1" as Id<"duels">,
        weeklyGoalId: "goal_1" as Id<"weeklyGoals">,
      }
    );

    expect(result.claimed).toBe(false);
    expect(db.emailNotificationLog).toHaveLength(1);
  });


  it("dedupes solo-practice-scoped claims by soloPracticeSessionId", async () => {
    const db = new InMemoryDb([], [
      {
        _id: "email_log_1" as Id<"emailNotificationLog">,
        _creationTime: 1,
        toUserId: "user_1" as Id<"users">,
        trigger: "weekly_goal_draft_expiring",
        status: "sent",
        soloPracticeSessionId: "solo_practice_1" as Id<"soloPracticeSessions">,
        sentAt: 123,
      },
    ]);

    const result = await claimNotificationSendHandler(
      { db } as never,
      {
        toUserId: "user_1" as Id<"users">,
        trigger: "weekly_goal_draft_expiring",
        soloPracticeSessionId: "solo_practice_1" as Id<"soloPracticeSessions">,
      }
    );

    expect(result.claimed).toBe(false);
    expect(db.emailNotificationLog).toHaveLength(1);
  });

  it("keeps the claim when the email send succeeds", async () => {
    const db = new InMemoryDb([buildUser()]);
    let sentCount = 0;

    const result = await sendNotificationEmailHandler(
      {
        runQuery: async (_fn: unknown, args: { id?: Id<"users">; userId?: Id<"users"> }) => {
          if (args.id) return db.users.find((user) => user._id === args.id) ?? null;
          if (args.userId) return { ...DEFAULT_NOTIFICATION_PREFS, userId: args.userId };
          return null;
        },
        runMutation: async (_fn: unknown, args: { claimId?: Id<"emailNotificationLog"> }) => {
          if (args.claimId) {
            return markNotificationSendSentHandler({ db } as never, {
              claimId: args.claimId,
            });
          }
          return claimNotificationSendHandler({ db } as never, args as never);
        },
        runAction: async () => {
          sentCount++;
          return { success: true };
        },
      } as never,
      {
        toUserId: "user_1" as Id<"users">,
        trigger: "weekly_goal_draft_expiring",
        weeklyGoalId: "goal_1" as Id<"weeklyGoals">,
      }
    );

    expect(result).toEqual({ sent: true });
    expect(sentCount).toBe(1);
    expect(db.emailNotificationLog).toHaveLength(1);
    expect(db.emailNotificationLog[0].status).toBe("sent");
    expect(db.emailNotificationLog[0].sentAt).toEqual(expect.any(Number));
  });

  it("marks the claim failed and rethrows when the email send fails", async () => {
    const db = new InMemoryDb([buildUser()]);

    await expect(
      sendNotificationEmailHandler(
        {
          runQuery: async (_fn: unknown, args: { id?: Id<"users">; userId?: Id<"users"> }) => {
            if (args.id) return db.users.find((user) => user._id === args.id) ?? null;
            if (args.userId) return { ...DEFAULT_NOTIFICATION_PREFS, userId: args.userId };
            return null;
          },
          runMutation: async (_fn: unknown, args: { claimId?: Id<"emailNotificationLog"> }) => {
            if (args.claimId) {
              return markNotificationSendFailedHandler({ db } as never, {
                claimId: args.claimId,
              });
            }
            return claimNotificationSendHandler({ db } as never, args as never);
          },
          runAction: async () => {
            throw new Error("Resend failed");
          },
        } as never,
        {
          toUserId: "user_1" as Id<"users">,
          trigger: "weekly_goal_draft_expiring",
          weeklyGoalId: "goal_1" as Id<"weeklyGoals">,
        }
      )
    ).rejects.toThrow("Resend failed");

    expect(db.emailNotificationLog).toHaveLength(1);
    expect(db.emailNotificationLog[0].status).toBe("failed");
    expect(db.emailNotificationLog[0].failedAt).toEqual(expect.any(Number));
  });

  it("fails loudly at the email boundary when APP_URL is missing", async () => {
    delete process.env.APP_URL;
    const db = new InMemoryDb([buildUser()]);

    await expect(
      sendNotificationEmailHandler(
        {
          runQuery: async (_fn: unknown, args: { id?: Id<"users">; userId?: Id<"users"> }) => {
            if (args.id) return db.users.find((user) => user._id === args.id) ?? null;
            if (args.userId) return { ...DEFAULT_NOTIFICATION_PREFS, userId: args.userId };
            return null;
          },
          runMutation: async (_fn: unknown, args: { claimId?: Id<"emailNotificationLog"> }) => {
            if (args.claimId) {
              return markNotificationSendFailedHandler({ db } as never, {
                claimId: args.claimId,
              });
            }
            return claimNotificationSendHandler({ db } as never, args as never);
          },
          runAction: async () => ({ success: true }),
        } as never,
        {
          toUserId: "user_1" as Id<"users">,
          trigger: "weekly_goal_draft_expiring",
          weeklyGoalId: "goal_1" as Id<"weeklyGoals">,
        }
      )
    ).rejects.toThrow("APP_URL must be set before sending notification emails");
  });
});
