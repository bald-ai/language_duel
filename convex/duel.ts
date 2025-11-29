import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const createChallenge = mutation({
  args: {
    opponentId: v.id("users"),
    challengerClerkId: v.string(),
    themeId: v.id("themes"),
  },
  handler: async ({ db }, { opponentId, challengerClerkId, themeId }) => {
    // Get challenger by clerkId
    const challenger = await db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", challengerClerkId))
      .first();
    
    if (!challenger) throw new Error("Challenger not found");
    
    // Verify theme exists
    const theme = await db.get(themeId);
    if (!theme) throw new Error("Theme not found");
    
    // Create shuffled word order using Fisher-Yates algorithm
    const wordCount = theme.words.length;
    const wordOrder = Array.from({ length: wordCount }, (_, i) => i);
    for (let i = wordOrder.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [wordOrder[i], wordOrder[j]] = [wordOrder[j], wordOrder[i]];
    }
    
    return await db.insert("challenges", {
      challengerId: challenger._id,
      opponentId,
      themeId,
      currentWordIndex: 0,
      wordOrder,
      challengerAnswered: false,
      opponentAnswered: false,
      challengerScore: 0,
      opponentScore: 0,
      status: "pending",
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
    selectedAnswer: v.string(),
  },
  handler: async ({ db }, { challengeId, userId, selectedAnswer }) => {
    const challenge = await db.get(challengeId);
    if (!challenge) throw new Error("Challenge not found");

    // Check if challenge is accepted (or handle old challenges without status)
    const status = challenge.status || "accepted"; // Default old challenges to accepted
    if (status !== "accepted") {
      throw new Error("Challenge is not active");
    }

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

    // Get theme to check correct answer
    const theme = await db.get(challenge.themeId);
    if (!theme) throw new Error("Theme not found");
    
    // Use shuffled word order if available, otherwise fall back to sequential
    const actualWordIndex = challenge.wordOrder 
      ? challenge.wordOrder[challenge.currentWordIndex] 
      : challenge.currentWordIndex;
    const currentWord = theme.words[actualWordIndex];
    const isCorrect = currentWord?.answer === selectedAnswer;
    
    // Mark as answered and update score if correct
    if (isChallenger && !challenge.challengerAnswered) {
      const newScore = isCorrect ? (challenge.challengerScore || 0) + 1 : (challenge.challengerScore || 0);
      await db.patch(challengeId, { challengerAnswered: true, challengerScore: newScore });
    } else if (isOpponent && !challenge.opponentAnswered) {
      const newScore = isCorrect ? (challenge.opponentScore || 0) + 1 : (challenge.opponentScore || 0);
      await db.patch(challengeId, { opponentAnswered: true, opponentScore: newScore });
    }

    // Check if both answered, then advance to next word
    const updatedChallenge = await db.get(challengeId);
    if (updatedChallenge?.challengerAnswered && updatedChallenge?.opponentAnswered) {
      const nextWordIndex = updatedChallenge.currentWordIndex + 1;
      
      // Get theme to check word count
      const theme = await db.get(updatedChallenge.themeId);
      const wordCount = theme?.words.length || 0;
      
      if (nextWordIndex >= wordCount) {
        // Challenge completed
        await db.patch(challengeId, {
          status: "completed",
          currentWordIndex: nextWordIndex,
          challengerAnswered: false,
          opponentAnswered: false,
        });
      } else {
        // Continue to next word
        await db.patch(challengeId, {
          currentWordIndex: nextWordIndex,
          challengerAnswered: false,
          opponentAnswered: false,
        });
      }
    }
  },
});

export const getPendingChallenges = query({
  args: { userId: v.string() },
  handler: async ({ db }, { userId }) => {
    // Get user by clerkId
    const user = await db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", userId))
      .first();
    
    if (!user) return [];

    // Get all challenges where user is opponent
    const allChallenges = await db
      .query("challenges")
      .filter((q) => q.eq(q.field("opponentId"), user._id))
      .collect();

    // Filter for pending challenges (handle old challenges without status)
    const pendingChallenges = allChallenges.filter(challenge => 
      challenge.status === "pending" || (!challenge.status && challenge.currentWordIndex === 0 && !challenge.challengerAnswered && !challenge.opponentAnswered)
    );

    // Populate with challenger info
    const result = [];
    for (const challenge of pendingChallenges) {
      const challenger = await db.get(challenge.challengerId);
      result.push({
        challenge,
        challenger,
      });
    }

    return result;
  },
});

export const acceptChallenge = mutation({
  args: {
    challengeId: v.id("challenges"),
    userId: v.string(),
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

    // Only opponent can accept
    if (challenge.opponentId !== user._id) {
      throw new Error("Only opponent can accept challenge");
    }

    await db.patch(challengeId, { status: "accepted" });
  },
});

export const rejectChallenge = mutation({
  args: {
    challengeId: v.id("challenges"),
    userId: v.string(),
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

    // Only opponent can reject
    if (challenge.opponentId !== user._id) {
      throw new Error("Only opponent can reject challenge");
    }

    await db.patch(challengeId, { status: "rejected" });
  },
});

export const stopChallenge = mutation({
  args: {
    challengeId: v.id("challenges"),
    userId: v.string(),
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

    await db.patch(challengeId, { status: "stopped" });
  },
});
