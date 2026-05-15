import { describe, expect, it } from "vitest";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import {
  getByUserId,
  NOTIFICATION_PREFERENCE_BOOLEAN_FIELDS,
} from "@/convex/notificationPreferences";
import {
  emailNotificationTriggerValidator,
  notificationTypeValidator,
} from "@/convex/schema";
import { DEFAULT_NOTIFICATION_PREFS } from "@/lib/notificationPreferences";
import {
  NOTIFICATION_EMAIL_TRIGGER_DEFINITIONS,
  NOTIFICATION_EMAIL_TRIGGERS,
  NOTIFICATION_TYPE_VALUES,
} from "@/lib/notifications/definitions";
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

type LiteralUnionValidator = {
  members: Array<{ value: string; kind: "literal" }>;
  kind: "union";
};

function getLiteralUnionValues(validator: unknown) {
  const union = validator as LiteralUnionValidator;
  expect(union.kind).toBe("union");
  union.members.forEach((member) => expect(member.kind).toBe("literal"));
  return union.members.map((member) => member.value);
}

describe("notificationPreferences.getByUserId", () => {
  it("keeps explicit Convex boolean fields aligned with shared email metadata", () => {
    const metadataFields = new Set<string>();

    Object.values(NOTIFICATION_EMAIL_TRIGGER_DEFINITIONS).forEach((definition) => {
      metadataFields.add(definition.category);
      metadataFields.add(definition.trigger);
    });

    expect(new Set(NOTIFICATION_PREFERENCE_BOOLEAN_FIELDS)).toEqual(metadataFields);
    NOTIFICATION_PREFERENCE_BOOLEAN_FIELDS.forEach((field) => {
      expect(typeof DEFAULT_NOTIFICATION_PREFS[field]).toBe("boolean");
    });
  });

  it("keeps explicit notification validators aligned with shared definitions", () => {
    expect(getLiteralUnionValues(notificationTypeValidator)).toEqual(NOTIFICATION_TYPE_VALUES);
    expect(getLiteralUnionValues(emailNotificationTriggerValidator)).toEqual(
      NOTIFICATION_EMAIL_TRIGGERS
    );
  });

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
