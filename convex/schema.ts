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
  }),
});
