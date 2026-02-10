import { type NotificationTrigger } from "./notificationPreferences";

export type SenderPalette = {
  bg: string;
  primary: string;
  accent: string;
};

const DEFAULT_PALETTE: SenderPalette = {
  bg: "#FFF8F1",
  primary: "#FB7185",
  accent: "#22C55E",
};

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
  senderPalette?: SenderPalette;
};

export function getSubjectForTrigger(
  trigger: NotificationTrigger,
  data: EmailData
): string {
  const sender = data.senderName ?? "Someone mysterious";
  switch (trigger) {
    case "immediate_duel_challenge":
      return `${sender} just threw down the gauntlet!`;
    case "scheduled_duel_proposal":
      return `${sender} wants to duel -- you in?`;
    case "scheduled_duel_accepted":
      return `It's on! ${sender} accepted your duel`;
    case "scheduled_duel_counter_proposed":
      return `${sender} says "how about this time instead?"`;
    case "scheduled_duel_declined":
      return `${sender} chickened out of your duel`;
    case "scheduled_duel_canceled":
      return `Duel canceled -- someone got cold feet`;
    case "scheduled_duel_reminder":
      return `${data.minutesBefore ?? 0} min until showdown!`;
    case "scheduled_duel_ready":
      return `${sender} is ready -- are you?`;
    case "weekly_goal_invite":
      return `${sender} dares you to a weekly goal`;
    case "weekly_goal_locked":
      return `${sender} locked the weekly goal`;
    case "weekly_goal_accepted":
      return `${sender} is IN -- weekly goal activated!`;
    case "weekly_goal_declined":
      return `${sender} passed on your goal invite`;
    case "weekly_goal_reminder_1":
      return `Tick tock -- ${data.hoursLeft ?? 0}h left on your goal!`;
    case "weekly_goal_reminder_2":
      return `Last chance! Your weekly goal is almost up`;
    default:
      return "Something's happening on Language Duel";
  }
}

export function getBodyForTrigger(
  trigger: NotificationTrigger,
  data: EmailData
): { heading: string; body: string; cta: string } {
  const sender = data.senderName ?? "Someone";
  const theme = data.themeName ?? "a mystery theme";
  const time = data.scheduledTime ?? "a scheduled time";
  const partner = data.partnerName ?? "your rival";

  switch (trigger) {
    case "immediate_duel_challenge":
      return {
        heading: `${sender} is calling you out!`,
        body: `Think you know <strong>${theme}</strong>? ${sender} doesn't think so. They just challenged you to a duel and the clock is ticking. Don't leave them hanging!`,
        cta: "Open Language Duel",
      };
    case "scheduled_duel_proposal":
      return {
        heading: `A duel has been proposed`,
        body: `${sender} wants to battle you on <strong>${theme}</strong> at <strong>${time}</strong>. You can accept, decline, or counter with a time that works better for you. Ball's in your court.`,
        cta: "Open Language Duel",
      };
    case "scheduled_duel_accepted":
      return {
        heading: `It's official!`,
        body: `Your duel with ${sender} on <strong>${theme}</strong> is locked in for <strong>${time}</strong>. We'll nudge you before it starts so you can warm up those brain cells.`,
        cta: "Open Language Duel",
      };
    case "scheduled_duel_counter_proposed":
      return {
        heading: `Plot twist!`,
        body: `${sender} likes the idea but wants to switch things up: <strong>${theme}</strong> at <strong>${time}</strong>. Does that work for you?`,
        cta: "Open Language Duel",
      };
    case "scheduled_duel_declined":
      return {
        heading: `Well, that's awkward`,
        body: `${sender} declined your duel on <strong>${theme}</strong> at <strong>${time}</strong>. No worries though -- plenty of other rivals out there. Challenge someone else!`,
        cta: "Open Language Duel",
      };
    case "scheduled_duel_canceled":
      return {
        heading: `Duel canceled`,
        body: `The scheduled duel on <strong>${theme}</strong> at <strong>${time}</strong> has been called off. Sometimes plans change -- but your next duel is just a tap away.`,
        cta: "Open Language Duel",
      };
    case "scheduled_duel_reminder":
      return {
        heading: `Showtime is almost here!`,
        body: `Your duel with ${partner} on <strong>${theme}</strong> kicks off at <strong>${time}</strong>. That's just <strong>${data.minutesBefore ?? 0} minutes</strong> from now. Get in there!`,
        cta: "Open Language Duel",
      };
    case "scheduled_duel_ready":
      return {
        heading: `Your opponent is warmed up!`,
        body: `${sender} just hit "Ready" for your duel on <strong>${theme}</strong> at <strong>${time}</strong>. They're waiting for you -- don't keep them hanging!`,
        cta: "Open Language Duel",
      };
    case "weekly_goal_invite":
      return {
        heading: `You've been challenged`,
        body: `${sender} wants to team up (or compete?) on a weekly goal. Think you can keep up? Open the app to see the details and make it official.`,
        cta: "Open Language Duel",
      };
    case "weekly_goal_locked":
      return {
        heading: `Your partner locked in`,
        body: `${sender} just locked their side of the weekly goal. You're at <strong>${data.completedCount ?? 0}/${data.totalCount ?? 0}</strong> themes. Open the app and lock too when you're ready.`,
        cta: "Open Language Duel",
      };
    case "weekly_goal_accepted":
      return {
        heading: `Let's gooo!`,
        body: `${sender} accepted your weekly goal invite! The goal is live and runs until <strong>${time}</strong>. Time to show them what you're made of.`,
        cta: "Open Language Duel",
      };
    case "weekly_goal_declined":
      return {
        heading: `They passed`,
        body: `${sender} declined your weekly goal invite. Their loss! You can always invite someone else who's up for the challenge.`,
        cta: "Open Language Duel",
      };
    case "weekly_goal_reminder_1":
      return {
        heading: `The clock is ticking!`,
        body: `You and ${partner} have <strong>${data.hoursLeft ?? 0} hours</strong> left. You're at <strong>${data.completedCount ?? 0}/${data.totalCount ?? 0}</strong> themes. Don't let this one slip away!`,
        cta: "Open Language Duel",
      };
    case "weekly_goal_reminder_2":
      return {
        heading: `This is it -- final stretch!`,
        body: `Your goal with ${partner} expires soon. You're sitting at <strong>${data.completedCount ?? 0}/${data.totalCount ?? 0}</strong> themes. Sprint to the finish line!`,
        cta: "Open Language Duel",
      };
    default:
      return {
        heading: `Something's up!`,
        body: `There's a new update waiting for you on Language Duel. Hop in and check it out.`,
        cta: "Open Language Duel",
      };
  }
}

export function renderNotificationEmail(
  trigger: NotificationTrigger,
  data: EmailData
): { subject: string; html: string } {
  const subject = getSubjectForTrigger(trigger, data);
  const { heading, body, cta } = getBodyForTrigger(trigger, data);
  const p = data.senderPalette ?? DEFAULT_PALETTE;

  const appUrl =
    process.env.APP_URL ??
    (process.env.NODE_ENV === "production"
      ? "https://app.example.com"
      : "http://localhost:3000");

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${subject}</title>
</head>
<body style="margin: 0; padding: 0; background-color: ${p.bg}; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: ${p.bg};">
    <tr>
      <td align="center" style="padding: 32px 16px;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width: 600px; width: 100%; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.08);">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, ${p.primary}, ${p.accent}); padding: 32px 40px; text-align: center;">
              <h1 style="margin: 0; font-size: 22px; font-weight: 800; color: #ffffff; letter-spacing: -0.3px;">Language Duel</h1>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="background-color: #ffffff; padding: 40px 40px 16px 40px;">
              <h2 style="margin: 0 0 8px 0; font-size: 20px; font-weight: 700; color: ${p.primary};">${heading}</h2>
              <p style="margin: 0 0 4px 0; font-size: 15px; color: #888; font-weight: 500;">Hey ${data.recipientName},</p>
            </td>
          </tr>
          <tr>
            <td style="background-color: #ffffff; padding: 8px 40px 32px 40px;">
              <p style="margin: 0; font-size: 16px; line-height: 1.6; color: #333333;">${body}</p>
            </td>
          </tr>
          <!-- CTA Button -->
          <tr>
            <td style="background-color: #ffffff; padding: 0 40px 40px 40px;" align="center">
              <table role="presentation" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="border-radius: 12px; background: linear-gradient(135deg, ${p.primary}, ${p.accent});">
                    <a href="${appUrl}" target="_blank" style="display: inline-block; padding: 14px 36px; font-size: 16px; font-weight: 700; color: #ffffff; text-decoration: none; border-radius: 12px; letter-spacing: 0.2px;">${cta}</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Divider -->
          <tr>
            <td style="background-color: #ffffff; padding: 0 40px;">
              <div style="height: 1px; background: linear-gradient(90deg, transparent, ${p.primary}33, transparent);"></div>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background-color: #ffffff; padding: 24px 40px 32px 40px; text-align: center; border-radius: 0 0 16px 16px;">
              <p style="margin: 0 0 8px 0; font-size: 13px; color: #999;">Sent with love from <a href="${appUrl}" style="color: ${p.primary}; text-decoration: none; font-weight: 600;">Language Duel</a></p>
              <p style="margin: 0; font-size: 12px; color: #bbb;">You're getting this because someone poked you. Blame them, not us.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return { subject, html };
}
