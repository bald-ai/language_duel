import { ConvexError, v } from "convex/values";
import {
  internalQuery,
  type ActionCtx,
} from "../_generated/server";
import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import {
  formatScheduledTimeForEmail,
  type NotificationEmailTrigger,
} from "../../lib/notificationPreferences";
import { type EmailData } from "../../lib/notificationTemplates";
import { formatVisibleUser } from "../../lib/userDisplay";
import { colorPalettes, DEFAULT_THEME_NAME } from "../../lib/appearance";
import { summarizeThemeNames } from "../../lib/sessionItems";
import { getGoalDeleteAt } from "../../lib/weeklyGoals";
import { WEEKLY_GOAL_DAILY_REMINDER_TIMEZONE } from "../../lib/weeklyGoalTiming";
import { getGoalPartnerIdForViewer } from "../weeklyGoals/participants";

// Pure plumbing: get-by-id wrappers so buildEmailData (an action) can read docs
// through queries. Not domain queries — keep them thin.
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
  trigger: NotificationEmailTrigger;
  toUser: Doc<"users">;
  fromUserId?: Id<"users">;
  challengeId?: Id<"challenges">;
  weeklyGoalId?: Id<"weeklyGoals">;
  reminderOffsetMinutes?: number;
  dedupeKey?: string;
};

async function populateSenderData(ctx: ActionCtx, fromUserId: Id<"users">, data: EmailData) {
  const fromUser = await ctx.runQuery(internal.emails.notificationEmailData.getUserById, { id: fromUserId });
  data.senderName = formatVisibleUser(fromUser, "Player");
  data.partnerName = data.senderName;
  const paletteName = fromUser?.selectedColorSet ?? DEFAULT_THEME_NAME;
  const palette = colorPalettes.find((p) => p.name === paletteName) ?? colorPalettes[0];
  data.senderPalette = { bg: palette.bg, primary: palette.primary, accent: palette.accent };
}

async function populateChallengeData(ctx: ActionCtx, challengeId: Id<"challenges">, data: EmailData) {
  const challenge = await ctx.runQuery(internal.emails.notificationEmailData.getChallengeById, { id: challengeId });
  if (!challenge) return;
  const themes = await Promise.all(challenge.themeIds.map((id) =>
    ctx.runQuery(internal.emails.notificationEmailData.getThemeById, { id })
  ));
  const themeNames = themes.map((theme) => theme?.name)
    .filter((name): name is string => typeof name === "string");
  if (themeNames.length > 0) data.themeName = summarizeThemeNames(themeNames);
}

const SHARED_GOAL_TRIGGERS: readonly NotificationEmailTrigger[] = [
  "weekly_goal_invite", "weekly_goal_locked", "weekly_goal_accepted",
];
const SOLO_REMINDER_TRIGGERS: readonly NotificationEmailTrigger[] = [
  "weekly_goal_daily_reminder", "weekly_goal_reminder_1", "weekly_goal_reminder_2",
  "weekly_goal_grace_period_reminder",
];

function validateGoalEmailTrigger(goal: Doc<"weeklyGoals">, args: BuildEmailArgs) {
  if (goal.mode !== "solo") return;
  if (SHARED_GOAL_TRIGGERS.includes(args.trigger)) {
    throw new ConvexError({ code: "INVALID_STATE",
      message: `solo goal hit shared-only email trigger '${args.trigger}'` });
  }
  if (SOLO_REMINDER_TRIGGERS.includes(args.trigger) && args.fromUserId !== undefined) {
    throw new ConvexError({ code: "INVALID_STATE",
      message: `solo goal reminder '${args.trigger}' cannot have fromUserId` });
  }
}

function populateGoalDeadlines(goal: Doc<"weeklyGoals">, trigger: NotificationEmailTrigger, data: EmailData) {
  if (!goal.endDate) return;
  data.scheduledTime = formatScheduledTimeForEmail(goal.endDate, WEEKLY_GOAL_DAILY_REMINDER_TIMEZONE);
  data.hoursLeft = Math.max(0, Math.round((goal.endDate - Date.now()) / (60 * 60 * 1000)));
  if (trigger === "weekly_goal_grace_period_reminder") {
    const deleteAt = getGoalDeleteAt(goal.endDate);
    if (deleteAt) {
      data.deleteAt = formatScheduledTimeForEmail(deleteAt, WEEKLY_GOAL_DAILY_REMINDER_TIMEZONE);
      data.graceHoursLeft = Math.max(0, Math.ceil((deleteAt - Date.now()) / (60 * 60 * 1000)));
    }
  }
}

async function populateGoalData(ctx: ActionCtx, goal: Doc<"weeklyGoals">, args: BuildEmailArgs, data: EmailData) {
  data.mode = goal.mode;
  validateGoalEmailTrigger(goal, args);
  const partnerId = getGoalPartnerIdForViewer(goal, args.toUser._id);
  if (partnerId !== undefined) {
    const partner = await ctx.runQuery(internal.emails.notificationEmailData.getUserById, { id: partnerId });
    data.partnerName = partner ? formatVisibleUser(partner, data.partnerName) : data.partnerName;
  }
  data.completedCount = goal.themes.filter((theme) =>
    goal.mode === "solo" ? theme.creatorCompleted
      : args.toUser._id === goal.creatorId ? theme.creatorCompleted : theme.partnerCompleted === true
  ).length;
  data.totalCount = goal.themes.length;
  populateGoalDeadlines(goal, args.trigger, data);
}

export async function buildEmailData(ctx: ActionCtx, args: BuildEmailArgs): Promise<EmailData> {
  const data: EmailData = { recipientName: formatVisibleUser(args.toUser, "Player") };
  if (args.fromUserId) await populateSenderData(ctx, args.fromUserId, data);
  if (args.challengeId) await populateChallengeData(ctx, args.challengeId, data);
  if (args.weeklyGoalId) {
    const goal = await ctx.runQuery(internal.emails.notificationEmailData.getWeeklyGoalById, { id: args.weeklyGoalId });
    if (goal) await populateGoalData(ctx, goal, args, data);
  }
  return data;
}
