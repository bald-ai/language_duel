import { v } from "convex/values";
import {
  internalQuery,
  type ActionCtx,
} from "../_generated/server";
import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import {
  formatScheduledTimeForEmail,
  type NotificationTrigger,
} from "../../lib/notificationPreferences";
import { type EmailData } from "../../lib/notificationTemplates";
import { formatVisibleUser } from "../../lib/userDisplay";
import { colorPalettes, DEFAULT_THEME_NAME } from "../../lib/theme";
import { summarizeThemeNames } from "../../lib/sessionWords";
import { getGoalDeleteAt } from "../../lib/weeklyGoals";
import { WEEKLY_GOAL_DAILY_REMINDER_TIMEZONE } from "../../lib/weeklyGoalTiming";
import { getGoalPartnerIdForViewer } from "../weeklyGoals/participants";

export const getUserById = internalQuery({
  args: { id: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

export const getChallengeById = internalQuery({
  args: { id: v.id("challenges") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

export const getWeeklyGoalById = internalQuery({
  args: { id: v.id("weeklyGoals") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

export const getThemeById = internalQuery({
  args: { id: v.id("themes") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

export type BuildEmailArgs = {
  trigger: NotificationTrigger;
  toUser: Doc<"users">;
  fromUserId?: Id<"users">;
  challengeId?: Id<"challenges">;
  duelId?: Id<"duels">;
  soloPracticeSessionId?: Id<"soloPracticeSessions">;
  weeklyGoalId?: Id<"weeklyGoals">;
  reminderOffsetMinutes?: number;
  dedupeKey?: string;
};

export async function buildEmailData(
  ctx: ActionCtx,
  args: BuildEmailArgs
): Promise<EmailData> {
  const data: EmailData = {
    recipientName: formatVisibleUser(args.toUser, "Player"),
  };

  if (args.fromUserId) {
    const fromUser = await ctx.runQuery(internal.emails.notificationEmailData.getUserById, {
      id: args.fromUserId,
    });
    data.senderName = formatVisibleUser(fromUser, "Player");
    data.partnerName = data.senderName;

    const paletteName = fromUser?.selectedColorSet ?? DEFAULT_THEME_NAME;
    const palette = colorPalettes.find((p) => p.name === paletteName) ?? colorPalettes[0];
    data.senderPalette = { bg: palette.bg, primary: palette.primary, accent: palette.accent };
  }

  if (args.challengeId) {
    const challenge = await ctx.runQuery(internal.emails.notificationEmailData.getChallengeById, {
      id: args.challengeId,
    });
    if (challenge) {
      const themes = await Promise.all(
        challenge.themeIds.map((themeId) =>
          ctx.runQuery(internal.emails.notificationEmailData.getThemeById, { id: themeId })
        )
      );
      const themeNames = themes
        .map((theme) => theme?.name)
        .filter((themeName): themeName is string => typeof themeName === "string");

      if (themeNames.length > 0) {
        data.themeName = summarizeThemeNames(themeNames);
      }
    }
  }

  if (args.weeklyGoalId) {
    const goal = await ctx.runQuery(internal.emails.notificationEmailData.getWeeklyGoalById, {
      id: args.weeklyGoalId,
    });
    if (goal) {
      data.mode = goal.mode;

      if (
        goal.mode === "solo" &&
        (args.trigger === "weekly_goal_invite" ||
          args.trigger === "weekly_goal_locked" ||
          args.trigger === "weekly_goal_accepted")
      ) {
        throw new Error(`INVALID_STATE: solo goal hit shared-only email trigger '${args.trigger}'`);
      }

      if (
        goal.mode === "solo" &&
        (args.trigger === "weekly_goal_daily_reminder" ||
          args.trigger === "weekly_goal_reminder_1" ||
          args.trigger === "weekly_goal_reminder_2" ||
          args.trigger === "weekly_goal_grace_period_reminder") &&
        args.fromUserId !== undefined
      ) {
        throw new Error(`INVALID_STATE: solo goal reminder '${args.trigger}' cannot have fromUserId`);
      }

      const partnerId = getGoalPartnerIdForViewer(goal, args.toUser._id);
      if (partnerId !== undefined) {
        const partner = await ctx.runQuery(internal.emails.notificationEmailData.getUserById, {
          id: partnerId,
        });
        data.partnerName = partner ? formatVisibleUser(partner, data.partnerName) : data.partnerName;
      }
      if (goal.endDate) {
        data.scheduledTime = formatScheduledTimeForEmail(goal.endDate, WEEKLY_GOAL_DAILY_REMINDER_TIMEZONE);
      }
      data.completedCount = goal.themes.filter(
        (theme: { creatorCompleted: boolean; partnerCompleted?: boolean }) =>
          goal.mode === "solo"
            ? theme.creatorCompleted
            : args.toUser._id === goal.creatorId
              ? theme.creatorCompleted
              : theme.partnerCompleted === true
      ).length;
      data.totalCount = goal.themes.length;
      if (goal.endDate) {
        data.hoursLeft = Math.max(
          0,
          Math.round((goal.endDate - Date.now()) / (60 * 60 * 1000))
        );
      }

      if (args.trigger === "weekly_goal_grace_period_reminder" && goal.endDate) {
        const deleteAt = getGoalDeleteAt(goal.endDate);
        if (deleteAt) {
          data.deleteAt = formatScheduledTimeForEmail(deleteAt, WEEKLY_GOAL_DAILY_REMINDER_TIMEZONE);
          data.graceHoursLeft = Math.max(
            0,
            Math.ceil((deleteAt - Date.now()) / (60 * 60 * 1000))
          );
        }
      }
    }
  }

  return data;
}
