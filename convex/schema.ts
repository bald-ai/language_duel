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
    status: v.string(), // "pending", "accepted", "rejected", "completed", "stopped"
    createdAt: v.number(),
    // Hint system fields
    hintRequestedBy: v.optional(v.union(v.literal("challenger"), v.literal("opponent"))), // Who requested a hint
    hintAccepted: v.optional(v.boolean()), // Whether the hint provider accepted
    eliminatedOptions: v.optional(v.array(v.string())), // Wrong answers eliminated (max 2)
    // Last answer tracking (for showing opponent's pick during countdown)
    challengerLastAnswer: v.optional(v.string()),
    opponentLastAnswer: v.optional(v.string()),
    // Timer - shared timestamp when current question started
    questionStartTime: v.optional(v.number()),
    // Sabotage system - tracks active effects sent to each player
    challengerSabotage: v.optional(v.object({
      effect: v.string(), // "confetti" | "ink" | "bubbles" | "emojis" | "sticky" | "cards"
      timestamp: v.number(),
    })),
    opponentSabotage: v.optional(v.object({
      effect: v.string(),
      timestamp: v.number(),
    })),
    challengerSabotagesUsed: v.optional(v.number()), // tracks how many sabotages challenger has used (max 5)
    opponentSabotagesUsed: v.optional(v.number()),
    // Countdown pause system - for pausing the between-rounds countdown
    countdownPausedBy: v.optional(v.union(v.literal("challenger"), v.literal("opponent"))), // Who paused the countdown
    countdownUnpauseRequestedBy: v.optional(v.union(v.literal("challenger"), v.literal("opponent"))), // Who requested to unpause
    countdownPausedAt: v.optional(v.number()), // Timestamp when countdown was paused (to calculate pause duration)
  })
    .index("by_challenger", ["challengerId"])
    .index("by_opponent", ["opponentId"])
    .index("by_status", ["status"]),
});
