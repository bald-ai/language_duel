import { describe, expect, it } from "vitest";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import {
  claimNotificationSend,
  releaseNotificationSendClaim,
  sendNotificationEmail,
} from "@/convex/emails/notificationEmails";
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
  | "scheduledDuelId"
  | "weeklyGoalId"
  | "reminderOffsetMinutes"
  | "dedupeKey"
  | "sentAt"
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

  async insert(table: "emailNotificationLog", value: Record<string, unknown>) {
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

const releaseNotificationSendClaimHandler = (releaseNotificationSendClaim as unknown as {
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
    }
  ) => Promise<{ sent: boolean; reason?: string }>;
})._handler;

describe("notification email claim-before-send", () => {
  it("skips when an existing claim already matches", async () => {
    const db = new InMemoryDb([], [
      {
        _id: "email_log_1" as Id<"emailNotificationLog">,
        _creationTime: 1,
        toUserId: "user_1" as Id<"users">,
        trigger: "weekly_goal_draft_expiring",
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
            return releaseNotificationSendClaimHandler({ db } as never, {
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
      }
    );

    expect(result).toEqual({ sent: true });
    expect(sentCount).toBe(1);
    expect(db.emailNotificationLog).toHaveLength(1);
  });

  it("deletes the claim and rethrows when the email send fails", async () => {
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
              return releaseNotificationSendClaimHandler({ db } as never, {
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
        }
      )
    ).rejects.toThrow("Resend failed");

    expect(db.emailNotificationLog).toHaveLength(0);
  });
});
