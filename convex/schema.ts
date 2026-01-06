import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

// ===========================================
// Shared Validators
// ===========================================

const wordValidator = v.object({
  word: v.string(),
  answer: v.string(),
  wrongAnswers: v.array(v.string()),
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

const sabotageValidator = v.object({
  effect: v.string(),
  timestamp: v.number(),
});

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
    creditsMonth: v.optional(v.string()),
    // User preferences for theme system
    selectedColorSet: v.optional(v.string()),
    selectedBackground: v.optional(v.string()),
    // Archived themes (hidden from main list)
    archivedThemeIds: v.optional(v.array(v.id("themes"))),
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
  })
    .index("by_owner", ["ownerId"])
    .index("by_visibility", ["visibility"]),

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
    .index("by_sender", ["senderId"]),

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
    soloHintType: v.optional(v.string()),

    // === Solo Mode: L2 Multiple Choice Hint System ===
    soloHintL2RequestedBy: v.optional(playerRoleValidator),
    soloHintL2Accepted: v.optional(v.boolean()),
    soloHintL2WordIndex: v.optional(v.number()),
    soloHintL2Options: v.optional(v.array(v.string())),
    soloHintL2EliminatedOptions: v.optional(v.array(v.string())),
    soloHintL2Type: v.optional(v.string()),

    // === Seeded PRNG for Deterministic Random ===
    seed: v.optional(v.number()),
  })
    .index("by_challenger", ["challengerId"])
    .index("by_opponent", ["opponentId"])
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
    .index("by_status", ["status"]),
});
