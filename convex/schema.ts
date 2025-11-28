import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    clerkId: v.string(),
    email: v.string(),
    name: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
  })
    .index("by_clerk_id", ["clerkId"]),
  vocabulary: defineTable({
    spanish: v.string(),
    english: v.string(),
    category: v.optional(v.string()),
  })
    .index("by_spanish", ["spanish"]),
  challenges: defineTable({
    challengerId: v.id("users"),
    opponentId: v.id("users"),
    currentWordIndex: v.number(),
    challengerAnswered: v.boolean(),
    opponentAnswered: v.boolean(),
    status: v.optional(v.string()), // "pending", "accepted", "rejected", "completed", "stopped"
    createdAt: v.number(),
  }),
});
