import { afterEach, describe, expect, it, vi } from "vitest";
import { renderNotificationEmail, getSubjectForTrigger } from "@/lib/notificationTemplates";

describe("renderNotificationEmail", () => {
  const originalAppUrl = process.env.APP_URL;

  afterEach(() => {
    vi.unstubAllEnvs();
    if (originalAppUrl === undefined) {
      delete process.env.APP_URL;
    } else {
      process.env.APP_URL = originalAppUrl;
    }
  });

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
    it("renders the daily countdown reminder with clean milestone copy", () => {
      const data = {
        recipientName: "Player",
        partnerName: "Partner",
        completedCount: 2,
        totalCount: 5,
        hoursLeft: 72,
        scheduledTime: "Apr 30, 2026 at 23:59",
      };
      const { subject, html } = renderNotificationEmail("weekly_goal_daily_reminder", data);

      expect(subject).toBe("72h left on your weekly goal");
      expect(html).toContain("Weekly goal countdown");
      expect(html).toContain("Apr 30, 2026 at 23:59");
      expect(html).toContain("2/5");
    });

    it("renders the draft expiry reminder", () => {
      const data = {
        recipientName: "Player",
      };
      const { subject, html } = renderNotificationEmail("weekly_goal_draft_expiring", data);

      expect(subject).toBe("Your weekly goal draft expires in 24 hours");
      expect(html).toContain("Draft expires soon");
      expect(html).toContain("Lock it or it will be removed");
    });

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

    it("renders the grace period delete reminder with finish-it-now copy", () => {
      const data = {
        recipientName: "Player",
        partnerName: "Partner",
        graceHoursLeft: 24,
        deleteAt: "Apr 26, 2026 at 14:00",
        completedCount: 3,
        totalCount: 5,
      };
      const { subject, html } = renderNotificationEmail("weekly_goal_expired_delete_reminder", data);

      expect(subject).toBe("Still time left -- 24h to save this goal");
      expect(html).toContain("grace period");
      expect(html).toContain("still have");
      expect(html).toContain("defeat the boss");
      expect(html).toContain("Apr 26, 2026 at 14:00");
      expect(html).toContain("3/5");
    });
  });

  describe("all triggers render without error", () => {
    const triggers = [
      "immediate_duel_challenge",
      "scheduled_duel_proposal",
      "scheduled_duel_reminder",
      "weekly_goal_invite",
      "weekly_goal_locked",
      "weekly_goal_accepted",
      "weekly_goal_daily_reminder",
      "weekly_goal_draft_expiring",
      "weekly_goal_expired_delete_reminder",
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

  describe("email safety", () => {
    it("escapes user-controlled HTML while keeping template markup", () => {
      const { html } = renderNotificationEmail("scheduled_duel_reminder", {
        recipientName: "<img src=x onerror=alert(1)>",
        partnerName: "<b>Partner</b>",
        themeName: "<script>alert(1)</script>",
        scheduledTime: "Feb 7, 2026 at 18:00",
        minutesBefore: 15,
      });

      expect(html).toContain("&lt;img src=x onerror=alert(1)&gt;");
      expect(html).toContain("&lt;b&gt;Partner&lt;/b&gt;");
      expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
      expect(html).toContain("<strong>");
      expect(html).not.toContain("<script>alert(1)</script>");
    });

    it("throws in production when APP_URL is missing", () => {
      delete process.env.APP_URL;
      vi.stubEnv("NODE_ENV", "production");

      expect(() =>
        renderNotificationEmail("weekly_goal_draft_expiring", {
          recipientName: "Player",
        })
      ).toThrow("APP_URL must be set in production");
    });

    it("keeps the localhost fallback outside production", () => {
      delete process.env.APP_URL;
      vi.stubEnv("NODE_ENV", "development");

      const { html } = renderNotificationEmail("weekly_goal_draft_expiring", {
        recipientName: "Player",
      });

      expect(html).toContain("http://localhost:3000");
      expect(html).not.toContain("app.example.com");
    });
  });
});

describe("getSubjectForTrigger", () => {
  it("uses sender name in subject when available", () => {
    const subject = getSubjectForTrigger("immediate_duel_challenge", { senderName: "Alice", recipientName: "User" });
    expect(subject).toContain("Alice");
  });
});
