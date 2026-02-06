# Email Notifications Implementation Plan

## Overview

Implement email notifications for duels and weekly goals with per-user customization. Users can toggle notification types on/off and configure reminder timing. Default: all enabled (opt-out model).

---

## 1. Email Triggers (12 Total)

### 🎯 Immediate Duels (1 trigger)

| # | Trigger | Recipient | Subject Template |
|---|---------|-----------|------------------|
| 1 | Challenge received | Player B | "{{challengerName}} challenged you to a duel!" |

**Body:** `{{challengerName}} wants to duel you right now on **{{themeName}}**. Open the app to accept before the challenge expires.`

### 📅 Scheduled Duels (6 triggers)

| # | Trigger | Recipient | Subject Template |
|---|---------|-----------|------------------|
| 2 | Proposal received | Player B | "{{proposerName}} wants to schedule a duel" |
| 3 | Accepted | Player A | "{{accepterName}} confirmed your duel!" |
| 4 | Counter-proposed | Player A | "{{counterProposerName}} suggested a new time" |
| 5 | Declined | Player A | "{{declinerName}} declined your duel" |
| 6 | Canceled | Other party | "Scheduled duel canceled" |
| 7 | Reminder | Both players | "Your duel starts in {{minutesBefore}} minutes!" |

**Bodies:**
- **Proposal:** `{{proposerName}} proposed a duel on **{{themeName}}** at **{{scheduledTime}}**. Open the app to accept, decline, or suggest a different time.`
- **Accepted:** `Your scheduled duel on **{{themeName}}** with {{accepterName}} is set for **{{scheduledTime}}**. We'll remind you before it starts.`
- **Counter-proposed:** `{{counterProposerName}} counter-proposed your duel: **{{themeName}}** at **{{newScheduledTime}}**. Open the app to accept or suggest another time.`
- **Declined:** `{{declinerName}} declined your scheduled duel on **{{themeName}}** at **{{scheduledTime}}**. You can challenge them again anytime.`
- **Canceled:** `{{cancellerName}} canceled your scheduled duel on **{{themeName}}** at **{{scheduledTime}}.`
- **Reminder:** `Get ready! Your duel with {{opponentName}} on **{{themeName}}** starts at **{{scheduledTime}}**. Open the app to join.`

### 🎯 Weekly Goals (5 triggers)

| # | Trigger | Recipient | Subject Template |
|---|---------|-----------|------------------|
| 8 | Invite received | Player B | "{{inviterName}} invited you to a weekly goal" |
| 9 | Invite accepted | Player A | "{{accepterName}} joined your weekly goal!" |
| 10 | Invite declined | Player A | "{{declinerName}} declined your goal invite" |
| 11 | Reminder 1 (e.g., 72h) | Both players | "{{hoursLeft}} hours left on your weekly goal!" |
| 12 | Reminder 2 (e.g., 24h) | Both players | "Final hours for your weekly goal!" |

**Bodies:**
- **Invite received:** `{{inviterName}} wants to start a weekly goal with you. Open the app to view and customize the goal together.`
- **Invite accepted:** `{{accepterName}} accepted your weekly goal invite. The goal is now active and ends on **{{expiresAt}}**.`
- **Invite declined:** `{{declinerName}} declined your weekly goal invite. You can invite someone else or try again later.`
- **Reminder 1:** `Your goal with {{partnerName}} ends in {{hoursLeft}} hours. You're at **{{completedCount}}/{{totalCount}}** themes. Keep going!`
- **Reminder 2:** `Your goal with {{partnerName}} ends soon. You're at **{{completedCount}}/{{totalCount}}** themes. Finish strong!`

---

## 2. Schema Design

### 2.1 `notificationPreferences` Table

**Location:** `convex/schema.ts`

```typescript
notificationPreferences: defineTable({
  userId: v.id("users"),
  
  // Immediate Duels
  immediateDuelsEnabled: v.boolean(),
  immediateDuelChallengeEnabled: v.boolean(),
  
  // Scheduled Duels
  scheduledDuelsEnabled: v.boolean(),
  scheduledDuelProposalEnabled: v.boolean(),
  scheduledDuelAcceptedEnabled: v.boolean(),
  scheduledDuelCounterProposedEnabled: v.boolean(),
  scheduledDuelDeclinedEnabled: v.boolean(),
  scheduledDuelCanceledEnabled: v.boolean(),
  scheduledDuelReminderEnabled: v.boolean(),
  scheduledDuelReminderOffsetMinutes: v.number(), // e.g., 15
  
  // Weekly Goals
  weeklyGoalsEnabled: v.boolean(),
  weeklyGoalInviteEnabled: v.boolean(),
  weeklyGoalAcceptedEnabled: v.boolean(),
  weeklyGoalDeclinedEnabled: v.boolean(),
  weeklyGoalReminder1Enabled: v.boolean(),
  weeklyGoalReminder1OffsetMinutes: v.number(), // e.g., 4320 (72h)
  weeklyGoalReminder2Enabled: v.boolean(),
  weeklyGoalReminder2OffsetMinutes: v.number(), // e.g., 1440 (24h)
  
  updatedAt: v.number(),
})
.index("by_userId", ["userId"])
```

**Default Values (when no row exists):**
```typescript
const DEFAULT_NOTIFICATION_PREFS = {
  immediateDuelsEnabled: true,
  immediateDuelChallengeEnabled: true,
  
  scheduledDuelsEnabled: true,
  scheduledDuelProposalEnabled: true,
  scheduledDuelAcceptedEnabled: true,
  scheduledDuelCounterProposedEnabled: true,
  scheduledDuelDeclinedEnabled: true,
  scheduledDuelCanceledEnabled: true,
  scheduledDuelReminderEnabled: true,
  scheduledDuelReminderOffsetMinutes: 15,
  
  weeklyGoalsEnabled: true,
  weeklyGoalInviteEnabled: true,
  weeklyGoalAcceptedEnabled: true,
  weeklyGoalDeclinedEnabled: true,
  weeklyGoalReminder1Enabled: true,
  weeklyGoalReminder1OffsetMinutes: 4320, // 72 hours
  weeklyGoalReminder2Enabled: true,
  weeklyGoalReminder2OffsetMinutes: 1440, // 24 hours
};
```

### 2.2 `emailNotificationLog` Table

**Purpose:** Idempotency — prevent duplicate emails on retries/cron overlap.

```typescript
emailNotificationLog: defineTable({
  toUserId: v.id("users"),
  trigger: v.string(), // e.g., "scheduled_duel_reminder"
  
  // Entity references (optional, one per email)
  challengeId: v.optional(v.id("challenges")),
  scheduledDuelId: v.optional(v.id("scheduledDuels")),
  weeklyGoalId: v.optional(v.id("weeklyGoals")),
  
  // For reminders: which offset was this for (to allow multiple reminders per entity)
  reminderOffsetMinutes: v.optional(v.number()),
  
  sentAt: v.number(),
})
.index("by_user_trigger_scheduledDuel", ["toUserId", "trigger", "scheduledDuelId"])
.index("by_user_trigger_weeklyGoal", ["toUserId", "trigger", "weeklyGoalId"])
.index("by_user_trigger_challenge", ["toUserId", "trigger", "challengeId"])
```

---

## 3. Preference APIs

**Location:** `convex/notificationPreferences.ts`

### 3.1 Query: Get My Preferences

```typescript
export const getMyNotificationPreferences = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthenticatedUserId(ctx);
    
    const prefs = await ctx.db
      .query("notificationPreferences")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .unique();
    
    if (!prefs) {
      return { ...DEFAULT_NOTIFICATION_PREFS, userId, isDefault: true };
    }
    
    return { ...prefs, isDefault: false };
  },
});
```

### 3.2 Mutation: Set My Preferences

```typescript
export const setMyNotificationPreferences = mutation({
  args: {
    immediateDuelsEnabled: v.boolean(),
    immediateDuelChallengeEnabled: v.boolean(),
    // ... all fields
  },
  handler: async (ctx, args) => {
    const userId = await getAuthenticatedUserId(ctx);
    
    // Validate offsets (1 minute to 7 days)
    const MIN_OFFSET = 1;
    const MAX_OFFSET = 7 * 24 * 60; // 10080 minutes
    
    if (args.scheduledDuelReminderOffsetMinutes < MIN_OFFSET || 
        args.scheduledDuelReminderOffsetMinutes > MAX_OFFSET) {
      throw new Error("Invalid scheduled duel reminder offset");
    }
    // ... validate other offsets
    
    const existing = await ctx.db
      .query("notificationPreferences")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .unique();
    
    if (existing) {
      await ctx.db.patch(existing._id, { ...args, updatedAt: Date.now() });
    } else {
      await ctx.db.insert("notificationPreferences", {
        userId,
        ...args,
        updatedAt: Date.now(),
      });
    }
  },
});
```

---

## 4. Email Sending Infrastructure

### 4.1 Central Send Action

**Location:** `convex/emails/notificationEmails.ts`

```typescript
import { internalAction } from "../_generated/server";
import { internal } from "../_generated/api";

// Trigger type union
export type NotificationTrigger =
  | "immediate_duel_challenge"
  | "scheduled_duel_proposal"
  | "scheduled_duel_accepted"
  | "scheduled_duel_counter_proposed"
  | "scheduled_duel_declined"
  | "scheduled_duel_canceled"
  | "scheduled_duel_reminder"
  | "weekly_goal_invite"
  | "weekly_goal_accepted"
  | "weekly_goal_declined"
  | "weekly_goal_reminder_1"
  | "weekly_goal_reminder_2";

export const sendNotificationEmail = internalAction({
  args: {
    trigger: v.string(),
    toUserId: v.id("users"),
    fromUserId: v.optional(v.id("users")),
    challengeId: v.optional(v.id("challenges")),
    scheduledDuelId: v.optional(v.id("scheduledDuels")),
    weeklyGoalId: v.optional(v.id("weeklyGoals")),
    reminderOffsetMinutes: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // 1. Load recipient user
    const toUser = await ctx.runQuery(internal.users.getById, { id: args.toUserId });
    if (!toUser?.email) return { sent: false, reason: "no_email" };
    
    // 2. Load notification preferences
    const prefs = await ctx.runQuery(
      internal.notificationPreferences.getByUserId,
      { userId: args.toUserId }
    );
    
    // 3. Check if enabled (hierarchy: category + trigger)
    if (!isNotificationEnabled(args.trigger, prefs)) {
      return { sent: false, reason: "disabled_by_user" };
    }
    
    // 4. Check idempotency log
    const alreadySent = await ctx.runQuery(
      internal.emails.checkNotificationSent,
      {
        toUserId: args.toUserId,
        trigger: args.trigger,
        challengeId: args.challengeId,
        scheduledDuelId: args.scheduledDuelId,
        weeklyGoalId: args.weeklyGoalId,
        reminderOffsetMinutes: args.reminderOffsetMinutes,
      }
    );
    if (alreadySent) {
      return { sent: false, reason: "already_sent" };
    }
    
    // 5. Load entity data and render email
    const emailData = await buildEmailData(ctx, args);
    const { subject, body } = renderNotificationEmail(args.trigger, emailData);
    
    // 6. Send via existing Resend action
    await ctx.runAction(internal.emails.internalSendEmail, {
      to: toUser.email,
      subject,
      html: body,
    });
    
    // 7. Log send for idempotency
    await ctx.runMutation(internal.emails.logNotificationSent, {
      toUserId: args.toUserId,
      trigger: args.trigger,
      challengeId: args.challengeId,
      scheduledDuelId: args.scheduledDuelId,
      weeklyGoalId: args.weeklyGoalId,
      reminderOffsetMinutes: args.reminderOffsetMinutes,
    });
    
    return { sent: true };
  },
});

// Helper: Check if notification is enabled based on hierarchy
function isNotificationEnabled(
  trigger: string,
  prefs: NotificationPreferences
): boolean {
  const mapping: Record<string, { category: keyof NotificationPreferences; trigger: keyof NotificationPreferences }> = {
    immediate_duel_challenge: { category: "immediateDuelsEnabled", trigger: "immediateDuelChallengeEnabled" },
    scheduled_duel_proposal: { category: "scheduledDuelsEnabled", trigger: "scheduledDuelProposalEnabled" },
    scheduled_duel_accepted: { category: "scheduledDuelsEnabled", trigger: "scheduledDuelAcceptedEnabled" },
    scheduled_duel_counter_proposed: { category: "scheduledDuelsEnabled", trigger: "scheduledDuelCounterProposedEnabled" },
    scheduled_duel_declined: { category: "scheduledDuelsEnabled", trigger: "scheduledDuelDeclinedEnabled" },
    scheduled_duel_canceled: { category: "scheduledDuelsEnabled", trigger: "scheduledDuelCanceledEnabled" },
    scheduled_duel_reminder: { category: "scheduledDuelsEnabled", trigger: "scheduledDuelReminderEnabled" },
    weekly_goal_invite: { category: "weeklyGoalsEnabled", trigger: "weeklyGoalInviteEnabled" },
    weekly_goal_accepted: { category: "weeklyGoalsEnabled", trigger: "weeklyGoalAcceptedEnabled" },
    weekly_goal_declined: { category: "weeklyGoalsEnabled", trigger: "weeklyGoalDeclinedEnabled" },
    weekly_goal_reminder_1: { category: "weeklyGoalsEnabled", trigger: "weeklyGoalReminder1Enabled" },
    weekly_goal_reminder_2: { category: "weeklyGoalsEnabled", trigger: "weeklyGoalReminder2Enabled" },
  };
  
  const config = mapping[trigger];
  if (!config) return false;
  
  return prefs[config.category] === true && prefs[config.trigger] === true;
}
```

---

## 5. Trigger Injection Points

### 5.1 Immediate Duels

**File:** `convex/lobby.ts` (or wherever challenge is created)

**Location:** After challenge is created and in-app notification is inserted.

```typescript
// After: await ctx.db.insert("challenges", { ... });
// After: await ctx.db.insert("notifications", { type: "duel_challenge", ... });

ctx.scheduler.runAfter(0, internal.emails.sendNotificationEmail, {
  trigger: "immediate_duel_challenge",
  toUserId: opponentId,
  fromUserId: challengerId,
  challengeId: newChallengeId,
});
```

### 5.2 Scheduled Duels

**File:** `convex/scheduledDuels.ts`

#### proposeScheduledDuel (line ~167-253)
```typescript
// After: const scheduledDuelId = await ctx.db.insert("scheduledDuels", { ... });

ctx.scheduler.runAfter(0, internal.emails.sendNotificationEmail, {
  trigger: "scheduled_duel_proposal",
  toUserId: recipientId,
  fromUserId: proposerId,
  scheduledDuelId,
});
```

#### acceptScheduledDuel (line ~258-345)
```typescript
// After: await ctx.db.patch(scheduledDuelId, { status: "accepted", ... });

ctx.scheduler.runAfter(0, internal.emails.sendNotificationEmail, {
  trigger: "scheduled_duel_accepted",
  toUserId: proposerId, // notify the original proposer
  fromUserId: accepterId,
  scheduledDuelId,
});
```

#### counterProposeScheduledDuel (line ~350-463)
```typescript
// After: await ctx.db.patch(scheduledDuelId, { status: "counter_proposed", ... });

ctx.scheduler.runAfter(0, internal.emails.sendNotificationEmail, {
  trigger: "scheduled_duel_counter_proposed",
  toUserId: originalProposerId, // notify the other party
  fromUserId: counterProposerId,
  scheduledDuelId,
});
```

#### declineScheduledDuel (line ~468-523)
```typescript
// After: await ctx.db.patch(scheduledDuelId, { status: "declined", ... });

ctx.scheduler.runAfter(0, internal.emails.sendNotificationEmail, {
  trigger: "scheduled_duel_declined",
  toUserId: proposerId, // notify the proposer
  fromUserId: declinerId,
  scheduledDuelId,
});
```

#### cancelScheduledDuel (line ~530-604)
```typescript
// After: await ctx.db.patch(scheduledDuelId, { status: "cancelled", ... });

// Determine the other party
const otherUserId = cancellerId === proposerId ? recipientId : proposerId;

ctx.scheduler.runAfter(0, internal.emails.sendNotificationEmail, {
  trigger: "scheduled_duel_canceled",
  toUserId: otherUserId,
  fromUserId: cancellerId,
  scheduledDuelId,
});
```

### 5.3 Weekly Goals

**File:** `convex/weeklyGoals.ts`

#### Goal Invite (when partner is invited)
```typescript
// After: goal is created with partner invited

ctx.scheduler.runAfter(0, internal.emails.sendNotificationEmail, {
  trigger: "weekly_goal_invite",
  toUserId: partnerId,
  fromUserId: creatorId,
  weeklyGoalId,
});
```

#### Goal Invite Accepted (when partner locks/accepts)
```typescript
// After: partner locks and goal becomes active

ctx.scheduler.runAfter(0, internal.emails.sendNotificationEmail, {
  trigger: "weekly_goal_accepted",
  toUserId: creatorId, // notify the creator
  fromUserId: partnerId,
  weeklyGoalId,
});
```

#### Goal Invite Declined (if partner declines/dismisses)
```typescript
// After: partner declines the invitation

ctx.scheduler.runAfter(0, internal.emails.sendNotificationEmail, {
  trigger: "weekly_goal_declined",
  toUserId: creatorId,
  fromUserId: partnerId,
  weeklyGoalId,
});
```

---

## 6. Cron Jobs for Reminders

**File:** `convex/crons.ts`

### 6.1 Registration

```typescript
import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Existing crons...

// Scheduled duel reminders - check every 5 minutes
crons.interval(
  "sendScheduledDuelReminders",
  { minutes: 5 },
  internal.emails.sendScheduledDuelReminders,
  {}
);

// Weekly goal reminders - check every hour
crons.interval(
  "sendWeeklyGoalReminders",
  { hours: 1 },
  internal.emails.sendWeeklyGoalReminders,
  {}
);

export default crons;
```

### 6.2 Scheduled Duel Reminder Action

**File:** `convex/emails/reminderCrons.ts`

```typescript
export const sendScheduledDuelReminders = internalAction({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    
    // Get all accepted duels that haven't started yet
    const upcomingDuels = await ctx.runQuery(
      internal.scheduledDuels.getUpcomingAcceptedDuels,
      {}
    );
    
    for (const duel of upcomingDuels) {
      const participants = [duel.proposerId, duel.recipientId];
      
      for (const userId of participants) {
        // Get user's reminder offset preference
        const prefs = await ctx.runQuery(
          internal.notificationPreferences.getByUserId,
          { userId }
        );
        
        const offsetMs = prefs.scheduledDuelReminderOffsetMinutes * 60 * 1000;
        const reminderTime = duel.scheduledTime - offsetMs;
        
        // Check if reminder is due (within 5-minute window)
        const isDue = reminderTime <= now && reminderTime > now - 5 * 60 * 1000;
        
        if (isDue) {
          await ctx.runAction(internal.emails.sendNotificationEmail, {
            trigger: "scheduled_duel_reminder",
            toUserId: userId,
            scheduledDuelId: duel._id,
            reminderOffsetMinutes: prefs.scheduledDuelReminderOffsetMinutes,
          });
        }
      }
    }
  },
});
```

### 6.3 Weekly Goal Reminder Action

```typescript
export const sendWeeklyGoalReminders = internalAction({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    
    // Get all active goals with expiresAt in the future
    const activeGoals = await ctx.runQuery(
      internal.weeklyGoals.getActiveGoalsWithExpiry,
      {}
    );
    
    for (const goal of activeGoals) {
      const participants = [goal.creatorId, goal.partnerId];
      
      for (const userId of participants) {
        const prefs = await ctx.runQuery(
          internal.notificationPreferences.getByUserId,
          { userId }
        );
        
        // Check reminder 1
        if (prefs.weeklyGoalReminder1Enabled) {
          const offset1Ms = prefs.weeklyGoalReminder1OffsetMinutes * 60 * 1000;
          const reminder1Time = goal.expiresAt - offset1Ms;
          const isDue1 = reminder1Time <= now && reminder1Time > now - 60 * 60 * 1000;
          
          if (isDue1) {
            await ctx.runAction(internal.emails.sendNotificationEmail, {
              trigger: "weekly_goal_reminder_1",
              toUserId: userId,
              weeklyGoalId: goal._id,
              reminderOffsetMinutes: prefs.weeklyGoalReminder1OffsetMinutes,
            });
          }
        }
        
        // Check reminder 2
        if (prefs.weeklyGoalReminder2Enabled) {
          const offset2Ms = prefs.weeklyGoalReminder2OffsetMinutes * 60 * 1000;
          const reminder2Time = goal.expiresAt - offset2Ms;
          const isDue2 = reminder2Time <= now && reminder2Time > now - 60 * 60 * 1000;
          
          if (isDue2) {
            await ctx.runAction(internal.emails.sendNotificationEmail, {
              trigger: "weekly_goal_reminder_2",
              toUserId: userId,
              weeklyGoalId: goal._id,
              reminderOffsetMinutes: prefs.weeklyGoalReminder2OffsetMinutes,
            });
          }
        }
      }
    }
  },
});
```

---

## 7. Email Templates

### 7.1 Organization

**Structure:**
```
convex/emails/
├── actions.ts              # Existing Resend send action
├── types.ts                # Existing types
├── notificationEmails.ts   # New: central send action
├── reminderCrons.ts        # New: cron job actions
└── templates/
    ├── layout.tsx          # Shared email layout wrapper
    ├── immediateDuels.tsx  # Immediate duel templates
    ├── scheduledDuels.tsx  # Scheduled duel templates
    └── weeklyGoals.tsx     # Weekly goal templates
```

### 7.2 Template Variables

| Variable | Type | Source |
|----------|------|--------|
| `recipientName` | string | toUser.nickname |
| `actorName` | string | fromUser.nickname |
| `themeName` | string | theme.name |
| `scheduledTime` | string | Formatted date/time |
| `minutesBefore` | number | Reminder offset |
| `hoursLeft` | number | Time until expiry |
| `completedCount` | number | Goal progress |
| `totalCount` | number | Goal total themes |
| `appUrl` | string | ENV: APP_URL |
| `deepLink` | string | Constructed link to entity |

### 7.3 Deep Links (v1: View in App)

```typescript
const buildDeepLink = (type: string, id: string): string => {
  const baseUrl = process.env.APP_URL || "https://app.example.com";
  
  switch (type) {
    case "challenge":
      return `${baseUrl}/notifications`; // Opens notifications
    case "scheduledDuel":
      return `${baseUrl}/notifications`; // Opens notifications
    case "weeklyGoal":
      return `${baseUrl}/goals/${id}`;
    default:
      return baseUrl;
  }
};
```

---

## 8. Settings UI

### 8.1 File Structure

```
app/settings/
├── page.tsx                        # Existing: add Notifications button
└── notifications/
    ├── page.tsx                    # Main notification settings page
    ├── components/
    │   ├── CategoryToggle.tsx      # Master toggle for category
    │   ├── NotificationToggle.tsx  # Individual notification toggle
    │   └── ReminderOffsetInput.tsx # Typable offset input
    └── hooks/
        └── useNotificationSettings.ts # Query + mutation orchestration
```

### 8.2 Settings Page Button

**File:** `app/settings/page.tsx`

```tsx
<Button
  onClick={() => router.push("/settings/notifications")}
  data-testid="settings-notifications"
>
  Notifications
</Button>
```

### 8.3 Notification Settings Page Layout

```tsx
// app/settings/notifications/page.tsx

export default function NotificationSettingsPage() {
  const { prefs, updatePrefs, isLoading } = useNotificationSettings();
  
  if (isLoading) return <Loading />;
  
  return (
    <div>
      <Header title="Notification Settings" backHref="/settings" />
      
      {/* Immediate Duels */}
      <CategoryToggle
        label="Immediate Duels"
        enabled={prefs.immediateDuelsEnabled}
        onChange={(v) => updatePrefs({ immediateDuelsEnabled: v })}
        data-testid="category-immediate-duels"
      >
        <NotificationToggle
          label="Challenge received"
          enabled={prefs.immediateDuelChallengeEnabled}
          disabled={!prefs.immediateDuelsEnabled}
          onChange={(v) => updatePrefs({ immediateDuelChallengeEnabled: v })}
        />
      </CategoryToggle>
      
      {/* Scheduled Duels */}
      <CategoryToggle
        label="Scheduled Duels"
        enabled={prefs.scheduledDuelsEnabled}
        onChange={(v) => updatePrefs({ scheduledDuelsEnabled: v })}
        data-testid="category-scheduled-duels"
      >
        <NotificationToggle
          label="Proposal received"
          enabled={prefs.scheduledDuelProposalEnabled}
          disabled={!prefs.scheduledDuelsEnabled}
          onChange={(v) => updatePrefs({ scheduledDuelProposalEnabled: v })}
        />
        <NotificationToggle
          label="Duel accepted"
          enabled={prefs.scheduledDuelAcceptedEnabled}
          disabled={!prefs.scheduledDuelsEnabled}
          onChange={(v) => updatePrefs({ scheduledDuelAcceptedEnabled: v })}
        />
        <NotificationToggle
          label="Counter-proposal received"
          enabled={prefs.scheduledDuelCounterProposedEnabled}
          disabled={!prefs.scheduledDuelsEnabled}
          onChange={(v) => updatePrefs({ scheduledDuelCounterProposedEnabled: v })}
        />
        <NotificationToggle
          label="Duel declined"
          enabled={prefs.scheduledDuelDeclinedEnabled}
          disabled={!prefs.scheduledDuelsEnabled}
          onChange={(v) => updatePrefs({ scheduledDuelDeclinedEnabled: v })}
        />
        <NotificationToggle
          label="Duel canceled"
          enabled={prefs.scheduledDuelCanceledEnabled}
          disabled={!prefs.scheduledDuelsEnabled}
          onChange={(v) => updatePrefs({ scheduledDuelCanceledEnabled: v })}
        />
        <NotificationToggle
          label="Duel reminder"
          enabled={prefs.scheduledDuelReminderEnabled}
          disabled={!prefs.scheduledDuelsEnabled}
          onChange={(v) => updatePrefs({ scheduledDuelReminderEnabled: v })}
        />
        <ReminderOffsetInput
          label="Remind me before"
          valueMinutes={prefs.scheduledDuelReminderOffsetMinutes}
          disabled={!prefs.scheduledDuelsEnabled || !prefs.scheduledDuelReminderEnabled}
          onChange={(v) => updatePrefs({ scheduledDuelReminderOffsetMinutes: v })}
          data-testid="scheduled-duel-reminder-offset"
        />
      </CategoryToggle>
      
      {/* Weekly Goals */}
      <CategoryToggle
        label="Weekly Goals"
        enabled={prefs.weeklyGoalsEnabled}
        onChange={(v) => updatePrefs({ weeklyGoalsEnabled: v })}
        data-testid="category-weekly-goals"
      >
        <NotificationToggle
          label="Goal invite received"
          enabled={prefs.weeklyGoalInviteEnabled}
          disabled={!prefs.weeklyGoalsEnabled}
          onChange={(v) => updatePrefs({ weeklyGoalInviteEnabled: v })}
        />
        <NotificationToggle
          label="Goal invite accepted"
          enabled={prefs.weeklyGoalAcceptedEnabled}
          disabled={!prefs.weeklyGoalsEnabled}
          onChange={(v) => updatePrefs({ weeklyGoalAcceptedEnabled: v })}
        />
        <NotificationToggle
          label="Goal invite declined"
          enabled={prefs.weeklyGoalDeclinedEnabled}
          disabled={!prefs.weeklyGoalsEnabled}
          onChange={(v) => updatePrefs({ weeklyGoalDeclinedEnabled: v })}
        />
        <NotificationToggle
          label="Goal reminder 1"
          enabled={prefs.weeklyGoalReminder1Enabled}
          disabled={!prefs.weeklyGoalsEnabled}
          onChange={(v) => updatePrefs({ weeklyGoalReminder1Enabled: v })}
        />
        <ReminderOffsetInput
          label="First reminder before expiry"
          valueMinutes={prefs.weeklyGoalReminder1OffsetMinutes}
          disabled={!prefs.weeklyGoalsEnabled || !prefs.weeklyGoalReminder1Enabled}
          onChange={(v) => updatePrefs({ weeklyGoalReminder1OffsetMinutes: v })}
        />
        <NotificationToggle
          label="Goal reminder 2"
          enabled={prefs.weeklyGoalReminder2Enabled}
          disabled={!prefs.weeklyGoalsEnabled}
          onChange={(v) => updatePrefs({ weeklyGoalReminder2Enabled: v })}
        />
        <ReminderOffsetInput
          label="Second reminder before expiry"
          valueMinutes={prefs.weeklyGoalReminder2OffsetMinutes}
          disabled={!prefs.weeklyGoalsEnabled || !prefs.weeklyGoalReminder2Enabled}
          onChange={(v) => updatePrefs({ weeklyGoalReminder2OffsetMinutes: v })}
        />
      </CategoryToggle>
    </div>
  );
}
```

### 8.4 ReminderOffsetInput Component

```tsx
// Stores minutes internally, displays with unit selector

interface Props {
  label: string;
  valueMinutes: number;
  disabled: boolean;
  onChange: (minutes: number) => void;
}

export function ReminderOffsetInput({ label, valueMinutes, disabled, onChange }: Props) {
  const [unit, setUnit] = useState<"minutes" | "hours">(
    valueMinutes >= 60 && valueMinutes % 60 === 0 ? "hours" : "minutes"
  );
  
  const displayValue = unit === "hours" ? valueMinutes / 60 : valueMinutes;
  
  const handleValueChange = (newValue: number) => {
    const minutes = unit === "hours" ? newValue * 60 : newValue;
    onChange(minutes);
  };
  
  const handleUnitChange = (newUnit: "minutes" | "hours") => {
    setUnit(newUnit);
    // Recalculate on unit change
    const newMinutes = newUnit === "hours" 
      ? Math.round(valueMinutes / 60) * 60 
      : valueMinutes;
    onChange(newMinutes);
  };
  
  return (
    <div>
      <label>{label}</label>
      <input
        type="number"
        value={displayValue}
        onChange={(e) => handleValueChange(Number(e.target.value))}
        disabled={disabled}
        min={1}
      />
      <select
        value={unit}
        onChange={(e) => handleUnitChange(e.target.value as "minutes" | "hours")}
        disabled={disabled}
      >
        <option value="minutes">minutes</option>
        <option value="hours">hours</option>
      </select>
    </div>
  );
}
```

---

## 9. Testable Architecture

### 9.1 Design Principle

Follow the existing codebase pattern: **pure functions in `lib/`** that are easily unit-testable, with Convex actions/mutations as thin orchestration wrappers.

### 9.2 File Structure

```
lib/
  notificationPreferences.ts    ← Pure functions + constants
  notificationTemplates.ts      ← Pure template rendering

tests/lib/
  notificationPreferences.test.ts
  notificationTemplates.test.ts

convex/
  notificationPreferences.ts    ← Query + mutation (thin wrappers)
  emails/
    notificationEmails.ts       ← Central send action (orchestration only)
```

### 9.3 Pure Functions in `lib/notificationPreferences.ts`

```typescript
// Constants
export const DEFAULT_NOTIFICATION_PREFS = { ... };

// Types
export type NotificationTrigger = 
  | "immediate_duel_challenge"
  | "scheduled_duel_proposal"
  | ... ;

export type NotificationPreferences = { ... };

// Pure functions
export function isNotificationEnabled(
  trigger: NotificationTrigger,
  prefs: NotificationPreferences
): boolean;

export function shouldSendScheduledDuelReminder(
  duel: { scheduledTime: number; status: string; startedDuelId?: string },
  now: number,
  reminderOffsetMinutes: number
): boolean;

export function shouldSendWeeklyGoalReminder(
  goal: { expiresAt?: number; status: string },
  now: number,
  reminderOffsetMinutes: number
): boolean;

export function formatScheduledTime(
  timestamp: number,
  timezone: string
): string;
```

### 9.4 Pure Functions in `lib/notificationTemplates.ts`

```typescript
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

export function renderNotificationEmail(
  trigger: NotificationTrigger,
  data: EmailData
): { subject: string; html: string };

export function getSubjectForTrigger(
  trigger: NotificationTrigger,
  data: EmailData
): string;

export function getBodyForTrigger(
  trigger: NotificationTrigger,
  data: EmailData
): string;
```

### 9.5 Thin Convex Wrapper

The `sendNotificationEmail` action becomes orchestration only:

```typescript
export const sendNotificationEmail = internalAction({
  handler: async (ctx, args) => {
    // 1. Load data from DB
    const toUser = await ctx.runQuery(...);
    const prefs = await ctx.runQuery(...);
    const alreadySent = await ctx.runQuery(...);
    
    // 2. Call pure functions for decisions
    if (!isNotificationEnabled(args.trigger, prefs)) {
      return { sent: false, reason: "disabled_by_user" };
    }
    if (alreadySent) {
      return { sent: false, reason: "already_sent" };
    }
    
    // 3. Build email data, call pure render function
    const emailData = buildEmailData(...);
    const { subject, html } = renderNotificationEmail(args.trigger, emailData);
    
    // 4. Send + log
    await ctx.runAction(internal.emails.internalSendEmail, { ... });
    await ctx.runMutation(internal.emails.logNotificationSent, { ... });
    
    return { sent: true };
  },
});
```

---

## 10. Tests

### 10.1 Test Files to Create

| File | Tests |
|------|-------|
| `tests/lib/notificationPreferences.test.ts` | Preference logic |
| `tests/lib/notificationTemplates.test.ts` | Template rendering |

### 10.2 `notificationPreferences.test.ts` Test Cases

```typescript
describe("isNotificationEnabled", () => {
  describe("category toggle", () => {
    it("returns false when category is disabled", () => {
      const prefs = { ...DEFAULT_NOTIFICATION_PREFS, scheduledDuelsEnabled: false };
      expect(isNotificationEnabled("scheduled_duel_proposal", prefs)).toBe(false);
    });

    it("returns true when category enabled and trigger enabled", () => {
      const prefs = { ...DEFAULT_NOTIFICATION_PREFS };
      expect(isNotificationEnabled("scheduled_duel_proposal", prefs)).toBe(true);
    });
  });

  describe("individual trigger toggle", () => {
    it("returns false when category enabled but trigger disabled", () => {
      const prefs = { 
        ...DEFAULT_NOTIFICATION_PREFS, 
        scheduledDuelsEnabled: true,
        scheduledDuelProposalEnabled: false 
      };
      expect(isNotificationEnabled("scheduled_duel_proposal", prefs)).toBe(false);
    });
  });

  describe("all triggers", () => {
    it.each([
      ["immediate_duel_challenge", "immediateDuelsEnabled", "immediateDuelChallengeEnabled"],
      ["scheduled_duel_proposal", "scheduledDuelsEnabled", "scheduledDuelProposalEnabled"],
      ["scheduled_duel_accepted", "scheduledDuelsEnabled", "scheduledDuelAcceptedEnabled"],
      ["scheduled_duel_counter_proposed", "scheduledDuelsEnabled", "scheduledDuelCounterProposedEnabled"],
      ["scheduled_duel_declined", "scheduledDuelsEnabled", "scheduledDuelDeclinedEnabled"],
      ["scheduled_duel_canceled", "scheduledDuelsEnabled", "scheduledDuelCanceledEnabled"],
      ["scheduled_duel_reminder", "scheduledDuelsEnabled", "scheduledDuelReminderEnabled"],
      ["weekly_goal_invite", "weeklyGoalsEnabled", "weeklyGoalInviteEnabled"],
      ["weekly_goal_accepted", "weeklyGoalsEnabled", "weeklyGoalAcceptedEnabled"],
      ["weekly_goal_reminder_1", "weeklyGoalsEnabled", "weeklyGoalReminder1Enabled"],
      ["weekly_goal_reminder_2", "weeklyGoalsEnabled", "weeklyGoalReminder2Enabled"],
    ])("%s respects category %s and trigger %s", (trigger, category, triggerKey) => {
      // Test each trigger maps to correct category/trigger combo
      const prefsAllEnabled = { ...DEFAULT_NOTIFICATION_PREFS };
      expect(isNotificationEnabled(trigger, prefsAllEnabled)).toBe(true);

      const prefsCategoryDisabled = { ...DEFAULT_NOTIFICATION_PREFS, [category]: false };
      expect(isNotificationEnabled(trigger, prefsCategoryDisabled)).toBe(false);

      const prefsTriggerDisabled = { ...DEFAULT_NOTIFICATION_PREFS, [triggerKey]: false };
      expect(isNotificationEnabled(trigger, prefsTriggerDisabled)).toBe(false);
    });
  });

  describe("unknown trigger", () => {
    it("returns false for unknown trigger", () => {
      expect(isNotificationEnabled("unknown_trigger" as any, DEFAULT_NOTIFICATION_PREFS)).toBe(false);
    });
  });
});

describe("shouldSendScheduledDuelReminder", () => {
  const MINUTE = 60 * 1000;

  it("returns true when within reminder window", () => {
    const duel = { scheduledTime: Date.now() + 10 * MINUTE, status: "accepted" };
    expect(shouldSendScheduledDuelReminder(duel, Date.now(), 15)).toBe(true);
  });

  it("returns false when too early for reminder", () => {
    const duel = { scheduledTime: Date.now() + 60 * MINUTE, status: "accepted" };
    expect(shouldSendScheduledDuelReminder(duel, Date.now(), 15)).toBe(false);
  });

  it("returns false when duel already started", () => {
    const duel = { scheduledTime: Date.now() - 10 * MINUTE, status: "accepted", startedDuelId: "123" };
    expect(shouldSendScheduledDuelReminder(duel, Date.now(), 15)).toBe(false);
  });

  it("returns false when duel is declined", () => {
    const duel = { scheduledTime: Date.now() + 10 * MINUTE, status: "declined" };
    expect(shouldSendScheduledDuelReminder(duel, Date.now(), 15)).toBe(false);
  });

  it("returns false when past scheduled time", () => {
    const duel = { scheduledTime: Date.now() - 5 * MINUTE, status: "accepted" };
    expect(shouldSendScheduledDuelReminder(duel, Date.now(), 15)).toBe(false);
  });
});

describe("shouldSendWeeklyGoalReminder", () => {
  const HOUR = 60 * 60 * 1000;

  it("returns true when within reminder window", () => {
    const goal = { expiresAt: Date.now() + 20 * HOUR, status: "active" };
    expect(shouldSendWeeklyGoalReminder(goal, Date.now(), 24 * 60)).toBe(true);
  });

  it("returns false when too early for reminder", () => {
    const goal = { expiresAt: Date.now() + 48 * HOUR, status: "active" };
    expect(shouldSendWeeklyGoalReminder(goal, Date.now(), 24 * 60)).toBe(false);
  });

  it("returns false when goal is not active", () => {
    const goal = { expiresAt: Date.now() + 20 * HOUR, status: "editing" };
    expect(shouldSendWeeklyGoalReminder(goal, Date.now(), 24 * 60)).toBe(false);
  });

  it("returns false when goal has no expiresAt", () => {
    const goal = { status: "active" };
    expect(shouldSendWeeklyGoalReminder(goal, Date.now(), 24 * 60)).toBe(false);
  });

  it("returns false when already expired", () => {
    const goal = { expiresAt: Date.now() - 1 * HOUR, status: "active" };
    expect(shouldSendWeeklyGoalReminder(goal, Date.now(), 24 * 60)).toBe(false);
  });
});

describe("formatScheduledTime", () => {
  it("formats timestamp in Europe/Bratislava timezone", () => {
    // 2026-02-03 15:00:00 UTC
    const timestamp = Date.UTC(2026, 1, 3, 15, 0, 0);
    const result = formatScheduledTime(timestamp, "Europe/Bratislava");
    // Bratislava is UTC+1 in winter, so should be 16:00
    expect(result).toContain("16:00");
    expect(result).toContain("Feb");
    expect(result).toContain("3");
  });
});
```

### 10.3 `notificationTemplates.test.ts` Test Cases

```typescript
describe("renderNotificationEmail", () => {
  describe("immediate duel challenge", () => {
    it("renders correct subject and body", () => {
      const data = { recipientName: "Player", senderName: "Challenger", themeName: "Spanish Verbs" };
      const { subject, html } = renderNotificationEmail("immediate_duel_challenge", data);
      
      expect(subject).toBe("Challenger challenged you to a duel!");
      expect(html).toContain("Challenger");
      expect(html).toContain("Spanish Verbs");
      expect(html).toContain("right now");
    });
  });

  describe("scheduled duel proposal", () => {
    it("renders correct subject and body", () => {
      const data = { 
        recipientName: "Player", 
        senderName: "Proposer", 
        themeName: "French Nouns",
        scheduledTime: "Feb 5, 2026 at 14:00"
      };
      const { subject, html } = renderNotificationEmail("scheduled_duel_proposal", data);
      
      expect(subject).toBe("Proposer wants to schedule a duel");
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
        scheduledTime: "Feb 6, 2026 at 10:00"
      };
      const { subject, html } = renderNotificationEmail("scheduled_duel_accepted", data);
      
      expect(subject).toBe("Accepter confirmed your duel!");
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
        minutesBefore: 15
      };
      const { subject, html } = renderNotificationEmail("scheduled_duel_reminder", data);
      
      expect(subject).toBe("Your duel starts in 15 minutes!");
      expect(html).toContain("Opponent");
      expect(html).toContain("Italian Phrases");
    });
  });

  describe("weekly goal invite", () => {
    it("renders correct subject and body", () => {
      const data = { recipientName: "Partner", senderName: "Inviter" };
      const { subject, html } = renderNotificationEmail("weekly_goal_invite", data);
      
      expect(subject).toBe("Inviter invited you to a weekly goal");
      expect(html).toContain("Inviter");
      expect(html).toContain("weekly goal");
    });
  });

  describe("weekly goal reminder", () => {
    it("renders reminder 1 with hours left and progress", () => {
      const data = { 
        recipientName: "Player", 
        partnerName: "Partner",
        hoursLeft: 72,
        completedCount: 2,
        totalCount: 5
      };
      const { subject, html } = renderNotificationEmail("weekly_goal_reminder_1", data);
      
      expect(subject).toBe("72 hours left on your weekly goal!");
      expect(html).toContain("Partner");
      expect(html).toContain("2/5");
    });

    it("renders reminder 2 as final hours", () => {
      const data = { 
        recipientName: "Player", 
        partnerName: "Partner",
        hoursLeft: 24,
        completedCount: 3,
        totalCount: 5
      };
      const { subject, html } = renderNotificationEmail("weekly_goal_reminder_2", data);
      
      expect(subject).toBe("Final hours for your weekly goal!");
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
      "weekly_goal_accepted",
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
    const subject = getSubjectForTrigger("immediate_duel_challenge", { senderName: "Alice" });
    expect(subject).toContain("Alice");
  });
});
```

### 10.4 What We Don't Test

- **Email delivery** — User verifies manually
- **Convex DB operations** — Covered by Convex's own guarantees
- **Resend API calls** — External service, not mocked

---

## 11. Implementation Order (Updated)

### Phase 1: Pure Logic + Tests (Day 1)
1. [ ] Create `lib/notificationPreferences.ts` with types, constants, pure functions
2. [ ] Create `lib/notificationTemplates.ts` with template rendering
3. [ ] Create `tests/lib/notificationPreferences.test.ts`
4. [ ] Create `tests/lib/notificationTemplates.test.ts`
5. [ ] Run tests, ensure all pass

### Phase 2: Schema + Convex Wrappers (Day 1)
6. [ ] Add `notificationPreferences` table to schema
7. [ ] Add `emailNotificationLog` table to schema
8. [ ] Create `convex/notificationPreferences.ts` with query + mutation

### Phase 3: Email Infrastructure (Day 1-2)
9. [ ] Create `convex/emails/notificationEmails.ts` with central send action
10. [ ] Create helper queries for idempotency log

### Phase 4: First Trigger End-to-End (Day 2)
11. [ ] Inject trigger in `proposeScheduledDuel`
12. [ ] Manual test: propose duel → email received
13. [ ] Verify idempotency (no duplicate on retry)

### Phase 5: All Triggers (Day 2-3)
14. [ ] Inject remaining 5 scheduled duel triggers
15. [ ] Inject immediate duel trigger
16. [ ] Inject 3 weekly goal triggers (invite, accepted, reminders)

### Phase 6: Cron Reminders (Day 3)
17. [ ] Create `sendScheduledDuelReminders` action
18. [ ] Create `sendWeeklyGoalReminders` action
19. [ ] Register crons in `convex/crons.ts`
20. [ ] Manual test reminder delivery

### Phase 7: Settings UI (Day 3-4)
21. [ ] Add Notifications button to settings page
22. [ ] Create `/settings/notifications` page
23. [ ] Create toggle and input components
24. [ ] Wire up to preference mutations

### Phase 8: Final Verification (Day 4)
25. [ ] Run full test suite
26. [ ] Manual verification of all 11 triggers (excluding weekly goal decline)
27. [ ] Preferences respected (category + individual toggles)
28. [ ] Reminder offsets work as configured
29. [ ] No duplicate emails

---

## 12. Verification Checklist

### Preferences
- [ ] New user has no prefs row → defaults returned
- [ ] Save prefs → row created/updated
- [ ] Category toggle off → all children disabled
- [ ] Offset validation rejects invalid values

### Email Triggers
- [ ] Immediate duel challenge → Player B gets email
- [ ] Scheduled duel proposal → Player B gets email
- [ ] Scheduled duel accepted → Player A gets email
- [ ] Scheduled duel counter-proposed → Player A gets email
- [ ] Scheduled duel declined → Player A gets email
- [ ] Scheduled duel canceled → other party gets email
- [ ] Scheduled duel reminder → both get email at offset
- [ ] Weekly goal invite → Player B gets email
- [ ] Weekly goal accepted → Player A gets email
- [ ] Weekly goal reminder 1 → both get email at offset
- [ ] Weekly goal reminder 2 → both get email at offset

### Idempotency
- [ ] Mutation retry → no duplicate email
- [ ] Cron overlap → no duplicate reminder

### Cancellation/Changes
- [ ] Duel canceled → reminder not sent
- [ ] Duel rescheduled → old reminder not sent, new one queued

### UI
- [ ] Settings → Notifications button navigates correctly
- [ ] All toggles reflect current state
- [ ] Changes save immediately
- [ ] Disabled state visually clear
- [ ] Offset inputs accept valid values

---

## 13. Open Questions / Decisions Needed

1. **Weekly goal invite:** Implicit when goal is created with a partner via `createGoal` mutation.

2. **Weekly goal decline:** No explicit decline exists — delegated to known-issues. Trigger #10 skipped.

3. **Email sender address:** Using `onboarding@resend.dev` (Resend test domain).

4. **Unsubscribe flow:** Link to settings page in email footer.

5. **Timezone display:** Use Europe/Bratislava as default timezone.

---

## 14. Dependencies

- **Existing:** Resend integration (`convex/emails/actions.ts`)
- **Existing:** User email available via Clerk/users table
- **Existing:** Scheduled duel mutations in `convex/scheduledDuels.ts`
- **Existing:** Weekly goal mutations in `convex/weeklyGoals.ts`
- **Existing:** Challenge creation in `convex/lobby.ts` or similar

---

## 15. Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Duplicate emails on retry | `emailNotificationLog` table with check before send |
| Cron window misses reminder | 5-min cron with ±5 min jitter window |
| User changes offset after reminder queued | Reminder uses current prefs at send time, not at queue time |
| Canceled duel still gets reminder | Cron checks duel status before sending |
| High email volume | Batch processing in crons if needed; monitor Resend limits |
