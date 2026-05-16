import { defineSchema, defineTable } from "convex/server";
import { v, type Infer } from "convex/values";

// ===========================================
// Shared Validators
// ===========================================

const wordValidator = v.object({
  word: v.string(),
  answer: v.string(),
  wrongAnswers: v.array(v.string()),
  ttsStorageId: v.optional(v.id("_storage")),
});

export const wordTypeValidator = v.union(
  v.literal("nouns"),
  v.literal("verbs"),
  v.literal("adjectives"),
  v.literal("adverbs")
);

export const optionalWordTypeValidator = v.optional(wordTypeValidator);

const sessionWordValidator = v.object({
  word: v.string(),
  answer: v.string(),
  wrongAnswers: v.array(v.string()),
  ttsStorageId: v.optional(v.id("_storage")),
  themeId: v.id("themes"),
  themeName: v.string(),
});

const playerRoleValidator = v.union(v.literal("challenger"), v.literal("opponent"));
const difficultyLevelValidator = v.union(
  v.literal("easy"),
  v.literal("medium"),
  v.literal("hard")
);

const challengeStatusValidator = v.union(
  v.literal("pending"),
  v.literal("accepted"),
  v.literal("declined"),
  v.literal("cancelled")
);

const duelStatusValidator = v.union(
  v.literal("active"),
  v.literal("completed"),
  v.literal("stopped")
);

const soloPracticeStatusValidator = v.union(
  v.literal("learning"),
  v.literal("practicing"),
  v.literal("completed"),
  v.literal("stopped")
);

const duelSourceTypeValidator = v.union(
  v.literal("normal"),
  v.literal("boss"),
  v.literal("spaced_repetition")
);

const soloPracticeSourceTypeValidator = v.union(
  v.literal("weekly_goal"),
  v.literal("boss"),
  v.literal("spaced_repetition")
);

const bossTypeValidator = v.union(v.literal("mini"), v.literal("big"));

const duelDifficultyPresetValidator = v.union(
  v.literal("easy"),
  v.literal("medium"),
  v.literal("hard")
);

const duelQuestionValidator = v.object({
  options: v.array(v.string()),
  correctOption: v.string(),
  difficulty: difficultyLevelValidator,
  points: v.number(),
});

const playerStatsValidator = v.object({
  questionsAnswered: v.number(),
  correctAnswers: v.number(),
});

const sabotageEffectValidator = v.union(
  v.literal("sticky"),
  v.literal("bounce"),
  v.literal("trampoline"),
  v.literal("reverse")
);

const sabotageValidator = v.object({
  effect: sabotageEffectValidator,
  timestamp: v.number(),
});

// ===========================================
// Schema Definition
// ===========================================

// Notification type validator
export const notificationTypeValidator = v.union(
  v.literal("friend_request"),
  v.literal("weekly_goal_invitation"),
  v.literal("weekly_goal_draft_expiring"),
  v.literal("challenge_invite")
);

const notificationStatusValidator = v.union(
  v.literal("pending"),
  v.literal("read"),
  v.literal("dismissed")
);

const weeklyGoalLifecycleStatusValidator = v.union(
  v.literal("draft"),
  v.literal("locked"),
  v.literal("grace_period"),
  v.literal("completed")
);

const weeklyGoalBossStatusValidator = v.union(
  v.literal("unavailable"),
  v.literal("ready"),
  v.literal("defeated")
);

export const notificationPayloadValidator = v.union(
  v.object({
    friendRequestId: v.id("friendRequests"),
  }),
  v.object({
    goalId: v.id("weeklyGoals"),
    themeCount: v.number(),
    event: v.optional(
      v.union(
        v.literal("invite"),
        v.literal("declined"),
        v.literal("partner_locked"),
        v.literal("goal_unlocked"),
        v.literal("goal_activated"),
        v.literal("goal_completed"),
        v.literal("draft_expiring")
      )
    ),
  }),
  v.object({
    challengeId: v.id("challenges"),
    themeName: v.optional(v.string()),
    duelDifficultyPreset: v.optional(duelDifficultyPresetValidator),
  })
);

export type NotificationPayload = Infer<typeof notificationPayloadValidator>;

// Email notification trigger types
export const emailNotificationTriggerValidator = v.union(
  v.literal("immediate_challenge_invite"),
  v.literal("weekly_goal_invite"),
  v.literal("weekly_goal_locked"),
  v.literal("weekly_goal_accepted"),
  v.literal("weekly_goal_daily_reminder"),
  v.literal("weekly_goal_draft_expiring"),
  v.literal("weekly_goal_grace_period_reminder"),
  v.literal("weekly_goal_reminder_1"),
  v.literal("weekly_goal_reminder_2")
);

export default defineSchema({
  // -------------------------------------------
  // Users Table
  // -------------------------------------------
  users: defineTable({
    clerkId: v.string(),
    email: v.string(),
    name: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
    nickname: v.optional(v.string()),
    discriminator: v.optional(v.number()),
    llmCreditsRemaining: v.optional(v.number()),
    ttsGenerationsRemaining: v.optional(v.number()),
    // TTS provider preference: 'resemble' (default) or 'elevenlabs'
    ttsProvider: v.optional(v.union(v.literal("resemble"), v.literal("elevenlabs"))),
    creditsMonth: v.optional(v.string()),
    // User preferences for theme system
    selectedColorSet: v.optional(v.string()),
    selectedBackground: v.optional(v.string()),
    // Archived themes (hidden from main list)
    archivedThemeIds: v.optional(v.array(v.id("themes"))),
    // Guard against concurrent theme-level TTS generation runs
    ttsGenerationLockToken: v.optional(v.string()),
    ttsGenerationLockExpiresAt: v.optional(v.number()),
    // Presence tracking
    lastSeenAt: v.optional(v.number()),
  })
    .index("by_clerk_id", ["clerkId"])
    .index("by_nickname_discriminator", ["nickname", "discriminator"]),

  // -------------------------------------------
  // Themes Table
  // -------------------------------------------
  themes: defineTable({
    name: v.string(),
    description: v.string(),
    wordType: optionalWordTypeValidator,
    words: v.array(wordValidator),
    createdAt: v.number(),
    ownerId: v.optional(v.id("users")),
    visibility: v.optional(v.union(v.literal("private"), v.literal("shared"))),
    friendsCanEdit: v.optional(v.boolean()),
    saveRequestId: v.optional(v.string()),
  })
    .index("by_owner", ["ownerId"])
    .index("by_visibility", ["visibility"])
    .index("by_visibility_owner", ["visibility", "ownerId"])
    .index("by_owner_save_request", ["ownerId", "saveRequestId"]),

  // -------------------------------------------
  // Friend Requests Table
  // -------------------------------------------
  friendRequests: defineTable({
    senderId: v.id("users"),
    receiverId: v.id("users"),
    status: v.union(v.literal("pending"), v.literal("accepted"), v.literal("rejected")),
    createdAt: v.number(),
  })
    .index("by_receiver", ["receiverId", "status"])
    .index("by_sender_status", ["senderId", "status"])
    .index("by_sender", ["senderId"])
    .index("by_status_createdAt", ["status", "createdAt"]),

  // -------------------------------------------
  // Friends Table (bidirectional)
  // -------------------------------------------
  friends: defineTable({
    userId: v.id("users"),
    friendId: v.id("users"),
    createdAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_friend", ["friendId"]),

  // -------------------------------------------
  // Challenges Table
  // -------------------------------------------
  challenges: defineTable({
    challengerId: v.id("users"),
    opponentId: v.id("users"),
    themeIds: v.array(v.id("themes")),
    sourceType: duelSourceTypeValidator,
    weeklyGoalId: v.optional(v.id("weeklyGoals")),
    bossType: v.optional(bossTypeValidator),
    spacedRepetitionStep: v.optional(v.number()),
    status: challengeStatusValidator,
    duelDifficultyPreset: v.optional(duelDifficultyPresetValidator),
    duelId: v.optional(v.id("duels")),
    createdAt: v.number(),
    acceptedAt: v.optional(v.number()),
    resolvedAt: v.optional(v.number()),
  })
    .index("by_challenger", ["challengerId"])
    .index("by_opponent", ["opponentId"])
    .index("by_opponent_status", ["opponentId", "status"])
    .index("by_status", ["status"])
    .index("by_weeklyGoalId", ["weeklyGoalId"]),

  // -------------------------------------------
  // Duels Table
  // -------------------------------------------
  duels: defineTable({
    challengeId: v.optional(v.id("challenges")),
    challengerId: v.id("users"),
    opponentId: v.id("users"),
    themeIds: v.array(v.id("themes")),
    sessionWords: v.array(sessionWordValidator),
    sourceType: duelSourceTypeValidator,
    weeklyGoalId: v.optional(v.id("weeklyGoals")),
    bossType: v.optional(bossTypeValidator),
    spacedRepetitionStep: v.optional(v.number()),
    bossLivesTotal: v.optional(v.number()),
    bossLivesRemaining: v.optional(v.number()),
    status: duelStatusValidator,
    createdAt: v.number(),

    currentWordIndex: v.number(),
    wordOrder: v.optional(v.array(v.number())),
    duelQuestions: v.optional(v.array(duelQuestionValidator)),
    challengerAnswered: v.boolean(),
    opponentAnswered: v.boolean(),
    challengerScore: v.number(),
    opponentScore: v.number(),
    challengerPerfectRun: v.optional(v.boolean()),
    opponentPerfectRun: v.optional(v.boolean()),
    duelDifficultyPreset: v.optional(duelDifficultyPresetValidator),

    questionStartTime: v.optional(v.number()),
    questionTimerPausedAt: v.optional(v.number()),
    questionTimerPausedBy: v.optional(playerRoleValidator),

    challengerLastAnswer: v.optional(v.string()),
    opponentLastAnswer: v.optional(v.string()),

    hintRequestedBy: v.optional(playerRoleValidator),
    hintAccepted: v.optional(v.boolean()),
    eliminatedOptions: v.optional(v.array(v.string())),

    countdownPausedBy: v.optional(playerRoleValidator),
    countdownUnpauseRequestedBy: v.optional(playerRoleValidator),
    countdownPausedAt: v.optional(v.number()),
    countdownSkipRequestedBy: v.optional(v.array(playerRoleValidator)),

    challengerSabotage: v.optional(sabotageValidator),
    opponentSabotage: v.optional(sabotageValidator),
    challengerSabotagesUsed: v.optional(v.number()),
    opponentSabotagesUsed: v.optional(v.number()),

    seed: v.number(),
  })
    .index("by_challenger", ["challengerId"])
    .index("by_opponent", ["opponentId"])
    .index("by_opponent_status", ["opponentId", "status"])
    .index("by_status", ["status"])
    .index("by_weeklyGoalId", ["weeklyGoalId"]),

  // -------------------------------------------
  // Solo Practice Sessions Table
  // -------------------------------------------
  soloPracticeSessions: defineTable({
    userId: v.id("users"),
    themeIds: v.array(v.id("themes")),
    sessionWords: v.array(sessionWordValidator),
    sourceType: soloPracticeSourceTypeValidator,
    weeklyGoalId: v.id("weeklyGoals"),
    bossType: v.optional(bossTypeValidator),
    spacedRepetitionStep: v.optional(v.number()),
    status: soloPracticeStatusValidator,
    completedAt: v.optional(v.number()),
    finalStats: v.optional(playerStatsValidator),
    masteredWordIndices: v.optional(v.array(v.number())),
    progressUpdatedAt: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_weeklyGoalId", ["weeklyGoalId"])
    .index("by_user_status", ["userId", "status"]),

  // -------------------------------------------
  // Weekly Goals Table
  // -------------------------------------------
  weeklyGoals: defineTable({
    creatorId: v.id("users"),
    partnerId: v.id("users"),
    themes: v.array(
      v.object({
        themeId: v.id("themes"),
        themeName: v.string(),
        creatorCompleted: v.boolean(),
        partnerCompleted: v.boolean(),
      })
    ),
    creatorLocked: v.boolean(),
    partnerLocked: v.boolean(),
    lockedAt: v.optional(v.number()),
    endDate: v.optional(v.number()),
    miniBossStatus: weeklyGoalBossStatusValidator,
    bossStatus: weeklyGoalBossStatusValidator,
    status: weeklyGoalLifecycleStatusValidator,
    completedAt: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_creator", ["creatorId"])
    .index("by_partner", ["partnerId"])
    .index("by_status", ["status"])
    .index("by_status_createdAt", ["status", "createdAt"])
    .index("by_status_endDate", ["status", "endDate"]),

  // -------------------------------------------
  // Weekly Goal Spaced Repetition Table
  // -------------------------------------------
  weeklyGoalRepetitions: defineTable({
    weeklyGoalId: v.id("weeklyGoals"),
    userId: v.id("users"),
    completedSteps: v.array(
      v.object({
        completedAt: v.number(),
        completedVia: v.union(v.literal("duel"), v.literal("solo_practice")),
        duelId: v.optional(v.id("duels")),
        soloPracticeSessionId: v.optional(v.id("soloPracticeSessions")),
      })
    ),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_goal", ["weeklyGoalId"])
    .index("by_goal_user", ["weeklyGoalId", "userId"]),

  // -------------------------------------------
  // Weekly Goal Theme Snapshots Table
  // -------------------------------------------
  weeklyGoalThemeSnapshots: defineTable({
    weeklyGoalId: v.id("weeklyGoals"),
    originalThemeId: v.id("themes"),
    order: v.number(),
    name: v.string(),
    description: v.string(),
    wordType: optionalWordTypeValidator,
    words: v.array(wordValidator),
    lockedAt: v.number(),
    createdAt: v.number(),
  })
    .index("by_weeklyGoal", ["weeklyGoalId"])
    .index("by_weeklyGoal_order", ["weeklyGoalId", "order"])
    .index("by_weeklyGoal_originalTheme", ["weeklyGoalId", "originalThemeId"])
    .index("by_originalTheme", ["originalThemeId"]),

  // -------------------------------------------
  // Notifications Table
  // -------------------------------------------
  notifications: defineTable({
    type: notificationTypeValidator,
    fromUserId: v.id("users"),
    toUserId: v.id("users"),
    status: notificationStatusValidator,
    payload: v.optional(notificationPayloadValidator),
    createdAt: v.number(),
  })
    .index("by_recipient", ["toUserId", "status"])
    .index("by_type_status", ["type", "toUserId", "status"])
    .index("by_type", ["type", "toUserId"])
    .index("by_type_only", ["type"])
    .index("by_type_status_createdAt", ["type", "status", "createdAt"]),

  // -------------------------------------------
  // Notification Preferences Table
  // -------------------------------------------
  notificationPreferences: defineTable({
    userId: v.id("users"),

    // Challenge Invites
    challengeInviteEmailsEnabled: v.boolean(),
    challengeInviteEmailEnabled: v.boolean(),

    // Weekly Goals
    weeklyGoalEmailsEnabled: v.boolean(),
    weeklyGoalInviteEmailEnabled: v.boolean(),
    weeklyGoalAcceptedEmailEnabled: v.boolean(),
    weeklyGoalLockedEmailEnabled: v.boolean(),
    weeklyGoalDailyReminderEmailEnabled: v.boolean(),
    weeklyGoalGracePeriodReminderEmailEnabled: v.boolean(),
    weeklyGoalDraftExpiringEmailEnabled: v.boolean(),
    weeklyGoalReminder1EmailEnabled: v.boolean(),
    weeklyGoalReminder1OffsetMinutes: v.number(),
    weeklyGoalReminder2EmailEnabled: v.boolean(),
    weeklyGoalReminder2OffsetMinutes: v.number(),

    updatedAt: v.number(),
  }).index("by_userId", ["userId"]),

  // -------------------------------------------
  // Email Notification Log Table (idempotency)
  // -------------------------------------------
  emailNotificationLog: defineTable({
    toUserId: v.id("users"),
    trigger: emailNotificationTriggerValidator,
    status: v.union(v.literal("pending"), v.literal("sent"), v.literal("failed")),
    challengeId: v.optional(v.id("challenges")),
    duelId: v.optional(v.id("duels")),
    soloPracticeSessionId: v.optional(v.id("soloPracticeSessions")),
    weeklyGoalId: v.optional(v.id("weeklyGoals")),
    reminderOffsetMinutes: v.optional(v.number()),
    dedupeKey: v.optional(v.string()),
    claimedAt: v.optional(v.number()),
    sentAt: v.optional(v.number()),
    failedAt: v.optional(v.number()),
  })
    .index("by_user_trigger_weeklyGoal", ["toUserId", "trigger", "weeklyGoalId"])
    .index("by_user_trigger_weeklyGoal_dedupeKey", [
      "toUserId",
      "trigger",
      "weeklyGoalId",
      "dedupeKey",
    ])
    .index("by_user_trigger_challenge", ["toUserId", "trigger", "challengeId"])
    .index("by_user_trigger_duel", ["toUserId", "trigger", "duelId"])
    .index("by_user_trigger_soloPracticeSession", [
      "toUserId",
      "trigger",
      "soloPracticeSessionId",
    ])
    .index("by_user_trigger", ["toUserId", "trigger"])
    .index("by_status", ["status"])
    .index("by_sentAt", ["sentAt"]),
});
