import { afterEach, describe, expect, it, vi } from "vitest";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import {
  getByUserId,
  getMyNotificationPreferences,
  updateNotificationPreferences,
} from "@/convex/notificationPreferences";
import {
  emailNotificationTriggerValidator,
  notificationTypeValidator,
} from "@/convex/schema";
import {
  DEFAULT_NOTIFICATION_PREFS,
  WEEKLY_GOAL_REMINDER_MIN_OFFSET_MINUTES,
  WEEKLY_GOAL_REMINDER_MAX_OFFSET_MINUTES,
  type NotificationPreferences,
} from "@/lib/notificationPreferences";
import {
  NOTIFICATION_EMAIL_TRIGGER_DEFINITIONS,
  NOTIFICATION_EMAIL_TRIGGERS,
  NOTIFICATION_TYPE_VALUES,
} from "@/lib/notifications/definitions";
import { createAuthCtx, createIndexedQuery } from "./testUtils/inMemoryDb";

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

const getByUserIdHandler = (
  getByUserId as unknown as {
    _handler: (
      ctx: unknown,
      args: { userId: Id<"users"> },
    ) => Promise<Record<string, unknown>>;
  }
)._handler;

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
  it("keeps boolean preferences aligned with shared email metadata", () => {
    const metadataFields = new Set<string>();

    Object.values(NOTIFICATION_EMAIL_TRIGGER_DEFINITIONS).forEach(
      (definition) => {
        metadataFields.add(definition.category);
        metadataFields.add(definition.trigger);
      },
    );

    const preferenceFields = Object.entries(DEFAULT_NOTIFICATION_PREFS)
      .filter(([, value]) => typeof value === "boolean").map(([key]) => key);
    expect(new Set(preferenceFields)).toEqual(metadataFields);

  });

  it("keeps explicit notification validators aligned with shared definitions", () => {
    expect(getLiteralUnionValues(notificationTypeValidator)).toEqual(
      NOTIFICATION_TYPE_VALUES,
    );
    expect(getLiteralUnionValues(emailNotificationTriggerValidator)).toEqual(
      NOTIFICATION_EMAIL_TRIGGERS,
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

    const result = await getByUserIdHandler({ db } as never, {
      userId: "user_1" as Id<"users">,
    });

    expect(result.weeklyGoalEmailsEnabled).toBe(false);
    expect(result.weeklyGoalReminder1OffsetMinutes).toBe(999);
    expect(result.challengeInviteEmailsEnabled).toBe(
      DEFAULT_NOTIFICATION_PREFS.challengeInviteEmailsEnabled,
    );
    expect(result.weeklyGoalReminder2OffsetMinutes).toBe(
      DEFAULT_NOTIFICATION_PREFS.weeklyGoalReminder2OffsetMinutes,
    );
  });
});

function preferenceFixture(
  initial?: Partial<NotificationPreferences>,
  clerkId: string | null = "clerk",
) {
  const userId = "user" as Id<"users">;
  const other = {
    ...DEFAULT_NOTIFICATION_PREFS,
    _id: "other_prefs" as Id<"notificationPreferences">,
    _creationTime: 1,
    userId: "other" as Id<"users">,
    updatedAt: 1,
  };
  const preferences: Doc<"notificationPreferences">[] = [other];
  if (initial)
    preferences.push({
      ...DEFAULT_NOTIFICATION_PREFS,
      ...initial,
      _id: "prefs" as Id<"notificationPreferences">,
      _creationTime: 1,
      userId,
      updatedAt: 1,
    });
  const patch = vi.fn(
    async (id: string, fields: Partial<Doc<"notificationPreferences">>) => {
      const index = preferences.findIndex((row) => row._id === id);
      if (index < 0) throw new Error("Missing preference row");
      preferences[index] = { ...preferences[index], ...fields };
    },
  );
  const insert = vi.fn(
    async (
      _table: string,
      fields: Omit<Doc<"notificationPreferences">, "_id" | "_creationTime">,
    ) => {
      preferences.push({
        ...fields,
        _id: "inserted" as Id<"notificationPreferences">,
        _creationTime: 100,
      });
    },
  );
  const db = {
    query: (table: string) =>
      table === "users"
        ? createIndexedQuery([{ _id: userId, clerkId: "clerk" }])
        : createIndexedQuery(preferences),
    patch,
    insert,
  };
  return {
    ctx: createAuthCtx(db, clerkId),
    preferences,
    patch,
    insert,
    userId,
    other,
  };
}
function callPreferenceHandler(
  fn: unknown,
  ctx: unknown,
  args: Partial<NotificationPreferences> = {},
) {
  return (
    fn as {
      _handler: (
        ctx: unknown,
        args: Partial<NotificationPreferences>,
      ) => Promise<unknown>;
    }
  )._handler(ctx, args);
}

describe("authenticated notification preference storage", () => {
  afterEach(() => vi.useRealTimers());

  it("returns defaults without creating a row and isolates the current user", async () => {
    const f = preferenceFixture();
    await expect(
      callPreferenceHandler(getMyNotificationPreferences, f.ctx),
    ).resolves.toEqual({
      ...DEFAULT_NOTIFICATION_PREFS,
      userId: f.userId,
      isDefault: true,
    });
    expect(f.preferences).toEqual([f.other]);
    expect(f.insert).not.toHaveBeenCalled();
  });

  it("returns stored opt-outs as nondefault preferences", async () => {
    const f = preferenceFixture({
      weeklyGoalEmailsEnabled: false,
      challengeInviteEmailEnabled: false,
    });
    await expect(
      callPreferenceHandler(getMyNotificationPreferences, f.ctx),
    ).resolves.toEqual({
      ...DEFAULT_NOTIFICATION_PREFS,
      weeklyGoalEmailsEnabled: false,
      challengeInviteEmailEnabled: false,
      userId: f.userId,
      isDefault: false,
    });
  });

  it("creates defaults once and patches only supplied fields on subsequent updates", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(1000);
    const f = preferenceFixture();
    await callPreferenceHandler(updateNotificationPreferences, f.ctx, {
      weeklyGoalEmailsEnabled: false,
    });
    expect(f.preferences[1]).toEqual({
      ...DEFAULT_NOTIFICATION_PREFS,
      weeklyGoalEmailsEnabled: false,
      _id: "inserted",
      _creationTime: 100,
      userId: f.userId,
      updatedAt: 1000,
    });
    vi.setSystemTime(2000);
    await callPreferenceHandler(updateNotificationPreferences, f.ctx, {
      challengeInviteEmailEnabled: false,
    });
    expect(f.patch).toHaveBeenCalledExactlyOnceWith("inserted", {
      challengeInviteEmailEnabled: false,
      updatedAt: 2000,
    });
    expect(f.preferences[1]).toMatchObject({
      weeklyGoalEmailsEnabled: false,
      challengeInviteEmailEnabled: false,
      updatedAt: 2000,
    });
    expect(f.preferences[0]).toEqual(f.other);
    expect(f.insert).toHaveBeenCalledTimes(1);
  });

  it.each([
    "weeklyGoalReminder1OffsetMinutes",
    "weeklyGoalReminder2OffsetMinutes",
  ] as const)("accepts both inclusive boundaries for %s", async (field) => {
    const f = preferenceFixture();
    for (const value of [
      WEEKLY_GOAL_REMINDER_MIN_OFFSET_MINUTES,
      WEEKLY_GOAL_REMINDER_MAX_OFFSET_MINUTES,
    ]) {
      await expect(callPreferenceHandler(updateNotificationPreferences, f.ctx, {
        [field]: value,
      })).resolves.toBeUndefined();
      expect(f.preferences[1][field]).toBe(value);
    }
  });

  it.each([
    [
      "weeklyGoalReminder1OffsetMinutes",
      WEEKLY_GOAL_REMINDER_MIN_OFFSET_MINUTES - 1,
    ],
    [
      "weeklyGoalReminder1OffsetMinutes",
      WEEKLY_GOAL_REMINDER_MAX_OFFSET_MINUTES + 1,
    ],
    [
      "weeklyGoalReminder2OffsetMinutes",
      WEEKLY_GOAL_REMINDER_MIN_OFFSET_MINUTES - 1,
    ],
    [
      "weeklyGoalReminder2OffsetMinutes",
      WEEKLY_GOAL_REMINDER_MAX_OFFSET_MINUTES + 1,
    ],
  ] as const)(
    "rejects %s=%s before changing any preferences",
    async (field, value) => {
      const f = preferenceFixture({ weeklyGoalEmailsEnabled: false });
      const before = structuredClone(f.preferences);
      await expect(
        callPreferenceHandler(updateNotificationPreferences, f.ctx, {
          [field]: value,
          weeklyGoalEmailsEnabled: true,
        }),
      ).rejects.toThrow("Invalid weekly goal reminder");
      expect(f.preferences).toEqual(before);
      expect(f.patch).not.toHaveBeenCalled();
      expect(f.insert).not.toHaveBeenCalled();
    },
  );

  it.each([null, "unknown"])(
    "rejects reads and writes for missing identity/user %s",
    async (identity) => {
      const f = preferenceFixture(undefined, identity);
      for (const fn of [
        getMyNotificationPreferences,
        updateNotificationPreferences,
      ]) {
        await expect(callPreferenceHandler(fn, f.ctx)).rejects.toThrow(
          identity === null ? "Unauthorized" : "User not found",
        );
      }
      expect(f.patch).not.toHaveBeenCalled();
      expect(f.insert).not.toHaveBeenCalled();
    },
  );
});
