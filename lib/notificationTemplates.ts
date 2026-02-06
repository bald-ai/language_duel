import { type NotificationTrigger } from "./notificationPreferences";

export type EmailData = {
  recipientName: string;
  senderName?: string;
  themeName?: string;
  scheduledTime?: string;
  hoursLeft?: number;
  completedCount?: number;
  totalCount?: number;
  partnerName?: string;
  minutesBefore?: number;
};

export function getSubjectForTrigger(
  trigger: NotificationTrigger,
  data: EmailData
): string {
  switch (trigger) {
    case "immediate_duel_challenge":
      return `${data.senderName ?? "Someone"} challenged you to a duel!`;
    case "scheduled_duel_proposal":
      return `${data.senderName ?? "Someone"} wants to schedule a duel`;
    case "scheduled_duel_accepted":
      return `${data.senderName ?? "Someone"} confirmed your duel!`;
    case "scheduled_duel_counter_proposed":
      return `${data.senderName ?? "Someone"} suggested a new time`;
    case "scheduled_duel_declined":
      return `${data.senderName ?? "Someone"} declined your duel`;
    case "scheduled_duel_canceled":
      return "Scheduled duel canceled";
    case "scheduled_duel_reminder":
      return `Your duel starts in ${data.minutesBefore ?? 0} minutes!`;
    case "weekly_goal_invite":
      return `${data.senderName ?? "Someone"} invited you to a weekly goal`;
    case "weekly_goal_accepted":
      return `${data.senderName ?? "Someone"} joined your weekly goal!`;
    case "weekly_goal_declined":
      return `${data.senderName ?? "Someone"} declined your goal invite`;
    case "weekly_goal_reminder_1":
      return `${data.hoursLeft ?? 0} hours left on your weekly goal!`;
    case "weekly_goal_reminder_2":
      return "Final hours for your weekly goal!";
    default:
      return "Language Duel Notification";
  }
}

export function getBodyForTrigger(
  trigger: NotificationTrigger,
  data: EmailData
): string {
  switch (trigger) {
    case "immediate_duel_challenge":
      return `${data.senderName ?? "Someone"} wants to duel you right now on <strong>${data.themeName ?? "a theme"}</strong>. Open the app to accept before the challenge expires.`;
    case "scheduled_duel_proposal":
      return `${data.senderName ?? "Someone"} proposed a duel on <strong>${data.themeName ?? "a theme"}</strong> at <strong>${data.scheduledTime ?? "a scheduled time"}</strong>. Open the app to accept, decline, or suggest a different time.`;
    case "scheduled_duel_accepted":
      return `Your scheduled duel on <strong>${data.themeName ?? "a theme"}</strong> with ${data.senderName ?? "your opponent"} is set for <strong>${data.scheduledTime ?? "a scheduled time"}</strong>. We'll remind you before it starts.`;
    case "scheduled_duel_counter_proposed":
      return `${data.senderName ?? "Someone"} counter-proposed your duel: <strong>${data.themeName ?? "a theme"}</strong> at <strong>${data.scheduledTime ?? "a scheduled time"}</strong>. Open the app to accept or suggest another time.`;
    case "scheduled_duel_declined":
      return `${data.senderName ?? "Someone"} declined your scheduled duel on <strong>${data.themeName ?? "a theme"}</strong> at <strong>${data.scheduledTime ?? "a scheduled time"}</strong>. You can challenge them again anytime.`;
    case "scheduled_duel_canceled":
      return `${data.senderName ?? "Someone"} canceled your scheduled duel on <strong>${data.themeName ?? "a theme"}</strong> at <strong>${data.scheduledTime ?? "a scheduled time"}</strong>.`;
    case "scheduled_duel_reminder":
      return `Get ready! Your duel with ${data.partnerName ?? "your opponent"} on <strong>${data.themeName ?? "a theme"}</strong> starts at <strong>${data.scheduledTime ?? "a scheduled time"}</strong>. Open the app to join.`;
    case "weekly_goal_invite":
      return `${data.senderName ?? "Someone"} wants to start a weekly goal with you. Open the app to view and customize the goal together.`;
    case "weekly_goal_accepted":
      return `${data.senderName ?? "Someone"} accepted your weekly goal invite. The goal is now active and ends on <strong>${data.scheduledTime ?? "its deadline"}</strong>.`;
    case "weekly_goal_declined":
      return `${data.senderName ?? "Someone"} declined your weekly goal invite. You can invite someone else or try again later.`;
    case "weekly_goal_reminder_1":
      return `Your goal with ${data.partnerName ?? "your partner"} ends in ${data.hoursLeft ?? 0} hours. You're at <strong>${data.completedCount ?? 0}/${data.totalCount ?? 0}</strong> themes. Keep going!`;
    case "weekly_goal_reminder_2":
      return `Your goal with ${data.partnerName ?? "your partner"} ends soon. You're at <strong>${data.completedCount ?? 0}/${data.totalCount ?? 0}</strong> themes. Finish strong!`;
    default:
      return "Open the app to view the latest update.";
  }
}

export function renderNotificationEmail(
  trigger: NotificationTrigger,
  data: EmailData
): { subject: string; html: string } {
  const subject = getSubjectForTrigger(trigger, data);
  const body = getBodyForTrigger(trigger, data);

  const appUrl =
    process.env.APP_URL ??
    (process.env.NODE_ENV === "production"
      ? "https://app.example.com"
      : "http://localhost:3000");

  const html = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
      <h1 style="color: #333;">Hi ${data.recipientName},</h1>
      <p>${body}</p>
      <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
      <p style="color: #666; font-size: 12px;">
        <a href="${appUrl}" style="color: #666;">
          Open Language Duel
        </a>
      </p>
    </div>
  `;

  return { subject, html };
}
