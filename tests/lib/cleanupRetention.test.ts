import { describe, expect, it } from "vitest";
import {
  DISMISSABLE_NOTIFICATION_TYPES,
  isDismissedNotificationPastRetention,
  isEmailLogPastRetention,
  isResolvedFriendRequestPastRetention,
  isStartedScheduledDuelPastRetention,
  isTerminalScheduledDuelPastRetention,
  isTerminalScheduledDuelStatus,
  isTimestampPastRetention,
} from "@/lib/cleanupRetention";

describe("cleanupRetention", () => {
  it("recognizes the notification types that support dismissed-row cleanup", () => {
    expect(DISMISSABLE_NOTIFICATION_TYPES).toEqual([
      "friend_request",
      "weekly_plan_invitation",
      "scheduled_duel",
      "duel_challenge",
    ]);
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

  it("recognizes terminal scheduled duel statuses", () => {
    expect(isTerminalScheduledDuelStatus("declined")).toBe(true);
    expect(isTerminalScheduledDuelStatus("cancelled")).toBe(true);
    expect(isTerminalScheduledDuelStatus("expired")).toBe(true);
    expect(isTerminalScheduledDuelStatus("accepted")).toBe(false);
  });

  it("expires terminal scheduled duels based on updatedAt", () => {
    expect(
      isTerminalScheduledDuelPastRetention(
        { status: "expired", updatedAt: 1_000 },
        15 * 24 * 60 * 60 * 1000,
        14 * 24 * 60 * 60 * 1000
      )
    ).toBe(true);

    expect(
      isTerminalScheduledDuelPastRetention(
        { status: "accepted", updatedAt: 1_000 },
        15 * 24 * 60 * 60 * 1000,
        14 * 24 * 60 * 60 * 1000
      )
    ).toBe(false);
  });

  it("expires started scheduled duels only after they have a started duel id", () => {
    expect(
      isStartedScheduledDuelPastRetention(
        {
          status: "accepted",
          startedDuelId: "challenge_1",
          updatedAt: 1_000,
        },
        15 * 24 * 60 * 60 * 1000,
        14 * 24 * 60 * 60 * 1000
      )
    ).toBe(true);

    expect(
      isStartedScheduledDuelPastRetention(
        {
          status: "accepted",
          updatedAt: 1_000,
        },
        15 * 24 * 60 * 60 * 1000,
        14 * 24 * 60 * 60 * 1000
      )
    ).toBe(false);
  });
});
