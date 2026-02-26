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

const playerRoleValidator = v.union(v.literal("challenger"), v.literal("opponent"));

const duelStatusValidator = v.union(
  v.literal("pending"),
  v.literal("accepted"),
  v.literal("rejected"),
  v.literal("completed"),
  v.literal("stopped"),
  v.literal("cancelled"),
  v.literal("learning"),
  v.literal("challenging")
);

const duelModeValidator = v.union(v.literal("solo"), v.literal("classic"));

const classicDifficultyPresetValidator = v.union(
  v.literal("easy"),
  v.literal("medium"),
  v.literal("hard")
);

const wordStateValidator = v.object({
  wordIndex: v.number(),
  currentLevel: v.number(),
  completedLevel3: v.boolean(),
  answeredLevel2Plus: v.boolean(),
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

const soloHintTypeValidator = v.union(
  v.literal("letters"),
  v.literal("tts"),
  v.literal("flash"),
  v.literal("anagram")
);

const soloHintL2TypeValidator = v.union(
  v.literal("eliminate"),
  v.literal("tts"),
  v.literal("flash")
);

const learnTimerSelectionValidator = v.object({
  challengerSelection: v.optional(v.number()),
  opponentSelection: v.optional(v.number()),
  challengerConfirmed: v.optional(v.boolean()),
  opponentConfirmed: v.optional(v.boolean()),
  confirmedDuration: v.optional(v.number()),
  learnStartTime: v.optional(v.number()),
});

const soloHintRequesterStateValidator = v.object({
  wordIndex: v.number(),
  typedLetters: v.array(v.string()),
  revealedPositions: v.array(v.number()),
  level: v.optional(v.number()),
});

// ===========================================
// Schema Definition
// ===========================================

// Notification type validator
export const notificationTypeValidator = v.union(
  v.literal("friend_request"),
  v.literal("weekly_plan_invitation"),
  v.literal("scheduled_duel"),
  v.literal("duel_challenge")
);

const notificationStatusValidator = v.union(
  v.literal("pending"),
  v.literal("read"),
  v.literal("dismissed")
);

const scheduledDuelStatusValidator = v.union(
  v.literal("pending"),
  v.literal("accepted"),
  v.literal("counter_proposed"),
  v.literal("declined")
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
        v.literal("partner_locked"),
        v.literal("goal_activated")
      )
    ),
  }),
  v.object({
    challengeId: v.id("challenges"),
    themeName: v.optional(v.string()),
    mode: v.optional(duelModeValidator),
    classicDifficultyPreset: v.optional(classicDifficultyPresetValidator),
  }),
  v.object({
    scheduledDuelId: v.id("scheduledDuels"),
    themeId: v.optional(v.id("themes")),
    themeName: v.optional(v.string()),
    scheduledTime: v.optional(v.number()),
    mode: v.optional(duelModeValidator),
    isCounterProposal: v.optional(v.boolean()),
    scheduledDuelStatus: v.optional(scheduledDuelStatusValidator),
    startedDuelId: v.optional(v.id("challenges")),
  })
);

export type NotificationPayload = Infer<typeof notificationPayloadValidator>;

// Email notification trigger types
export const emailNotificationTriggerValidator = v.union(
  v.literal("immediate_duel_challenge"),
  v.literal("scheduled_duel_proposal"),
  v.literal("scheduled_duel_accepted"),
  v.literal("scheduled_duel_counter_proposed"),
  v.literal("scheduled_duel_declined"),
  v.literal("scheduled_duel_canceled"),
  v.literal("scheduled_duel_reminder"),
  v.literal("scheduled_duel_ready"),
  v.literal("weekly_goal_invite"),
  v.literal("weekly_goal_locked"),
  v.literal("weekly_goal_accepted"),
  v.literal("weekly_goal_declined"),
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
    wordType: v.optional(v.union(v.literal("nouns"), v.literal("verbs"))),
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
  // Challenges (Duels) Table
  // -------------------------------------------
  challenges: defineTable({
    // === Core Fields ===
    challengerId: v.id("users"),
    opponentId: v.id("users"),
    themeId: v.id("themes"),
    status: duelStatusValidator,
    mode: v.optional(duelModeValidator),
    createdAt: v.number(),

    // === Classic Mode: Shared Game State ===
    currentWordIndex: v.number(),
    wordOrder: v.optional(v.array(v.number())),
    challengerAnswered: v.boolean(),
    opponentAnswered: v.boolean(),
    challengerScore: v.number(),
    opponentScore: v.number(),
    classicDifficultyPreset: v.optional(classicDifficultyPresetValidator),

    // === Classic Mode: Timer State ===
    questionStartTime: v.optional(v.number()),
    questionTimerPausedAt: v.optional(v.number()),
    questionTimerPausedBy: v.optional(playerRoleValidator),

    // === Classic Mode: Last Answers (for review screen) ===
    challengerLastAnswer: v.optional(v.string()),
    opponentLastAnswer: v.optional(v.string()),

    // === Classic Mode: Hint System ===
    hintRequestedBy: v.optional(playerRoleValidator),
    hintAccepted: v.optional(v.boolean()),
    eliminatedOptions: v.optional(v.array(v.string())),

    // === Classic Mode: Countdown Pause/Skip ===
    countdownPausedBy: v.optional(playerRoleValidator),
    countdownUnpauseRequestedBy: v.optional(playerRoleValidator),
    countdownPausedAt: v.optional(v.number()),
    countdownSkipRequestedBy: v.optional(v.array(playerRoleValidator)),

    // === Classic Mode: Sabotage System ===
    challengerSabotage: v.optional(sabotageValidator),
    opponentSabotage: v.optional(sabotageValidator),
    challengerSabotagesUsed: v.optional(v.number()),
    opponentSabotagesUsed: v.optional(v.number()),

    // === Solo Mode: Learn Phase Timer ===
    learnTimerSelection: v.optional(learnTimerSelectionValidator),

    // === Solo Mode: Per-Player Word States ===
    challengerWordStates: v.optional(v.array(wordStateValidator)),
    opponentWordStates: v.optional(v.array(wordStateValidator)),

    // === Solo Mode: Per-Player Word Pools ===
    challengerActivePool: v.optional(v.array(v.number())),
    challengerRemainingPool: v.optional(v.array(v.number())),
    opponentActivePool: v.optional(v.array(v.number())),
    opponentRemainingPool: v.optional(v.array(v.number())),

    // === Solo Mode: Per-Player Current Question ===
    challengerCurrentWordIndex: v.optional(v.number()),
    challengerCurrentLevel: v.optional(v.number()),
    challengerLevel2Mode: v.optional(v.string()),
    opponentCurrentWordIndex: v.optional(v.number()),
    opponentCurrentLevel: v.optional(v.number()),
    opponentLevel2Mode: v.optional(v.string()),

    // === Solo Mode: Completion & Stats ===
    challengerCompleted: v.optional(v.boolean()),
    opponentCompleted: v.optional(v.boolean()),
    challengerStats: v.optional(playerStatsValidator),
    opponentStats: v.optional(playerStatsValidator),

    // === Solo Mode: Typing Hint System ===
    soloHintRequestedBy: v.optional(playerRoleValidator),
    soloHintAccepted: v.optional(v.boolean()),
    soloHintRequesterState: v.optional(soloHintRequesterStateValidator),
    soloHintRevealedPositions: v.optional(v.array(v.number())),
    soloHintType: v.optional(soloHintTypeValidator),

    // === Solo Mode: L2 Multiple Choice Hint System ===
    soloHintL2RequestedBy: v.optional(playerRoleValidator),
    soloHintL2Accepted: v.optional(v.boolean()),
    soloHintL2WordIndex: v.optional(v.number()),
    soloHintL2Options: v.optional(v.array(v.string())),
    soloHintL2EliminatedOptions: v.optional(v.array(v.string())),
    soloHintL2Type: v.optional(soloHintL2TypeValidator),

    // === Seeded PRNG for Deterministic Random ===
    seed: v.optional(v.number()),
  })
    .index("by_challenger", ["challengerId"])
    .index("by_opponent", ["opponentId"])
    .index("by_opponent_status", ["opponentId", "status"])
    .index("by_status", ["status"]),

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
    expiresAt: v.optional(v.number()),
    status: v.union(
      v.literal("editing"),
      v.literal("active"),
      v.literal("completed")
    ),
    createdAt: v.number(),
  })
    .index("by_creator", ["creatorId"])
    .index("by_partner", ["partnerId"])
    .index("by_status", ["status"])
    .index("by_status_createdAt", ["status", "createdAt"])
    .index("by_status_expiresAt", ["status", "expiresAt"]),

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
    scheduledDuelReminderOffsetMinutes: v.number(),
    scheduledDuelReadyEnabled: v.boolean(),

    // Weekly Goals
    weeklyGoalsEnabled: v.boolean(),
    weeklyGoalInviteEnabled: v.boolean(),
    weeklyGoalAcceptedEnabled: v.boolean(),
    weeklyGoalLockedEnabled: v.boolean(),
    weeklyGoalDeclinedEnabled: v.boolean(),
    weeklyGoalReminder1Enabled: v.boolean(),
    weeklyGoalReminder1OffsetMinutes: v.number(),
    weeklyGoalReminder2Enabled: v.boolean(),
    weeklyGoalReminder2OffsetMinutes: v.number(),

    updatedAt: v.number(),
  }).index("by_userId", ["userId"]),

  // -------------------------------------------
  // Email Notification Log Table (idempotency)
  // -------------------------------------------
  emailNotificationLog: defineTable({
    toUserId: v.id("users"),
    trigger: emailNotificationTriggerValidator,
    challengeId: v.optional(v.id("challenges")),
    scheduledDuelId: v.optional(v.id("scheduledDuels")),
    weeklyGoalId: v.optional(v.id("weeklyGoals")),
    reminderOffsetMinutes: v.optional(v.number()),
    sentAt: v.number(),
  })
    .index("by_user_trigger_scheduledDuel", ["toUserId", "trigger", "scheduledDuelId"])
    .index("by_user_trigger_weeklyGoal", ["toUserId", "trigger", "weeklyGoalId"])
    .index("by_user_trigger_challenge", ["toUserId", "trigger", "challengeId"])
    .index("by_user_trigger", ["toUserId", "trigger"])
    .index("by_user_trigger_reminder_offset", ["toUserId", "trigger", "reminderOffsetMinutes"]),

  // -------------------------------------------
  // Scheduled Duels Table
  // -------------------------------------------
  scheduledDuels: defineTable({
    proposerId: v.id("users"),
    recipientId: v.id("users"),
    themeId: v.id("themes"),
    scheduledTime: v.number(), // Unix timestamp
    status: scheduledDuelStatusValidator,
    mode: v.optional(v.union(v.literal("solo"), v.literal("classic"))),
    classicDifficultyPreset: v.optional(classicDifficultyPresetValidator),
    // Ready state tracking
    proposerReady: v.optional(v.boolean()),
    recipientReady: v.optional(v.boolean()),
    proposerReadyAt: v.optional(v.number()),
    recipientReadyAt: v.optional(v.number()),
    // Reference to started duel (if both players are ready)
    startedDuelId: v.optional(v.id("challenges")),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_proposer", ["proposerId"])
    .index("by_recipient", ["recipientId", "status"])
    .index("by_status", ["status"])
    .index("by_scheduled_time", ["scheduledTime"])
    .index("by_status_scheduled_time", ["status", "scheduledTime"]),
});
