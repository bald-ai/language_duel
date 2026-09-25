import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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
  | "weeklyGoalId"
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

  it("rejects a log claim without the source required by its trigger", async () => {
    const db = new InMemoryDb();
    await expect(claimNotificationSendHandler({ db }, {
      toUserId: "user_1" as Id<"users">,
      trigger: "weekly_goal_draft_expiring",
    })).rejects.toMatchObject({ data: { code: "INVALID_INPUT" } });
    expect(db.emailNotificationLog).toEqual([]);
  });

  it("respects disabled notification preferences before claiming or sending", async () => {
    const runQuery = vi.fn().mockResolvedValueOnce(buildUser()).mockResolvedValueOnce({ ...DEFAULT_NOTIFICATION_PREFS, weeklyGoalEmailsEnabled: false });
    const runMutation = vi.fn(); const runAction = vi.fn();
    await expect(sendNotificationEmailHandler({ runQuery, runMutation, runAction }, { toUserId: "user_1" as Id<"users">, trigger: "weekly_goal_draft_expiring", weeklyGoalId: "goal_1" as Id<"weeklyGoals"> })).resolves.toEqual({ sent: false, reason: "disabled_by_user" });
    expect(runMutation).not.toHaveBeenCalled(); expect(runAction).not.toHaveBeenCalled();
  });
  it("does not deliver a notification when its send claim was already taken", async () => {
    const runQuery = vi.fn().mockResolvedValueOnce(buildUser()).mockResolvedValueOnce(DEFAULT_NOTIFICATION_PREFS).mockResolvedValue(null);
    const runMutation = vi.fn().mockResolvedValue({ claimed: false }); const runAction = vi.fn();
    await expect(sendNotificationEmailHandler({ runQuery, runMutation, runAction }, { toUserId: "user_1" as Id<"users">, trigger: "weekly_goal_draft_expiring", weeklyGoalId: "goal_1" as Id<"weeklyGoals"> })).resolves.toEqual({ sent: false, reason: "already_sent" });
    expect(runMutation).toHaveBeenCalledOnce(); expect(runAction).not.toHaveBeenCalled();
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

  it("sends notifications to the email stored on the trusted user record", async () => {
    const db = new InMemoryDb([
      buildUser({ email: "trusted-stored@example.com" }),
    ]);
    let sentTo: string | undefined;

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
        runAction: async (_fn: unknown, args: { to: string }) => {
          sentTo = args.to;
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
    expect(sentTo).toBe("trusted-stored@example.com");
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
