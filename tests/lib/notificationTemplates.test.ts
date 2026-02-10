import { describe, expect, it } from "vitest";
import { renderNotificationEmail, getSubjectForTrigger } from "@/lib/notificationTemplates";

describe("renderNotificationEmail", () => {
  describe("immediate duel challenge", () => {
    it("renders correct subject and body", () => {
      const data = { recipientName: "Player", senderName: "Challenger", themeName: "Spanish Verbs" };
      const { subject, html } = renderNotificationEmail("immediate_duel_challenge", data);

      expect(subject).toBe("Challenger just threw down the gauntlet!");
      expect(html).toContain("Challenger");
      expect(html).toContain("Spanish Verbs");
      expect(html).toContain("clock is ticking");
    });
  });

  describe("scheduled duel proposal", () => {
    it("renders correct subject and body", () => {
      const data = {
        recipientName: "Player",
        senderName: "Proposer",
        themeName: "French Nouns",
        scheduledTime: "Feb 5, 2026 at 14:00",
      };
      const { subject, html } = renderNotificationEmail("scheduled_duel_proposal", data);

      expect(subject).toBe("Proposer wants to duel -- you in?");
      expect(html).toContain("Proposer");
      expect(html).toContain("French Nouns");
      expect(html).toContain("Feb 5, 2026 at 14:00");
    });
  });

  describe("scheduled duel accepted", () => {
    it("renders correct subject and body", () => {
      const data = {
        recipientName: "Proposer",
        senderName: "Accepter",
        themeName: "German Words",
        scheduledTime: "Feb 6, 2026 at 10:00",
      };
      const { subject, html } = renderNotificationEmail("scheduled_duel_accepted", data);

      expect(subject).toBe("It's on! Accepter accepted your duel");
      expect(html).toContain("Accepter");
      expect(html).toContain("German Words");
    });
  });

  describe("scheduled duel reminder", () => {
    it("renders correct subject and body with minutes", () => {
      const data = {
        recipientName: "Player",
        partnerName: "Opponent",
        themeName: "Italian Phrases",
        scheduledTime: "Feb 7, 2026 at 18:00",
        minutesBefore: 15,
      };
      const { subject, html } = renderNotificationEmail("scheduled_duel_reminder", data);

      expect(subject).toBe("15 min until showdown!");
      expect(html).toContain("Opponent");
      expect(html).toContain("Italian Phrases");
    });
  });

  describe("weekly goal invite", () => {
    it("renders correct subject and body", () => {
      const data = { recipientName: "Partner", senderName: "Inviter" };
      const { subject, html } = renderNotificationEmail("weekly_goal_invite", data);

      expect(subject).toBe("Inviter dares you to a weekly goal");
      expect(html).toContain("Inviter");
      expect(html).toContain("weekly goal");
    });
  });

  describe("weekly goal locked", () => {
    it("renders correct subject and body", () => {
      const data = {
        recipientName: "Partner",
        senderName: "Inviter",
        completedCount: 1,
        totalCount: 5,
      };
      const { subject, html } = renderNotificationEmail("weekly_goal_locked", data);

      expect(subject).toBe("Inviter locked the weekly goal");
      expect(html).toContain("Inviter");
      expect(html).toContain("1/5");
    });
  });

  describe("weekly goal reminder", () => {
    it("renders reminder 1 with hours left and progress", () => {
      const data = {
        recipientName: "Player",
        partnerName: "Partner",
        hoursLeft: 72,
        completedCount: 2,
        totalCount: 5,
      };
      const { subject, html } = renderNotificationEmail("weekly_goal_reminder_1", data);

      expect(subject).toBe("Tick tock -- 72h left on your goal!");
      expect(html).toContain("Partner");
      expect(html).toContain("2/5");
    });

    it("renders reminder 2 as final hours", () => {
      const data = {
        recipientName: "Player",
        partnerName: "Partner",
        hoursLeft: 24,
        completedCount: 3,
        totalCount: 5,
      };
      const { subject, html } = renderNotificationEmail("weekly_goal_reminder_2", data);

      expect(subject).toBe("Last chance! Your weekly goal is almost up");
      expect(html).toContain("3/5");
    });
  });

  describe("all triggers render without error", () => {
    const triggers = [
      "immediate_duel_challenge",
      "scheduled_duel_proposal",
      "scheduled_duel_accepted",
      "scheduled_duel_counter_proposed",
      "scheduled_duel_declined",
      "scheduled_duel_canceled",
      "scheduled_duel_reminder",
      "weekly_goal_invite",
      "weekly_goal_locked",
      "weekly_goal_accepted",
      "weekly_goal_declined",
      "weekly_goal_reminder_1",
      "weekly_goal_reminder_2",
    ] as const;

    it.each(triggers)("%s renders without throwing", (trigger) => {
      const data = {
        recipientName: "Test",
        senderName: "Sender",
        themeName: "Theme",
        scheduledTime: "Feb 1, 2026",
        hoursLeft: 24,
        completedCount: 1,
        totalCount: 3,
        partnerName: "Partner",
        minutesBefore: 15,
      };
      expect(() => renderNotificationEmail(trigger, data)).not.toThrow();
    });
  });
});

describe("getSubjectForTrigger", () => {
  it("uses sender name in subject when available", () => {
    const subject = getSubjectForTrigger("immediate_duel_challenge", { senderName: "Alice", recipientName: "User" });
    expect(subject).toContain("Alice");
  });
});
