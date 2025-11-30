import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

// Utility functions for dynamic difficulty distribution
// Target ratio: 40% Easy, 30% Medium, 30% Hard (matching original 8:6:6 for 20 words)
interface DifficultyDistribution {
  easy: number;
  medium: number;
  hard: number;
  easyEnd: number;
  mediumEnd: number;
  total: number;
}

function calculateDifficultyDistribution(wordCount: number): DifficultyDistribution {
  if (wordCount <= 0) {
    return { easy: 0, medium: 0, hard: 0, easyEnd: 0, mediumEnd: 0, total: 0 };
  }

  const baseEasy = Math.floor(wordCount * 0.4);
  const baseMedium = Math.floor(wordCount * 0.3);
  const baseHard = Math.floor(wordCount * 0.3);
  
  const assigned = baseEasy + baseMedium + baseHard;
  const remainder = wordCount - assigned;
  
  let easy = baseEasy;
  let medium = baseMedium;
  let hard = baseHard;
  
  if (remainder >= 1) easy++;
  if (remainder >= 2) medium++;
  if (remainder >= 3) hard++;
  if (remainder >= 4) easy++;
  if (remainder >= 5) medium++;
  if (remainder >= 6) hard++;
  
  return {
    easy,
    medium,
    hard,
    easyEnd: easy,
    mediumEnd: easy + medium,
    total: wordCount,
  };
}

function getPointsForIndex(index: number, distribution: DifficultyDistribution): number {
  if (index < distribution.easyEnd) return 1;
  if (index < distribution.mediumEnd) return 1.5;
  return 2;
}

function isHardModeIndex(index: number, distribution: DifficultyDistribution): boolean {
  return index >= distribution.mediumEnd;
}

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
    
    // Determine difficulty and points based on question index using dynamic distribution
    const questionIndex = challenge.currentWordIndex;
    const wordCount = theme.words.length;
    const distribution = calculateDifficultyDistribution(wordCount);
    const pointsForCorrect = getPointsForIndex(questionIndex, distribution);
    const isHardMode = isHardModeIndex(questionIndex, distribution);
    
    // For hard mode, we need to determine if "None of the above" is correct
    // using the same seeded PRNG as the client
    let isCorrect = false;
    if (isHardMode && currentWord) {
      // Replicate seeded PRNG to determine if "None" is correct
      let seed = currentWord.word.split('').reduce((acc: number, char: string, idx: number) => 
        acc + char.charCodeAt(0) * (idx + 1), 0);
      seed = seed + questionIndex * 7919;
      
      // Advance seed past wrong answer shuffling (6 wrong answers = 5 swaps)
      for (let i = 5; i > 0; i--) {
        seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      }
      
      // This determines if "None of the above" is the correct answer
      // (In hard mode, "None" is always shown - this just decides if it's correct or a trap)
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      const noneIsCorrect = (seed / 0x7fffffff) < 0.5;
      
      if (noneIsCorrect) {
        // "None of the above" is correct (real answer was hidden from options)
        isCorrect = selectedAnswer === "None of the above";
      } else {
        // "None of the above" is a trap, real answer is correct
        isCorrect = currentWord.answer === selectedAnswer;
      }
    } else {
      // Easy/Medium: just check against the correct answer
      isCorrect = currentWord?.answer === selectedAnswer;
    }
    
    // Check if this player received a hint (they requested it and it was accepted with eliminations)
    const playerRole = isChallenger ? "challenger" : "opponent";
    const receivedHint = challenge.hintRequestedBy === playerRole && 
                         challenge.hintAccepted === true && 
                         (challenge.eliminatedOptions?.length || 0) > 0;
    
    // Mark as answered and update score if correct (using difficulty-based points)
    // Also award +0.5 to hint provider if this player received a hint AND answered correctly
    // Store the selected answer so opponent can see it during countdown
    if (isChallenger && !challenge.challengerAnswered) {
      const newScore = isCorrect ? (challenge.challengerScore || 0) + pointsForCorrect : (challenge.challengerScore || 0);
      const hintBonus = (receivedHint && isCorrect) ? 0.5 : 0; // Bonus goes to opponent (hint provider) only if correct
      await db.patch(challengeId, { 
        challengerAnswered: true, 
        challengerScore: newScore,
        opponentScore: (challenge.opponentScore || 0) + hintBonus,
        challengerLastAnswer: selectedAnswer,
      });
    } else if (isOpponent && !challenge.opponentAnswered) {
      const newScore = isCorrect ? (challenge.opponentScore || 0) + pointsForCorrect : (challenge.opponentScore || 0);
      const hintBonus = (receivedHint && isCorrect) ? 0.5 : 0; // Bonus goes to challenger (hint provider) only if correct
      await db.patch(challengeId, { 
        opponentAnswered: true, 
        opponentScore: newScore,
        challengerScore: (challenge.challengerScore || 0) + hintBonus,
        opponentLastAnswer: selectedAnswer,
      });
    }

    // Check if both answered, then advance to next word
    const updatedChallenge = await db.get(challengeId);
    if (updatedChallenge?.challengerAnswered && updatedChallenge?.opponentAnswered) {
      const nextWordIndex = updatedChallenge.currentWordIndex + 1;
      
      // Get theme to check word count
      const theme = await db.get(updatedChallenge.themeId);
      const wordCount = theme?.words.length || 0;
      
      if (nextWordIndex >= wordCount) {
        // Challenge completed - reset hint state
        await db.patch(challengeId, {
          status: "completed",
          currentWordIndex: nextWordIndex,
          challengerAnswered: false,
          opponentAnswered: false,
          hintRequestedBy: undefined,
          hintAccepted: undefined,
          eliminatedOptions: undefined,
          questionStartTime: undefined,
        });
      } else {
        // Continue to next word - reset hint state and timer
        await db.patch(challengeId, {
          currentWordIndex: nextWordIndex,
          challengerAnswered: false,
          opponentAnswered: false,
          hintRequestedBy: undefined,
          hintAccepted: undefined,
          eliminatedOptions: undefined,
          questionStartTime: Date.now(),
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

    await db.patch(challengeId, { 
      status: "accepted",
      questionStartTime: Date.now(),
    });
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

// Hint system mutations
export const requestHint = mutation({
  args: {
    challengeId: v.id("challenges"),
    userId: v.string(),
  },
  handler: async ({ db }, { challengeId, userId }) => {
    const challenge = await db.get(challengeId);
    if (!challenge) throw new Error("Challenge not found");

    const user = await db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", userId))
      .first();
    if (!user) throw new Error("User not found");

    const isChallenger = challenge.challengerId === user._id;
    const isOpponent = challenge.opponentId === user._id;
    if (!isChallenger && !isOpponent) throw new Error("User not part of this challenge");

    const playerRole = isChallenger ? "challenger" : "opponent";
    const hasAnswered = isChallenger ? challenge.challengerAnswered : challenge.opponentAnswered;
    const opponentHasAnswered = isChallenger ? challenge.opponentAnswered : challenge.challengerAnswered;

    // Can only request hint if: you haven't answered, opponent has answered, no hint already requested
    if (hasAnswered) throw new Error("You already answered");
    if (!opponentHasAnswered) throw new Error("Opponent hasn't answered yet");
    if (challenge.hintRequestedBy) throw new Error("Hint already requested");

    await db.patch(challengeId, { hintRequestedBy: playerRole });
  },
});

export const acceptHint = mutation({
  args: {
    challengeId: v.id("challenges"),
    userId: v.string(),
  },
  handler: async ({ db }, { challengeId, userId }) => {
    const challenge = await db.get(challengeId);
    if (!challenge) throw new Error("Challenge not found");

    const user = await db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", userId))
      .first();
    if (!user) throw new Error("User not found");

    const isChallenger = challenge.challengerId === user._id;
    const isOpponent = challenge.opponentId === user._id;
    if (!isChallenger && !isOpponent) throw new Error("User not part of this challenge");

    const playerRole = isChallenger ? "challenger" : "opponent";

    // Can only accept hint if: you have answered and the OTHER player requested a hint
    const hasAnswered = isChallenger ? challenge.challengerAnswered : challenge.opponentAnswered;
    if (!hasAnswered) throw new Error("You haven't answered yet");

    // Check that the other player requested a hint
    const otherRole = isChallenger ? "opponent" : "challenger";
    if (challenge.hintRequestedBy !== otherRole) throw new Error("No hint request from opponent");
    if (challenge.hintAccepted) throw new Error("Hint already accepted");

    await db.patch(challengeId, { hintAccepted: true, eliminatedOptions: [] });
  },
});

export const eliminateOption = mutation({
  args: {
    challengeId: v.id("challenges"),
    userId: v.string(),
    option: v.string(),
  },
  handler: async ({ db }, { challengeId, userId, option }) => {
    const challenge = await db.get(challengeId);
    if (!challenge) throw new Error("Challenge not found");

    const user = await db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", userId))
      .first();
    if (!user) throw new Error("User not found");

    const isChallenger = challenge.challengerId === user._id;
    const isOpponent = challenge.opponentId === user._id;
    if (!isChallenger && !isOpponent) throw new Error("User not part of this challenge");

    // Only the hint provider (the one who accepted) can eliminate options
    const playerRole = isChallenger ? "challenger" : "opponent";
    const otherRole = isChallenger ? "opponent" : "challenger";
    
    // Hint provider is the one who DIDN'T request the hint
    if (challenge.hintRequestedBy !== otherRole) throw new Error("You are not the hint provider");
    if (!challenge.hintAccepted) throw new Error("Hint not accepted yet");

    // Verify the option is a wrong answer (not the correct one)
    const theme = await db.get(challenge.themeId);
    if (!theme) throw new Error("Theme not found");
    
    const actualWordIndex = challenge.wordOrder 
      ? challenge.wordOrder[challenge.currentWordIndex] 
      : challenge.currentWordIndex;
    const currentWord = theme.words[actualWordIndex];
    
    // Check if this is a hard mode question
    const wordCount = theme.words.length;
    const distribution = calculateDifficultyDistribution(wordCount);
    const isHardMode = isHardModeIndex(challenge.currentWordIndex, distribution);
    
    // For hard mode, "None of the above" is a valid option
    const isNoneOfTheAbove = option === "None of the above";
    
    if (option === currentWord.answer) {
      throw new Error("Cannot eliminate the correct answer");
    }
    
    // In hard mode, we need to check if "None of the above" is the correct answer
    // using the same seeded PRNG logic as submitAnswer
    if (isHardMode && isNoneOfTheAbove) {
      // Replicate the PRNG logic to determine if "None of the above" is correct
      let seed = (challenge._creationTime || 0) + challenge.currentWordIndex;
      for (let i = 0; i < 4; i++) {
        seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      }
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      const noneIsCorrect = (seed / 0x7fffffff) < 0.5;
      
      if (noneIsCorrect) {
        throw new Error("Cannot eliminate the correct answer");
      }
      // If noneIsCorrect is false, "None of the above" is a valid wrong answer to eliminate
    } else if (!currentWord.wrongAnswers.includes(option) && !isNoneOfTheAbove) {
      throw new Error("Invalid option");
    }

    const currentEliminated = challenge.eliminatedOptions || [];
    if (currentEliminated.includes(option)) {
      throw new Error("Option already eliminated");
    }
    if (currentEliminated.length >= 2) {
      throw new Error("Maximum 2 options can be eliminated");
    }

    await db.patch(challengeId, { 
      eliminatedOptions: [...currentEliminated, option] 
    });
  },
});

// Sabotage system - send visual distraction to opponent
const SABOTAGE_EFFECTS = ["ink", "bubbles", "emojis", "sticky", "cards"] as const;
const MAX_SABOTAGES_PER_DUEL = 5;

export const sendSabotage = mutation({
  args: {
    challengeId: v.id("challenges"),
    userId: v.string(),
    effect: v.string(),
  },
  handler: async ({ db }, { challengeId, userId, effect }) => {
    const challenge = await db.get(challengeId);
    if (!challenge) throw new Error("Challenge not found");

    const status = challenge.status || "accepted";
    if (status !== "accepted") {
      throw new Error("Challenge is not active");
    }

    // Validate effect type
    if (!SABOTAGE_EFFECTS.includes(effect as any)) {
      throw new Error("Invalid sabotage effect");
    }

    // Get user by clerkId
    const user = await db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", userId))
      .first();
    
    if (!user) throw new Error("User not found");

    const isChallenger = challenge.challengerId === user._id;
    const isOpponent = challenge.opponentId === user._id;
    
    if (!isChallenger && !isOpponent) {
      throw new Error("User not part of this challenge");
    }

    // Check sabotage usage limit
    const sabotagesUsed = isChallenger 
      ? (challenge.challengerSabotagesUsed || 0)
      : (challenge.opponentSabotagesUsed || 0);
    
    if (sabotagesUsed >= MAX_SABOTAGES_PER_DUEL) {
      throw new Error("No sabotages remaining");
    }

    // Send sabotage to the OTHER player
    const now = Date.now();
    if (isChallenger) {
      await db.patch(challengeId, {
        opponentSabotage: { effect, timestamp: now },
        challengerSabotagesUsed: sabotagesUsed + 1,
      });
    } else {
      await db.patch(challengeId, {
        challengerSabotage: { effect, timestamp: now },
        opponentSabotagesUsed: sabotagesUsed + 1,
      });
    }
  },
});

// Handle timeout - player gets 0 points for not answering in time
export const timeoutAnswer = mutation({
  args: {
    challengeId: v.id("challenges"),
    userId: v.string(),
  },
  handler: async ({ db }, { challengeId, userId }) => {
    const challenge = await db.get(challengeId);
    if (!challenge) throw new Error("Challenge not found");

    const status = challenge.status || "accepted";
    if (status !== "accepted") {
      throw new Error("Challenge is not active");
    }

    // Get user by clerkId
    const user = await db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", userId))
      .first();
    
    if (!user) throw new Error("User not found");

    const isChallenger = challenge.challengerId === user._id;
    const isOpponent = challenge.opponentId === user._id;
    
    if (!isChallenger && !isOpponent) {
      throw new Error("User not part of this challenge");
    }

    // Mark as answered with 0 points (timeout)
    if (isChallenger && !challenge.challengerAnswered) {
      await db.patch(challengeId, { 
        challengerAnswered: true,
        challengerLastAnswer: "__TIMEOUT__",
      });
    } else if (isOpponent && !challenge.opponentAnswered) {
      await db.patch(challengeId, { 
        opponentAnswered: true,
        opponentLastAnswer: "__TIMEOUT__",
      });
    }

    // Check if both answered, then advance to next word
    const updatedChallenge = await db.get(challengeId);
    if (updatedChallenge?.challengerAnswered && updatedChallenge?.opponentAnswered) {
      const nextWordIndex = updatedChallenge.currentWordIndex + 1;
      
      const theme = await db.get(updatedChallenge.themeId);
      const wordCount = theme?.words.length || 0;
      
      if (nextWordIndex >= wordCount) {
        await db.patch(challengeId, {
          status: "completed",
          currentWordIndex: nextWordIndex,
          challengerAnswered: false,
          opponentAnswered: false,
          hintRequestedBy: undefined,
          hintAccepted: undefined,
          eliminatedOptions: undefined,
          questionStartTime: undefined,
        });
      } else {
        await db.patch(challengeId, {
          currentWordIndex: nextWordIndex,
          challengerAnswered: false,
          opponentAnswered: false,
          hintRequestedBy: undefined,
          hintAccepted: undefined,
          eliminatedOptions: undefined,
          questionStartTime: Date.now(),
        });
      }
    }
  },
});
