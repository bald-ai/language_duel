import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import {
  checkNotificationSent,
  claimNotificationSend,
  markNotificationSendSent,
  markNotificationSendFailed,
  cleanupEmailNotificationLog,
} from "@/convex/emails/emailNotificationLog";
import {
  EMAIL_LOG_TTL_MS,
  EMAIL_SEND_CLAIM_STALE_MS,
} from "@/convex/constants";
import { createIndexedQuery } from "./testUtils/inMemoryDb";
const now = 2_000_000_000_000;
const recipient = "recipient" as Id<"users">;
const lookup = {
  toUserId: recipient,
  trigger: "weekly_goal_daily_reminder" as const,
  weeklyGoalId: "goal" as Id<"weeklyGoals">,
};
function log(
  id: string,
  overrides: Partial<Doc<"emailNotificationLog">> = {},
): Doc<"emailNotificationLog"> {
  return {
    _id: id as Id<"emailNotificationLog">,
    _creationTime: 1,
    ...lookup,
    status: "sent",
    sentAt: now,
    ...overrides,
  };
}
function fixture(rows: Doc<"emailNotificationLog">[] = []) {
  const db = {
    query: () => createIndexedQuery(rows),
    patch: vi.fn(
      async (id: string, update: Partial<Doc<"emailNotificationLog">>) => {
        const row = rows.find((row) => row._id === id);
        if (!row) throw new Error("Missing log");
        Object.assign(row, update);
      },
    ),
    insert: vi.fn(
      async (
        _table: string,
        fields: Omit<Doc<"emailNotificationLog">, "_id" | "_creationTime">,
      ) => {
        const id = `log_${rows.length}` as Id<"emailNotificationLog">;
        rows.push({ ...fields, _id: id, _creationTime: now });
        return id;
      },
    ),
    delete: vi.fn(async (id: string) => {
      const index = rows.findIndex((row) => row._id === id);
      if (index >= 0) rows.splice(index, 1);
    }),
  };
  return { rows, db, ctx: { db } };
}
function call(
  fn: unknown,
  ctx: unknown,
  args: Record<string, unknown> = {},
): Promise<unknown> {
  return (
    fn as {
      _handler: (
        ctx: unknown,
        args: Record<string, unknown>,
      ) => Promise<unknown>;
    }
  )._handler(ctx, args);
}
describe("email log claim and retention", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(now);
  });
  afterEach(() => vi.useRealTimers());

  it.each([
    { trigger: "immediate_challenge_invite" as const, challengeId: "challenge" as Id<"challenges">, weeklyGoalId: undefined },
    { weeklyGoalId: "goal" as Id<"weeklyGoals"> },
    { weeklyGoalId: "goal" as Id<"weeklyGoals">, dedupeKey: "2026-09-25" },
  ])(
    "deduplicates only the matching recipient, trigger and source %j",
    async (source) => {
      const f = fixture([
        log("other_user", { ...source, toUserId: "other" as Id<"users"> }),
        log("other_trigger", { ...source, trigger: "weekly_goal_reminder_1" }),
      ]);
      const args = { ...lookup, ...source };
      await expect(call(checkNotificationSent, f.ctx, args)).resolves.toBe(
        false,
      );
      await expect(call(claimNotificationSend, f.ctx, args)).resolves.toEqual({
        claimed: true,
        claimId: "log_2",
      });
      expect(f.rows[2]).toMatchObject({
        ...args,
        status: "pending",
        claimedAt: now,
      });
      await expect(call(checkNotificationSent, f.ctx, args)).resolves.toBe(
        false,
      );
      await expect(call(claimNotificationSend, f.ctx, args)).resolves.toEqual({
        claimed: false,
      });
      await call(markNotificationSendSent, f.ctx, { claimId: "log_2" });
      await expect(call(checkNotificationSent, f.ctx, args)).resolves.toBe(
        true,
      );
      await expect(call(claimNotificationSend, f.ctx, args)).resolves.toEqual({
        claimed: false,
      });
      expect(f.rows).toHaveLength(3);
    },
  );

  it("allows different daily keys for the same goal independently", async () => {
    const f = fixture([
      log("yesterday", {
        weeklyGoalId: "goal" as Id<"weeklyGoals">,
        dedupeKey: "yesterday",
      }),
    ]);
    await expect(
      call(claimNotificationSend, f.ctx, {
        ...lookup,
        weeklyGoalId: "goal",
        dedupeKey: "today",
      }),
    ).resolves.toEqual({ claimed: true, claimId: "log_1" });
  });

  it.each([
    { status: "pending" as const, claimedAt: now - EMAIL_SEND_CLAIM_STALE_MS },
    {
      status: "pending" as const,
      claimedAt: now - EMAIL_SEND_CLAIM_STALE_MS - 1,
    },
    { status: "pending" as const, claimedAt: undefined },
    { status: "failed" as const, failedAt: now - 1 },
  ])(
    "reclaims stale or failed attempts without adding duplicate rows %j",
    async (state) => {
      const f = fixture([log("retry", { ...state, sentAt: undefined })]);
      await expect(call(claimNotificationSend, f.ctx, lookup)).resolves.toEqual(
        { claimed: true, claimId: "retry" },
      );
      expect(f.rows[0]).toMatchObject({
        status: "pending",
        claimedAt: now,
        failedAt: undefined,
      });
      expect(f.db.insert).not.toHaveBeenCalled();
    },
  );

  it("keeps a claim owned until its exact stale boundary", async () => {
    const f = fixture([
      log("live", {
        status: "pending",
        sentAt: undefined,
        claimedAt: now - EMAIL_SEND_CLAIM_STALE_MS + 1,
      }),
    ]);
    await expect(call(claimNotificationSend, f.ctx, lookup)).resolves.toEqual({
      claimed: false,
    });
    expect(f.db.patch).not.toHaveBeenCalled();
  });

  it("records failure and clears it only after a successful send", async () => {
    const f = fixture([
      log("retry", {
        status: "pending",
        claimedAt: now - 10,
        sentAt: undefined,
      }),
    ]);
    await call(markNotificationSendFailed, f.ctx, { claimId: "retry" });
    expect(f.rows[0]).toMatchObject({ status: "failed", failedAt: now });
    vi.setSystemTime(now + 1);
    await call(markNotificationSendSent, f.ctx, { claimId: "retry" });
    expect(f.rows[0]).toMatchObject({
      status: "sent",
      sentAt: now + 1,
      failedAt: undefined,
    });
  });

  it("cleans only sent logs older than the indexed cutoff", async () => {
    const cutoff = now - EMAIL_LOG_TTL_MS;
    const f = fixture([
      log("old", { sentAt: cutoff - 1 }),
      log("boundary", { sentAt: cutoff }),
      log("new"),
      log("pending", { status: "pending", sentAt: undefined }),
      log("failed", { status: "failed", sentAt: cutoff - 1 }),
    ]);
    await expect(call(cleanupEmailNotificationLog, f.ctx)).resolves.toEqual({
      deletedCount: 1,
    });
    expect(f.rows.map((row) => row._id)).toEqual([
      "boundary",
      "new",
      "pending",
      "failed",
    ]);
    await expect(call(cleanupEmailNotificationLog, f.ctx)).resolves.toEqual({
      deletedCount: 0,
    });
  });
});
