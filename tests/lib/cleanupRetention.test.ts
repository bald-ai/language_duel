import { describe, expect, it } from "vitest";
import {
  DISMISSABLE_NOTIFICATION_TYPES,
  isDismissedNotificationPastRetention,
  isEmailLogPastRetention,
  isResolvedFriendRequestPastRetention,
  isTimestampPastRetention,
} from "@/lib/cleanupRetention";

describe("cleanupRetention", () => {
  it("includes known important notification types that support dismissed-row cleanup", () => {
    expect(DISMISSABLE_NOTIFICATION_TYPES).toEqual(
      expect.arrayContaining([
        "friend_request",
        "weekly_goal_invitation",
        "weekly_goal_draft_expiring",
        "challenge_invite",
      ])
    );
    expect(DISMISSABLE_NOTIFICATION_TYPES.length).toBeGreaterThanOrEqual(4);
  });

  it("treats timestamps at the TTL boundary as expired", () => {
    expect(isTimestampPastRetention(1_000, 8_000, 7_000)).toBe(true);
    expect(isTimestampPastRetention(1_001, 8_000, 7_000)).toBe(false);
  });

  it("expires dismissed notifications based on createdAt", () => {
    expect(
      isDismissedNotificationPastRetention(
        { status: "dismissed", createdAt: 1_000 },
        8 * 24 * 60 * 60 * 1000,
        7 * 24 * 60 * 60 * 1000
      )
    ).toBe(true);

    expect(
      isDismissedNotificationPastRetention(
        { status: "read", createdAt: 1_000 },
        8 * 24 * 60 * 60 * 1000,
        7 * 24 * 60 * 60 * 1000
      )
    ).toBe(false);
  });

  it("expires resolved friend requests based on createdAt", () => {
    expect(
      isResolvedFriendRequestPastRetention(
        { status: "accepted", createdAt: 1_000 },
        8 * 24 * 60 * 60 * 1000,
        7 * 24 * 60 * 60 * 1000
      )
    ).toBe(true);

    expect(
      isResolvedFriendRequestPastRetention(
        { status: "pending", createdAt: 1_000 },
        8 * 24 * 60 * 60 * 1000,
        7 * 24 * 60 * 60 * 1000
      )
    ).toBe(false);
  });

  it("expires email logs based on sentAt", () => {
    expect(
      isEmailLogPastRetention(
        { sentAt: 1_000 },
        31 * 24 * 60 * 60 * 1000,
        30 * 24 * 60 * 60 * 1000
      )
    ).toBe(true);
  });

});
