import { describe, expect, it } from "vitest";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { getByUserId } from "@/convex/notificationPreferences";
import { DEFAULT_NOTIFICATION_PREFS } from "@/lib/notificationPreferences";
import { createIndexedQuery } from "./testUtils/inMemoryDb";

type NotificationPreferenceDoc = Partial<Doc<"notificationPreferences">> & {
  _id: Id<"notificationPreferences">;
  _creationTime: number;
  userId: Id<"users">;
};

class InMemoryDb {
  constructor(public notificationPreferences: NotificationPreferenceDoc[]) {}

  query(_table: "notificationPreferences") {
    return createIndexedQuery(this.notificationPreferences);
  }
}

const getByUserIdHandler = (getByUserId as unknown as {
  _handler: (
    ctx: unknown,
    args: { userId: Id<"users"> }
  ) => Promise<Record<string, unknown>>;
})._handler;

describe("notificationPreferences.getByUserId", () => {
  it("fills missing fields from defaults", async () => {
    const db = new InMemoryDb([
      {
        _id: "prefs_1" as Id<"notificationPreferences">,
        _creationTime: 1,
        userId: "user_1" as Id<"users">,
        weeklyGoalEmailsEnabled: false,
        weeklyGoalReminder1OffsetMinutes: 999,
      },
    ]);

    const result = await getByUserIdHandler(
      { db } as never,
      { userId: "user_1" as Id<"users"> }
    );

    expect(result.weeklyGoalEmailsEnabled).toBe(false);
    expect(result.weeklyGoalReminder1OffsetMinutes).toBe(999);
    expect(result.challengeInviteEmailsEnabled).toBe(
      DEFAULT_NOTIFICATION_PREFS.challengeInviteEmailsEnabled
    );
    expect(result.weeklyGoalReminder2OffsetMinutes).toBe(
      DEFAULT_NOTIFICATION_PREFS.weeklyGoalReminder2OffsetMinutes
    );
  });
});
