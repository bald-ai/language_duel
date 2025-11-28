import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const createChallenge = mutation({
  args: {
    opponentId: v.id("users"),
    challengerClerkId: v.string(),
  },
  handler: async ({ db }, { opponentId, challengerClerkId }) => {
    // Get challenger by clerkId
    const challenger = await db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", challengerClerkId))
      .first();
    
    if (!challenger) throw new Error("Challenger not found");
    
    return await db.insert("challenges", {
      challengerId: challenger._id,
      opponentId,
      currentWordIndex: 0,
      challengerAnswered: false,
      opponentAnswered: false,
      createdAt: Date.now(),
    });
  },
});

export const getChallenge = query({
  args: { challengeId: v.id("challenges") },
  handler: async ({ db }, { challengeId }) => {
    const challenge = await db.get(challengeId);
    if (!challenge) return null;

    const challenger = await db.get(challenge.challengerId);
    const opponent = await db.get(challenge.opponentId);

    return {
      challenge,
      challenger,
      opponent,
    };
  },
});

export const answerChallenge = mutation({
  args: {
    challengeId: v.id("challenges"),
    userId: v.string(),
    isCorrect: v.boolean(),
  },
  handler: async ({ db }, { challengeId, userId }) => {
    const challenge = await db.get(challengeId);
    if (!challenge) throw new Error("Challenge not found");

    // Get user by clerkId
    const user = await db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", userId))
      .first();
    
    if (!user) throw new Error("User not found");

    // Check if user is part of this challenge
    const isChallenger = challenge.challengerId === user._id;
    const isOpponent = challenge.opponentId === user._id;
    
    if (!isChallenger && !isOpponent) {
      throw new Error("User not part of this challenge");
    }

    // Mark as answered
    if (isChallenger && !challenge.challengerAnswered) {
      await db.patch(challengeId, { challengerAnswered: true });
    } else if (isOpponent && !challenge.opponentAnswered) {
      await db.patch(challengeId, { opponentAnswered: true });
    }

    // Check if both answered, then advance to next word
    const updatedChallenge = await db.get(challengeId);
    if (updatedChallenge?.challengerAnswered && updatedChallenge?.opponentAnswered) {
      await db.patch(challengeId, {
        currentWordIndex: updatedChallenge.currentWordIndex + 1,
        challengerAnswered: false,
        opponentAnswered: false,
      });
    }
  },
});
