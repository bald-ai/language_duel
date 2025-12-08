import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    clerkId: v.string(),
    email: v.string(),
    name: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
  }).index("by_clerk_id", ["clerkId"]),

  themes: defineTable({
    name: v.string(),
    description: v.string(),
    words: v.array(
      v.object({
        word: v.string(), // English word
        answer: v.string(), // Correct Spanish translation
        wrongAnswers: v.array(v.string()), // 6 wrong Spanish options
      })
    ),
    createdAt: v.number(),
  }),

  challenges: defineTable({
    challengerId: v.id("users"),
    opponentId: v.id("users"),
    themeId: v.id("themes"), // Reference to the theme used in this duel
    currentWordIndex: v.number(),
    wordOrder: v.optional(v.array(v.number())), // Shuffled indices for randomized question order
    challengerAnswered: v.boolean(),
    opponentAnswered: v.boolean(),
    challengerScore: v.number(), // Points scored by challenger
    opponentScore: v.number(), // Points scored by opponent
    status: v.string(), // "pending", "accepted", "rejected", "completed", "stopped", "learning", "challenging"
    createdAt: v.number(),
    // Hint system fields (legacy - kept for compatibility)
    hintRequestedBy: v.optional(v.union(v.literal("challenger"), v.literal("opponent"))),
    hintAccepted: v.optional(v.boolean()),
    eliminatedOptions: v.optional(v.array(v.string())),
    // Last answer tracking (legacy)
    challengerLastAnswer: v.optional(v.string()),
    opponentLastAnswer: v.optional(v.string()),
    // Timer (legacy)
    questionStartTime: v.optional(v.number()),
    // Sabotage system - tracks active effects sent to each player
    challengerSabotage: v.optional(v.object({
      effect: v.string(), // "ink" | "bubbles" | "emojis" | "sticky" | "cards"
      timestamp: v.number(),
    })),
    opponentSabotage: v.optional(v.object({
      effect: v.string(),
      timestamp: v.number(),
    })),
    challengerSabotagesUsed: v.optional(v.number()), // tracks how many sabotages used (max 5)
    opponentSabotagesUsed: v.optional(v.number()),
    // Countdown pause system (legacy)
    countdownPausedBy: v.optional(v.union(v.literal("challenger"), v.literal("opponent"))),
    countdownUnpauseRequestedBy: v.optional(v.union(v.literal("challenger"), v.literal("opponent"))),
    countdownPausedAt: v.optional(v.number()),
    
    // === NEW: Solo-style duel fields ===
    
    // Learn phase timer voting
    learnTimerSelection: v.optional(v.object({
      challengerSelection: v.optional(v.number()), // selected duration in seconds
      opponentSelection: v.optional(v.number()),
      challengerConfirmed: v.optional(v.boolean()),
      opponentConfirmed: v.optional(v.boolean()),
      confirmedDuration: v.optional(v.number()), // locked-in duration
      learnStartTime: v.optional(v.number()), // when learn phase started
    })),
    
    // Per-player word states for 3-level system
    challengerWordStates: v.optional(v.array(v.object({
      wordIndex: v.number(),
      currentLevel: v.number(), // 1, 2, or 3
      completedLevel3: v.boolean(),
      answeredLevel2Plus: v.boolean(),
    }))),
    opponentWordStates: v.optional(v.array(v.object({
      wordIndex: v.number(),
      currentLevel: v.number(),
      completedLevel3: v.boolean(),
      answeredLevel2Plus: v.boolean(),
    }))),
    
    // Per-player word pools
    challengerActivePool: v.optional(v.array(v.number())),
    challengerRemainingPool: v.optional(v.array(v.number())),
    opponentActivePool: v.optional(v.array(v.number())),
    opponentRemainingPool: v.optional(v.array(v.number())),
    
    // Per-player current question state
    challengerCurrentWordIndex: v.optional(v.number()),
    challengerCurrentLevel: v.optional(v.number()), // 1, 2, or 3
    challengerLevel2Mode: v.optional(v.string()), // "typing" | "multiple_choice"
    opponentCurrentWordIndex: v.optional(v.number()),
    opponentCurrentLevel: v.optional(v.number()),
    opponentLevel2Mode: v.optional(v.string()),
    
    // Completion tracking
    challengerCompleted: v.optional(v.boolean()),
    opponentCompleted: v.optional(v.boolean()),
    
    // Per-player stats
    challengerStats: v.optional(v.object({
      questionsAnswered: v.number(),
      correctAnswers: v.number(),
    })),
    opponentStats: v.optional(v.object({
      questionsAnswered: v.number(),
      correctAnswers: v.number(),
    })),
    
    // === Solo-style hint system ===
    // Who requested a hint (only for Level 1 questions)
    soloHintRequestedBy: v.optional(v.union(v.literal("challenger"), v.literal("opponent"))),
    // Whether the other player accepted the hint request
    soloHintAccepted: v.optional(v.boolean()),
    // Snapshot of requester's state for hint giver to see
    soloHintRequesterState: v.optional(v.object({
      wordIndex: v.number(),
      typedLetters: v.array(v.string()), // what they've typed so far
      revealedPositions: v.array(v.number()), // positions already revealed
    })),
    // Letters revealed by the hint giver (up to 3)
    soloHintRevealedPositions: v.optional(v.array(v.number())),
    // Selected hint type: "letters" (reveal letters) or "tts" (play pronunciation)
    soloHintType: v.optional(v.string()),
    
    // === Solo-style L2 Multiple Choice hint system ===
    // Who requested a hint for L2 Multiple Choice
    soloHintL2RequestedBy: v.optional(v.union(v.literal("challenger"), v.literal("opponent"))),
    // Whether the other player accepted the hint request
    soloHintL2Accepted: v.optional(v.boolean()),
    // Word index for the hint (to track which question)
    soloHintL2WordIndex: v.optional(v.number()),
    // Options to show to hint giver (shuffled order from requester's view)
    soloHintL2Options: v.optional(v.array(v.string())),
    // Wrong options eliminated by the hint giver (up to 2)
    soloHintL2EliminatedOptions: v.optional(v.array(v.string())),
    // Selected hint type: "eliminate" (remove wrong options) or "tts" (play pronunciation)
    soloHintL2Type: v.optional(v.string()),
  })
    .index("by_challenger", ["challengerId"])
    .index("by_opponent", ["opponentId"])
    .index("by_status", ["status"]),
});
