import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import type { Doc } from "./_generated/dataModel";

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

export const createDuel = mutation({
  args: {
    opponentId: v.id("users"),
    themeId: v.id("themes"),
    mode: v.optional(v.union(v.literal("solo"), v.literal("classic"))),
  },
  handler: async (ctx, { opponentId, themeId, mode }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");
    
    const challengerClerkId = identity.subject;
    // Get challenger by clerkId
    const challenger = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", challengerClerkId))
      .first();
    
    if (!challenger) throw new Error("Challenger not found");
    
    // Verify theme exists
    const theme = await ctx.db.get(themeId);
    if (!theme) throw new Error("Theme not found");
    
    // Create shuffled word order using Fisher-Yates algorithm
    const wordCount = theme.words.length;
    const wordOrder = Array.from({ length: wordCount }, (_, i) => i);
    for (let i = wordOrder.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [wordOrder[i], wordOrder[j]] = [wordOrder[j], wordOrder[i]];
    }
    
    return await ctx.db.insert("challenges", {
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
      mode: mode || "solo",
      createdAt: Date.now(),
    });
  },
});

export const getDuel = query({
  args: { duelId: v.id("challenges") },
  handler: async ({ db }, { duelId }) => {
    const duel = await db.get(duelId);
    if (!duel) return null;

    const challenger = await db.get(duel.challengerId);
    const opponent = await db.get(duel.opponentId);

    return {
      duel,
      challenger,
      opponent,
    };
  },
});

export const answerDuel = mutation({
  args: {
    duelId: v.id("challenges"),
    selectedAnswer: v.string(),
  },
  handler: async (ctx, { duelId, selectedAnswer }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");
    const userId = identity.subject;
    
    const challenge = await ctx.db.get(duelId);
    if (!challenge) throw new Error("Challenge not found");

    // Check if challenge is accepted or challenging (or handle old challenges without status)
    const status = challenge.status || "accepted"; // Default old challenges to accepted
    if (status !== "accepted" && status !== "challenging") {
      throw new Error("Challenge is not active");
    }

    // Get user by clerkId
    const user = await ctx.db
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
    const theme = await ctx.db.get(challenge.themeId);
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
      await ctx.db.patch(duelId, { 
        challengerAnswered: true, 
        challengerScore: newScore,
        opponentScore: (challenge.opponentScore || 0) + hintBonus,
        challengerLastAnswer: selectedAnswer,
      });
    } else if (isOpponent && !challenge.opponentAnswered) {
      const newScore = isCorrect ? (challenge.opponentScore || 0) + pointsForCorrect : (challenge.opponentScore || 0);
      const hintBonus = (receivedHint && isCorrect) ? 0.5 : 0; // Bonus goes to challenger (hint provider) only if correct
      await ctx.db.patch(duelId, { 
        opponentAnswered: true, 
        opponentScore: newScore,
        challengerScore: (challenge.challengerScore || 0) + hintBonus,
        opponentLastAnswer: selectedAnswer,
      });
    }

    // Check if both answered, then advance to next word
    const updatedChallenge = await ctx.db.get(duelId);
    if (updatedChallenge?.challengerAnswered && updatedChallenge?.opponentAnswered) {
      const nextWordIndex = updatedChallenge.currentWordIndex + 1;
      
      // Get theme to check word count
      const theme = await ctx.db.get(updatedChallenge.themeId);
      const wordCount = theme?.words.length || 0;
      
      if (nextWordIndex >= wordCount) {
        // Challenge completed - reset hint state and pause state
        await ctx.db.patch(duelId, {
          status: "completed",
          currentWordIndex: nextWordIndex,
          challengerAnswered: false,
          opponentAnswered: false,
          hintRequestedBy: undefined,
          hintAccepted: undefined,
          eliminatedOptions: undefined,
          questionStartTime: undefined,
          questionTimerPausedAt: undefined,
          questionTimerPausedBy: undefined,
          countdownPausedBy: undefined,
          countdownUnpauseRequestedBy: undefined,
          countdownPausedAt: undefined,
          countdownSkipRequestedBy: undefined,
        });
      } else {
        // Continue to next word - reset hint state, timer, and pause state
        await ctx.db.patch(duelId, {
          currentWordIndex: nextWordIndex,
          challengerAnswered: false,
          opponentAnswered: false,
          hintRequestedBy: undefined,
          hintAccepted: undefined,
          eliminatedOptions: undefined,
          questionStartTime: Date.now(),
          questionTimerPausedAt: undefined,
          questionTimerPausedBy: undefined,
          countdownPausedBy: undefined,
          countdownUnpauseRequestedBy: undefined,
          countdownPausedAt: undefined,
          countdownSkipRequestedBy: undefined,
        });
      }
    }
  },
});

export const getPendingDuels = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];
    const userId = identity.subject;
    
    // Get user by clerkId
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", userId))
      .first();
    
    if (!user) return [];

    // Get all challenges where user is opponent using index
    const allChallenges = await ctx.db
      .query("challenges")
      .withIndex("by_opponent", (q) => q.eq("opponentId", user._id))
      .collect();

    // Filter for pending challenges (handle old challenges without status)
    const pendingChallenges = allChallenges.filter(challenge => 
      challenge.status === "pending" || (!challenge.status && challenge.currentWordIndex === 0 && !challenge.challengerAnswered && !challenge.opponentAnswered)
    );

    // Populate with challenger info
    const result = [];
    for (const challenge of pendingChallenges) {
      const challenger = await ctx.db.get(challenge.challengerId);
      result.push({
        challenge,
        challenger,
      });
    }

    return result;
  },
});

export const acceptDuel = mutation({
  args: {
    duelId: v.id("challenges"),
  },
  handler: async (ctx, { duelId }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");
    const userId = identity.subject;
    
    const challenge = await ctx.db.get(duelId);
    if (!challenge) throw new Error("Challenge not found");

    // Get user by clerkId
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", userId))
      .first();
    
    if (!user) throw new Error("User not found");

    // Only opponent can accept
    if (challenge.opponentId !== user._id) {
      throw new Error("Only opponent can accept challenge");
    }

    // Get theme for word count
    const theme = await ctx.db.get(challenge.themeId);
    if (!theme) throw new Error("Theme not found");
    
    const wordCount = theme.words.length;
    
    // Initialize word pools: 40% active, rest in remaining
    const initialPoolSize = Math.max(1, Math.floor(wordCount * 0.4));
    
    // Create shuffled indices for both players (independent shuffles)
    const allIndices = Array.from({ length: wordCount }, (_, i) => i);
    
    // Shuffle for challenger
    const challengerShuffled = [...allIndices].sort(() => Math.random() - 0.5);
    const challengerActive = challengerShuffled.slice(0, initialPoolSize);
    const challengerRemaining = challengerShuffled.slice(initialPoolSize);
    
    // Shuffle for opponent (different order)
    const opponentShuffled = [...allIndices].sort(() => Math.random() - 0.5);
    const opponentActive = opponentShuffled.slice(0, initialPoolSize);
    const opponentRemaining = opponentShuffled.slice(initialPoolSize);
    
    // Initialize word states for both players
    const createWordStates = () => allIndices.map(idx => ({
      wordIndex: idx,
      currentLevel: 1,
      completedLevel3: false,
      answeredLevel2Plus: false,
    }));
    
    // Pick first question for each player
    const challengerFirstWord = challengerActive[Math.floor(Math.random() * challengerActive.length)];
    const opponentFirstWord = opponentActive[Math.floor(Math.random() * opponentActive.length)];
    
    // Determine initial levels (66% L1, 33% L2)
    const challengerFirstLevel = Math.random() < 0.66 ? 1 : 2;
    const opponentFirstLevel = Math.random() < 0.66 ? 1 : 2;

    // Check if this is a classic mode duel
    if (challenge.mode === "classic") {
      // Classic mode: set status to "accepted" and initialize timer
      await ctx.db.patch(duelId, {
        status: "accepted",
        questionStartTime: Date.now(),
      });
    } else {
      // Solo mode: skip learning phase - go directly to challenging
      await ctx.db.patch(duelId, {
        status: "challenging",
        questionStartTime: Date.now(),
        // Challenger state
        challengerWordStates: createWordStates(),
        challengerActivePool: challengerActive,
        challengerRemainingPool: challengerRemaining,
        challengerCurrentWordIndex: challengerFirstWord,
        challengerCurrentLevel: challengerFirstLevel,
        challengerLevel2Mode: Math.random() < 0.5 ? "typing" : "multiple_choice",
        challengerCompleted: false,
        challengerStats: { questionsAnswered: 0, correctAnswers: 0 },
        // Opponent state
        opponentWordStates: createWordStates(),
        opponentActivePool: opponentActive,
        opponentRemainingPool: opponentRemaining,
        opponentCurrentWordIndex: opponentFirstWord,
        opponentCurrentLevel: opponentFirstLevel,
        opponentLevel2Mode: Math.random() < 0.5 ? "typing" : "multiple_choice",
        opponentCompleted: false,
        opponentStats: { questionsAnswered: 0, correctAnswers: 0 },
      });
    }
  },
});

export const rejectDuel = mutation({
  args: {
    duelId: v.id("challenges"),
  },
  handler: async (ctx, { duelId }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");
    const userId = identity.subject;
    
    const challenge = await ctx.db.get(duelId);
    if (!challenge) throw new Error("Challenge not found");

    // Get user by clerkId
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", userId))
      .first();
    
    if (!user) throw new Error("User not found");

    // Only opponent can reject
    if (challenge.opponentId !== user._id) {
      throw new Error("Only opponent can reject challenge");
    }

    await ctx.db.patch(duelId, { status: "rejected" });
  },
});

export const stopDuel = mutation({
  args: {
    duelId: v.id("challenges"),
  },
  handler: async (ctx, { duelId }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");
    const userId = identity.subject;
    
    const challenge = await ctx.db.get(duelId);
    if (!challenge) throw new Error("Challenge not found");

    // Get user by clerkId
    const user = await ctx.db
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

    await ctx.db.patch(duelId, { status: "stopped" });
  },
});

// Hint system mutations
export const requestHint = mutation({
  args: {
    duelId: v.id("challenges"),
  },
  handler: async (ctx, { duelId }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");
    const userId = identity.subject;
    
    const challenge = await ctx.db.get(duelId);
    if (!challenge) throw new Error("Challenge not found");

    const user = await ctx.db
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

    await ctx.db.patch(duelId, { hintRequestedBy: playerRole });
  },
});

export const acceptHint = mutation({
  args: {
    duelId: v.id("challenges"),
  },
  handler: async (ctx, { duelId }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");
    const userId = identity.subject;
    
    const challenge = await ctx.db.get(duelId);
    if (!challenge) throw new Error("Challenge not found");

    const user = await ctx.db
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

    const now = Date.now();
    const currentStart = typeof challenge.questionStartTime === "number" ? challenge.questionStartTime : now;
    // Add +3 seconds by shifting start time forward.
    const bumpedStart = currentStart + 3000;

    await ctx.db.patch(duelId, {
      hintAccepted: true,
      eliminatedOptions: [],
      // Pause the question timer while hint is being provided
      questionTimerPausedAt: now,
      questionTimerPausedBy: playerRole,
      // Give requester +3 seconds
      questionStartTime: bumpedStart,
    });
  },
});

export const eliminateOption = mutation({
  args: {
    duelId: v.id("challenges"),
    option: v.string(),
  },
  handler: async (ctx, { duelId, option }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");
    const userId = identity.subject;
    
    const challenge = await ctx.db.get(duelId);
    if (!challenge) throw new Error("Challenge not found");

    const user = await ctx.db
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
    const theme = await ctx.db.get(challenge.themeId);
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

    const nextEliminated = [...currentEliminated, option];
    const update: Record<string, unknown> = {
      eliminatedOptions: nextEliminated,
    };

    // When both eliminations are provided, resume the question timer.
    if (nextEliminated.length >= 2) {
      const pausedAt = typeof challenge.questionTimerPausedAt === "number" ? challenge.questionTimerPausedAt : undefined;
      const pauseDuration = pausedAt ? Date.now() - pausedAt : 0;
      if (typeof challenge.questionStartTime === "number") {
        update.questionStartTime = challenge.questionStartTime + pauseDuration;
      }
      update.questionTimerPausedAt = undefined;
      update.questionTimerPausedBy = undefined;
    }

    await ctx.db.patch(duelId, update);
  },
});

// Sabotage system - send visual distraction to opponent
const SABOTAGE_EFFECTS = ["ink", "bubbles", "emojis", "sticky", "cards"] as const;
type SabotageEffect = (typeof SABOTAGE_EFFECTS)[number];
const MAX_SABOTAGES_PER_DUEL = 5;

function isValidSabotageEffect(effect: string): effect is SabotageEffect {
  return (SABOTAGE_EFFECTS as readonly string[]).includes(effect);
}

export const sendSabotage = mutation({
  args: {
    duelId: v.id("challenges"),
    effect: v.string(),
  },
  handler: async (ctx, { duelId, effect }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");
    const userId = identity.subject;
    
    const challenge = await ctx.db.get(duelId);
    if (!challenge) throw new Error("Challenge not found");

    const status = challenge.status || "accepted";
    if (status !== "accepted" && status !== "challenging") {
      throw new Error("Challenge is not active");
    }

    // Validate effect type
    if (!isValidSabotageEffect(effect)) {
      throw new Error("Invalid sabotage effect");
    }

    // Get user by clerkId
    const user = await ctx.db
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
      await ctx.db.patch(duelId, {
        opponentSabotage: { effect, timestamp: now },
        challengerSabotagesUsed: sabotagesUsed + 1,
      });
    } else {
      await ctx.db.patch(duelId, {
        challengerSabotage: { effect, timestamp: now },
        opponentSabotagesUsed: sabotagesUsed + 1,
      });
    }
  },
});

// Countdown pause system - pause the between-rounds countdown timer
export const pauseCountdown = mutation({
  args: {
    duelId: v.id("challenges"),
  },
  handler: async (ctx, { duelId }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");
    const userId = identity.subject;
    
    const challenge = await ctx.db.get(duelId);
    if (!challenge) throw new Error("Challenge not found");

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", userId))
      .first();
    if (!user) throw new Error("User not found");

    const isChallenger = challenge.challengerId === user._id;
    const isOpponent = challenge.opponentId === user._id;
    if (!isChallenger && !isOpponent) throw new Error("User not part of this challenge");

    // Can only pause if not already paused
    if (challenge.countdownPausedBy) {
      throw new Error("Countdown already paused");
    }

    const playerRole = isChallenger ? "challenger" : "opponent";
    await ctx.db.patch(duelId, { 
      countdownPausedBy: playerRole,
      countdownUnpauseRequestedBy: undefined,
      countdownPausedAt: Date.now(), // Track when we paused
    });
  },
});

// Request to unpause the countdown - requires confirmation from other player
export const requestUnpauseCountdown = mutation({
  args: {
    duelId: v.id("challenges"),
  },
  handler: async (ctx, { duelId }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");
    const userId = identity.subject;
    
    const challenge = await ctx.db.get(duelId);
    if (!challenge) throw new Error("Challenge not found");

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", userId))
      .first();
    if (!user) throw new Error("User not found");

    const isChallenger = challenge.challengerId === user._id;
    const isOpponent = challenge.opponentId === user._id;
    if (!isChallenger && !isOpponent) throw new Error("User not part of this challenge");

    // Can only request unpause if countdown is paused
    if (!challenge.countdownPausedBy) {
      throw new Error("Countdown is not paused");
    }

    const playerRole = isChallenger ? "challenger" : "opponent";
    await ctx.db.patch(duelId, { 
      countdownUnpauseRequestedBy: playerRole,
    });
  },
});

// Confirm unpause - the OTHER player confirms the unpause request
export const confirmUnpauseCountdown = mutation({
  args: {
    duelId: v.id("challenges"),
  },
  handler: async (ctx, { duelId }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");
    const userId = identity.subject;
    
    const challenge = await ctx.db.get(duelId);
    if (!challenge) throw new Error("Challenge not found");

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", userId))
      .first();
    if (!user) throw new Error("User not found");

    const isChallenger = challenge.challengerId === user._id;
    const isOpponent = challenge.opponentId === user._id;
    if (!isChallenger && !isOpponent) throw new Error("User not part of this challenge");

    // Can only confirm if there's an unpause request from the OTHER player
    if (!challenge.countdownUnpauseRequestedBy) {
      throw new Error("No unpause request pending");
    }

    const playerRole = isChallenger ? "challenger" : "opponent";
    if (challenge.countdownUnpauseRequestedBy === playerRole) {
      throw new Error("Cannot confirm your own unpause request");
    }

    // Calculate how long we were paused and adjust questionStartTime
    // This ensures the next question timer starts fresh after unpause
    const pauseDuration = challenge.countdownPausedAt 
      ? Date.now() - challenge.countdownPausedAt
      : 0;
    
    const newQuestionStartTime = challenge.questionStartTime 
      ? challenge.questionStartTime + pauseDuration 
      : undefined;

    // Clear pause state - countdown will resume
    await ctx.db.patch(duelId, { 
      countdownPausedBy: undefined,
      countdownUnpauseRequestedBy: undefined,
      countdownPausedAt: undefined,
      questionStartTime: newQuestionStartTime,
    });
  },
});

// Skip countdown - both players must agree to skip the transition countdown
export const skipCountdown = mutation({
  args: {
    duelId: v.id("challenges"),
  },
  handler: async (ctx, { duelId }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");
    const userId = identity.subject;
    
    const challenge = await ctx.db.get(duelId);
    if (!challenge) throw new Error("Challenge not found");

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", userId))
      .first();
    if (!user) throw new Error("User not found");

    const isChallenger = challenge.challengerId === user._id;
    const isOpponent = challenge.opponentId === user._id;
    if (!isChallenger && !isOpponent) throw new Error("User not part of this challenge");

    // Can't skip if countdown is paused
    if (challenge.countdownPausedBy) {
      throw new Error("Cannot skip while countdown is paused");
    }

    const playerRole = isChallenger ? "challenger" : "opponent";
    const currentSkips = challenge.countdownSkipRequestedBy || [];

    // Already requested skip
    if (currentSkips.includes(playerRole)) {
      return { bothSkipped: false };
    }

    const newSkips = [...currentSkips, playerRole] as ("challenger" | "opponent")[];
    
    // Check if both players have now requested skip
    const bothSkipped = newSkips.includes("challenger") && newSkips.includes("opponent");

    if (bothSkipped) {
      // Clear skip state - frontend will handle immediate transition
      await ctx.db.patch(duelId, {
        countdownSkipRequestedBy: newSkips,
      });
      return { bothSkipped: true };
    } else {
      await ctx.db.patch(duelId, {
        countdownSkipRequestedBy: newSkips,
      });
      return { bothSkipped: false };
    }
  },
});

// Handle timeout - player gets 0 points for not answering in time
export const timeoutAnswer = mutation({
  args: {
    duelId: v.id("challenges"),
  },
  handler: async (ctx, { duelId }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");
    const userId = identity.subject;
    
    const challenge = await ctx.db.get(duelId);
    if (!challenge) throw new Error("Challenge not found");

    const status = challenge.status || "accepted";
    if (status !== "accepted") {
      throw new Error("Challenge is not active");
    }

    // Get user by clerkId
    const user = await ctx.db
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
      await ctx.db.patch(duelId, { 
        challengerAnswered: true,
        challengerLastAnswer: "__TIMEOUT__",
      });
    } else if (isOpponent && !challenge.opponentAnswered) {
      await ctx.db.patch(duelId, { 
        opponentAnswered: true,
        opponentLastAnswer: "__TIMEOUT__",
      });
    }

    // Check if both answered, then advance to next word
    const updatedChallenge = await ctx.db.get(duelId);
    if (updatedChallenge?.challengerAnswered && updatedChallenge?.opponentAnswered) {
      const nextWordIndex = updatedChallenge.currentWordIndex + 1;
      
      const theme = await ctx.db.get(updatedChallenge.themeId);
      const wordCount = theme?.words.length || 0;
      
      if (nextWordIndex >= wordCount) {
        await ctx.db.patch(duelId, {
          status: "completed",
          currentWordIndex: nextWordIndex,
          challengerAnswered: false,
          opponentAnswered: false,
          hintRequestedBy: undefined,
          hintAccepted: undefined,
          eliminatedOptions: undefined,
          questionStartTime: undefined,
          questionTimerPausedAt: undefined,
          questionTimerPausedBy: undefined,
          countdownPausedBy: undefined,
          countdownUnpauseRequestedBy: undefined,
          countdownPausedAt: undefined,
          countdownSkipRequestedBy: undefined,
        });
      } else {
        await ctx.db.patch(duelId, {
          currentWordIndex: nextWordIndex,
          challengerAnswered: false,
          opponentAnswered: false,
          hintRequestedBy: undefined,
          hintAccepted: undefined,
          eliminatedOptions: undefined,
          questionStartTime: Date.now(),
          questionTimerPausedAt: undefined,
          questionTimerPausedBy: undefined,
          countdownPausedBy: undefined,
          countdownUnpauseRequestedBy: undefined,
          countdownPausedAt: undefined,
          countdownSkipRequestedBy: undefined,
        });
      }
    }
  },
});

// ============================================
// Solo-style duel mutations
// ============================================

// Timer options available for learn phase (in seconds)
const TIMER_OPTIONS = [60, 120, 180, 240, 300, 420, 600, 900]; // 1, 2, 3, 4, 5, 7, 10, 15 min

// Select a timer option (highlight it)
export const selectLearnTimer = mutation({
  args: {
    duelId: v.id("challenges"),
    duration: v.number(),
  },
  handler: async (ctx, { duelId, duration }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");
    const userId = identity.subject;
    
    const challenge = await ctx.db.get(duelId);
    if (!challenge) throw new Error("Challenge not found");
    if (challenge.status !== "learning") throw new Error("Not in learning phase");

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", userId))
      .first();
    if (!user) throw new Error("User not found");

    const isChallenger = challenge.challengerId === user._id;
    const isOpponent = challenge.opponentId === user._id;
    if (!isChallenger && !isOpponent) throw new Error("User not part of this challenge");

    // Validate duration
    if (!TIMER_OPTIONS.includes(duration)) throw new Error("Invalid timer duration");

    // Can't change selection if already confirmed
    const current = challenge.learnTimerSelection || {};
    if (isChallenger && current.challengerConfirmed) throw new Error("Already confirmed");
    if (isOpponent && current.opponentConfirmed) throw new Error("Already confirmed");

    // Update selection
    const update = isChallenger 
      ? { ...current, challengerSelection: duration }
      : { ...current, opponentSelection: duration };

    await ctx.db.patch(duelId, { learnTimerSelection: update });
  },
});

// Confirm timer selection
export const confirmLearnTimer = mutation({
  args: {
    duelId: v.id("challenges"),
  },
  handler: async (ctx, { duelId }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");
    const userId = identity.subject;
    
    const challenge = await ctx.db.get(duelId);
    if (!challenge) throw new Error("Challenge not found");
    if (challenge.status !== "learning") throw new Error("Not in learning phase");

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", userId))
      .first();
    if (!user) throw new Error("User not found");

    const isChallenger = challenge.challengerId === user._id;
    const isOpponent = challenge.opponentId === user._id;
    if (!isChallenger && !isOpponent) throw new Error("User not part of this challenge");

    const current = challenge.learnTimerSelection || {};
    
    // Mark as confirmed
    const update = isChallenger 
      ? { ...current, challengerConfirmed: true }
      : { ...current, opponentConfirmed: true };

    // Check if both confirmed after this update
    const bothConfirmed = (isChallenger ? true : current.challengerConfirmed) && 
                          (isOpponent ? true : current.opponentConfirmed);

    if (bothConfirmed) {
      // Use the higher of the two selections (more study time)
      const challengerDuration = current.challengerSelection || 300;
      const opponentDuration = current.opponentSelection || 300;
      const confirmedDuration = Math.max(challengerDuration, opponentDuration);
      
      update.confirmedDuration = confirmedDuration;
      update.learnStartTime = Date.now();
    }

    await ctx.db.patch(duelId, { learnTimerSelection: update });
  },
});

// Initialize challenge phase (called when learn phase ends)
export const initializeDuelChallenge = mutation({
  args: {
    duelId: v.id("challenges"),
  },
  handler: async (ctx, { duelId }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");
    const userId = identity.subject;
    
    const challenge = await ctx.db.get(duelId);
    if (!challenge) throw new Error("Challenge not found");
    if (challenge.status !== "learning") throw new Error("Not in learning phase");

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", userId))
      .first();
    if (!user) throw new Error("User not found");

    const isChallenger = challenge.challengerId === user._id;
    const isOpponent = challenge.opponentId === user._id;
    if (!isChallenger && !isOpponent) throw new Error("User not part of this challenge");

    // Re-read to handle race conditions (both players might call this)
    const freshChallenge = await ctx.db.get(duelId);
    if (!freshChallenge || freshChallenge.status === "challenging") return;

    // Get theme for word count
    const theme = await ctx.db.get(challenge.themeId);
    if (!theme) throw new Error("Theme not found");
    
    const wordCount = theme.words.length;
    
    // Initialize word pools: 40% active, rest in remaining
    const initialPoolSize = Math.max(1, Math.floor(wordCount * 0.4));
    
    // Create shuffled indices for both players (independent shuffles)
    const allIndices = Array.from({ length: wordCount }, (_, i) => i);
    
    // Shuffle for challenger
    const challengerShuffled = [...allIndices].sort(() => Math.random() - 0.5);
    const challengerActive = challengerShuffled.slice(0, initialPoolSize);
    const challengerRemaining = challengerShuffled.slice(initialPoolSize);
    
    // Shuffle for opponent (different order)
    const opponentShuffled = [...allIndices].sort(() => Math.random() - 0.5);
    const opponentActive = opponentShuffled.slice(0, initialPoolSize);
    const opponentRemaining = opponentShuffled.slice(initialPoolSize);
    
    // Initialize word states for both players
    const createWordStates = () => allIndices.map(idx => ({
      wordIndex: idx,
      currentLevel: 1,
      completedLevel3: false,
      answeredLevel2Plus: false,
    }));
    
    // Pick first question for each player
    const challengerFirstWord = challengerActive[Math.floor(Math.random() * challengerActive.length)];
    const opponentFirstWord = opponentActive[Math.floor(Math.random() * opponentActive.length)];
    
    // Determine initial levels (66% L1, 33% L2)
    const challengerFirstLevel = Math.random() < 0.66 ? 1 : 2;
    const opponentFirstLevel = Math.random() < 0.66 ? 1 : 2;
    
    await ctx.db.patch(duelId, {
      status: "challenging",
      // Challenger state
      challengerWordStates: createWordStates(),
      challengerActivePool: challengerActive,
      challengerRemainingPool: challengerRemaining,
      challengerCurrentWordIndex: challengerFirstWord,
      challengerCurrentLevel: challengerFirstLevel,
      challengerLevel2Mode: Math.random() < 0.5 ? "typing" : "multiple_choice",
      challengerCompleted: false,
      challengerStats: { questionsAnswered: 0, correctAnswers: 0 },
      // Opponent state
      opponentWordStates: createWordStates(),
      opponentActivePool: opponentActive,
      opponentRemainingPool: opponentRemaining,
      opponentCurrentWordIndex: opponentFirstWord,
      opponentCurrentLevel: opponentFirstLevel,
      opponentLevel2Mode: Math.random() < 0.5 ? "typing" : "multiple_choice",
      opponentCompleted: false,
      opponentStats: { questionsAnswered: 0, correctAnswers: 0 },
    });
  },
});

// Submit answer in solo-style challenge
export const submitSoloAnswer = mutation({
  args: {
    duelId: v.id("challenges"),
    isCorrect: v.boolean(),
  },
  handler: async (ctx, { duelId, isCorrect }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");
    const userId = identity.subject;
    
    const challenge = await ctx.db.get(duelId);
    if (!challenge) throw new Error("Challenge not found");
    if (challenge.status !== "challenging") throw new Error("Not in challenging phase");

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", userId))
      .first();
    if (!user) throw new Error("User not found");

    const isChallenger = challenge.challengerId === user._id;
    const isOpponent = challenge.opponentId === user._id;
    if (!isChallenger && !isOpponent) throw new Error("User not part of this challenge");

    // Get player-specific state
    const wordStates = isChallenger ? challenge.challengerWordStates : challenge.opponentWordStates;
    const activePool = isChallenger ? challenge.challengerActivePool : challenge.opponentActivePool;
    const remainingPool = isChallenger ? challenge.challengerRemainingPool : challenge.opponentRemainingPool;
    const currentWordIndex = isChallenger ? challenge.challengerCurrentWordIndex : challenge.opponentCurrentWordIndex;
    const currentLevel = isChallenger ? challenge.challengerCurrentLevel : challenge.opponentCurrentLevel;
    const stats = isChallenger ? challenge.challengerStats : challenge.opponentStats;

    if (!wordStates || !activePool || currentWordIndex === undefined || currentLevel === undefined || !stats) {
      throw new Error("Player state not initialized");
    }

    // Find and update word state
    const newWordStates = [...wordStates];
    const wordStateIndex = newWordStates.findIndex(ws => ws.wordIndex === currentWordIndex);
    if (wordStateIndex === -1) throw new Error("Word state not found");
    
    const wordState = { ...newWordStates[wordStateIndex] };
    
    // Update stats
    const newStats = {
      questionsAnswered: stats.questionsAnswered + 1,
      correctAnswers: isCorrect ? stats.correctAnswers + 1 : stats.correctAnswers,
    };

    if (isCorrect) {
      // Progress level
      if (currentLevel === 1) {
        wordState.currentLevel = Math.random() < 0.66 ? 2 : 3;
      } else if (currentLevel === 2) {
        wordState.currentLevel = 3;
        wordState.answeredLevel2Plus = true;
      } else if (currentLevel === 3) {
        wordState.completedLevel3 = true;
        wordState.answeredLevel2Plus = true;
      }
    } else {
      // Drop level by 1 if possible
      if (wordState.currentLevel > 1) {
        wordState.currentLevel = wordState.currentLevel - 1;
      }
    }
    
    newWordStates[wordStateIndex] = wordState;

    // Check pool expansion: 65%+ of active pool has answeredLevel2Plus
    let newActivePool = [...activePool];
    let newRemainingPool = [...(remainingPool || [])];
    
    const level2PlusCount = newActivePool.filter(idx => 
      newWordStates.find(ws => ws.wordIndex === idx)?.answeredLevel2Plus
    ).length;
    const shouldExpand = level2PlusCount >= Math.ceil(newActivePool.length * 0.65) && newRemainingPool.length > 0;

    if (shouldExpand) {
      const toAdd = Math.min(2, newRemainingPool.length);
      const shuffledRemaining = [...newRemainingPool].sort(() => Math.random() - 0.5);
      const wordsToAdd = shuffledRemaining.slice(0, toAdd);
      newActivePool = [...newActivePool, ...wordsToAdd];
      newRemainingPool = shuffledRemaining.slice(toAdd);
    }

    // Find incomplete words (not completed Level 3)
    const incompleteWords = newActivePool.filter(idx => 
      !newWordStates.find(ws => ws.wordIndex === idx)?.completedLevel3
    );

    // Check if all complete
    const isComplete = incompleteWords.length === 0;
    
    let nextWordIndex = currentWordIndex;
    let nextLevel = currentLevel;
    let nextLevel2Mode = isChallenger ? challenge.challengerLevel2Mode : challenge.opponentLevel2Mode;

    if (!isComplete) {
      // Pick next word, avoiding current if possible
      let candidates = incompleteWords.filter(idx => idx !== currentWordIndex);
      if (candidates.length === 0) candidates = incompleteWords;
      nextWordIndex = candidates[Math.floor(Math.random() * candidates.length)];

      // Determine next level based on word state
      const nextWordState = newWordStates.find(ws => ws.wordIndex === nextWordIndex);
      if (nextWordState) {
        if (nextWordState.currentLevel === 1) {
          nextLevel = Math.random() < 0.66 ? 1 : 2;
        } else if (nextWordState.currentLevel === 2) {
          nextLevel = Math.random() < 0.66 ? 2 : 3;
        } else {
          nextLevel = 3;
        }
      }
      
      nextLevel2Mode = Math.random() < 0.5 ? "typing" : "multiple_choice";
    }

    // Build update object
    const update: Record<string, unknown> = {};
    
    if (isChallenger) {
      update.challengerWordStates = newWordStates;
      update.challengerActivePool = newActivePool;
      update.challengerRemainingPool = newRemainingPool;
      update.challengerCurrentWordIndex = nextWordIndex;
      update.challengerCurrentLevel = nextLevel;
      update.challengerLevel2Mode = nextLevel2Mode;
      update.challengerCompleted = isComplete;
      update.challengerStats = newStats;
    } else {
      update.opponentWordStates = newWordStates;
      update.opponentActivePool = newActivePool;
      update.opponentRemainingPool = newRemainingPool;
      update.opponentCurrentWordIndex = nextWordIndex;
      update.opponentCurrentLevel = nextLevel;
      update.opponentLevel2Mode = nextLevel2Mode;
      update.opponentCompleted = isComplete;
      update.opponentStats = newStats;
    }

    // Check if both players completed
    const otherCompleted = isChallenger ? challenge.opponentCompleted : challenge.challengerCompleted;
    if (isComplete && otherCompleted) {
      update.status = "completed";
    }

    // Clear hint state when player moves to next question
    update.soloHintRequestedBy = undefined;
    update.soloHintAccepted = undefined;
    update.soloHintRequesterState = undefined;
    update.soloHintRevealedPositions = undefined;
    update.soloHintType = undefined;
    
    // Clear L2 hint state as well
    update.soloHintL2RequestedBy = undefined;
    update.soloHintL2Accepted = undefined;
    update.soloHintL2WordIndex = undefined;
    update.soloHintL2Options = undefined;
    update.soloHintL2EliminatedOptions = undefined;
    update.soloHintL2Type = undefined;

    await ctx.db.patch(duelId, update);
  },
});

// ============================================
// Solo-style hint system mutations (available on all levels)
// ============================================

// Request a hint from opponent (available on all levels)
export const requestSoloHint = mutation({
  args: {
    duelId: v.id("challenges"),
    typedLetters: v.array(v.string()),
    revealedPositions: v.array(v.number()),
  },
  handler: async (ctx, { duelId, typedLetters, revealedPositions }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");
    const userId = identity.subject;
    
    const challenge = await ctx.db.get(duelId);
    if (!challenge) throw new Error("Challenge not found");
    if (challenge.status !== "challenging") throw new Error("Not in challenging phase");

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", userId))
      .first();
    if (!user) throw new Error("User not found");

    const isChallenger = challenge.challengerId === user._id;
    const isOpponent = challenge.opponentId === user._id;
    if (!isChallenger && !isOpponent) throw new Error("User not part of this challenge");

    const playerRole = isChallenger ? "challenger" : "opponent";
    const currentLevel = isChallenger ? challenge.challengerCurrentLevel : challenge.opponentCurrentLevel;
    const currentWordIndex = isChallenger ? challenge.challengerCurrentWordIndex : challenge.opponentCurrentWordIndex;

    // Hints available on all levels now
    
    // Allow re-requesting if same player; block if opponent already requested
    if (challenge.soloHintRequestedBy && challenge.soloHintRequestedBy !== playerRole) {
      throw new Error("Opponent already requested a hint");
    }

    await ctx.db.patch(duelId, {
      soloHintRequestedBy: playerRole,
      soloHintAccepted: false,
      soloHintRequesterState: {
        wordIndex: currentWordIndex!,
        typedLetters,
        revealedPositions,
        level: currentLevel!, // Track level for hint giver
      },
      soloHintRevealedPositions: [],
      soloHintType: undefined,
    });
  },
});

// Update the requester's state (so hint giver sees updated typing)
export const updateSoloHintState = mutation({
  args: {
    duelId: v.id("challenges"),
    typedLetters: v.array(v.string()),
    revealedPositions: v.array(v.number()),
  },
  handler: async (ctx, { duelId, typedLetters, revealedPositions }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");
    const userId = identity.subject;
    
    const challenge = await ctx.db.get(duelId);
    if (!challenge) throw new Error("Challenge not found");

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", userId))
      .first();
    if (!user) throw new Error("User not found");

    const isChallenger = challenge.challengerId === user._id;
    const isOpponent = challenge.opponentId === user._id;
    if (!isChallenger && !isOpponent) throw new Error("User not part of this challenge");

    const playerRole = isChallenger ? "challenger" : "opponent";
    const currentWordIndex = isChallenger ? challenge.challengerCurrentWordIndex : challenge.opponentCurrentWordIndex;
    const currentLevel = isChallenger ? challenge.challengerCurrentLevel : challenge.opponentCurrentLevel;

    // Can only update if this player requested the hint
    if (challenge.soloHintRequestedBy !== playerRole) return;

    await ctx.db.patch(duelId, {
      soloHintRequesterState: {
        wordIndex: currentWordIndex!,
        typedLetters,
        revealedPositions,
        level: currentLevel,
      },
    });
  },
});

// Accept hint request with selected hint type
export const acceptSoloHint = mutation({
  args: {
    duelId: v.id("challenges"),
    hintType: v.string(), // "letters" | "tts" | "flash"
  },
  handler: async (ctx, { duelId, hintType }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");
    const userId = identity.subject;
    
    const challenge = await ctx.db.get(duelId);
    if (!challenge) throw new Error("Challenge not found");

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", userId))
      .first();
    if (!user) throw new Error("User not found");

    const isChallenger = challenge.challengerId === user._id;
    const isOpponent = challenge.opponentId === user._id;
    if (!isChallenger && !isOpponent) throw new Error("User not part of this challenge");

    const playerRole = isChallenger ? "challenger" : "opponent";
    const otherRole = isChallenger ? "opponent" : "challenger";

    // Can only accept if the OTHER player requested
    if (challenge.soloHintRequestedBy !== otherRole) throw new Error("No hint request from opponent");
    if (challenge.soloHintAccepted) throw new Error("Hint already accepted");

    const allowedHintTypes = ["letters", "tts", "flash", "anagram"];
    if (!allowedHintTypes.includes(hintType)) throw new Error("Invalid hint type");

    await ctx.db.patch(duelId, { 
      soloHintAccepted: true,
      soloHintType: hintType,
    });
  },
});

// Provide a letter hint (click on a position to reveal)
export const provideSoloHint = mutation({
  args: {
    duelId: v.id("challenges"),
    position: v.number(),
  },
  handler: async (ctx, { duelId, position }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");
    const userId = identity.subject;
    
    const challenge = await ctx.db.get(duelId);
    if (!challenge) throw new Error("Challenge not found");

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", userId))
      .first();
    if (!user) throw new Error("User not found");

    const isChallenger = challenge.challengerId === user._id;
    const isOpponent = challenge.opponentId === user._id;
    if (!isChallenger && !isOpponent) throw new Error("User not part of this challenge");

    const playerRole = isChallenger ? "challenger" : "opponent";
    const otherRole = isChallenger ? "opponent" : "challenger";

    // Can only provide hint if the OTHER player requested and hint was accepted
    if (challenge.soloHintRequestedBy !== otherRole) throw new Error("No hint request from opponent");
    if (!challenge.soloHintAccepted) throw new Error("Hint not accepted yet");

    const currentRevealed = challenge.soloHintRevealedPositions || [];
    
    // Max 3 hints
    if (currentRevealed.length >= 3) throw new Error("Maximum 3 hints already provided");
    
    // Can't reveal same position twice
    if (currentRevealed.includes(position)) throw new Error("Position already revealed");

    // Can't reveal a position that was already revealed by the requester
    const requesterState = challenge.soloHintRequesterState;
    if (requesterState?.revealedPositions.includes(position)) {
      throw new Error("Position already revealed by requester");
    }

    await ctx.db.patch(duelId, {
      soloHintRevealedPositions: [...currentRevealed, position],
    });
  },
});

// Cancel hint request (requester can cancel)
export const cancelSoloHint = mutation({
  args: {
    duelId: v.id("challenges"),
  },
  handler: async (ctx, { duelId }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");
    const userId = identity.subject;
    
    const challenge = await ctx.db.get(duelId);
    if (!challenge) throw new Error("Challenge not found");

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", userId))
      .first();
    if (!user) throw new Error("User not found");

    const isChallenger = challenge.challengerId === user._id;
    const isOpponent = challenge.opponentId === user._id;
    if (!isChallenger && !isOpponent) throw new Error("User not part of this challenge");

    const playerRole = isChallenger ? "challenger" : "opponent";

    // Can only cancel if this player requested
    if (challenge.soloHintRequestedBy !== playerRole) throw new Error("You did not request a hint");

    await ctx.db.patch(duelId, {
      soloHintRequestedBy: undefined,
      soloHintAccepted: undefined,
      soloHintRequesterState: undefined,
      soloHintRevealedPositions: undefined,
      soloHintType: undefined,
    });
  },
});

// ============================================
// Solo-style L2 Multiple Choice hint system mutations
// ============================================

// Request a hint for Level 2 Multiple Choice (removes 2 wrong options)
export const requestSoloHintL2 = mutation({
  args: {
    duelId: v.id("challenges"),
    options: v.array(v.string()), // The shuffled options the requester sees
  },
  handler: async (ctx, { duelId, options }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");
    const userId = identity.subject;
    
    const challenge = await ctx.db.get(duelId);
    if (!challenge) throw new Error("Challenge not found");
    if (challenge.status !== "challenging") throw new Error("Not in challenging phase");

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", userId))
      .first();
    if (!user) throw new Error("User not found");

    const isChallenger = challenge.challengerId === user._id;
    const isOpponent = challenge.opponentId === user._id;
    if (!isChallenger && !isOpponent) throw new Error("User not part of this challenge");

    const playerRole = isChallenger ? "challenger" : "opponent";
    const currentLevel = isChallenger ? challenge.challengerCurrentLevel : challenge.opponentCurrentLevel;
    const currentWordIndex = isChallenger ? challenge.challengerCurrentWordIndex : challenge.opponentCurrentWordIndex;
    const level2Mode = isChallenger ? challenge.challengerLevel2Mode : challenge.opponentLevel2Mode;

    // Can only request hint on Level 2 multiple choice questions
    if (currentLevel !== 2 || level2Mode !== "multiple_choice") {
      throw new Error("Hints only available on Level 2 multiple choice questions");
    }
    
    // Allow re-requesting if same player; block if opponent already requested
    if (challenge.soloHintL2RequestedBy && challenge.soloHintL2RequestedBy !== playerRole) {
      throw new Error("Opponent already requested a hint");
    }

    await ctx.db.patch(duelId, {
      soloHintL2RequestedBy: playerRole,
      soloHintL2Accepted: false,
      soloHintL2WordIndex: currentWordIndex!,
      soloHintL2Options: options,
      soloHintL2EliminatedOptions: [],
      soloHintL2Type: undefined,
    });
  },
});

// Accept L2 hint request with selected hint type
export const acceptSoloHintL2 = mutation({
  args: {
    duelId: v.id("challenges"),
    hintType: v.string(), // "eliminate" or "tts"
  },
  handler: async (ctx, { duelId, hintType }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");
    const userId = identity.subject;
    
    const challenge = await ctx.db.get(duelId);
    if (!challenge) throw new Error("Challenge not found");

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", userId))
      .first();
    if (!user) throw new Error("User not found");

    const isChallenger = challenge.challengerId === user._id;
    const isOpponent = challenge.opponentId === user._id;
    if (!isChallenger && !isOpponent) throw new Error("User not part of this challenge");

    const playerRole = isChallenger ? "challenger" : "opponent";
    const otherRole = isChallenger ? "opponent" : "challenger";

    // Can only accept if the OTHER player requested
    if (challenge.soloHintL2RequestedBy !== otherRole) throw new Error("No hint request from opponent");
    if (challenge.soloHintL2Accepted) throw new Error("Hint already accepted");

    await ctx.db.patch(duelId, { 
      soloHintL2Accepted: true,
      soloHintL2Type: hintType,
    });
  },
});

// Eliminate a wrong option (hint giver can eliminate up to 2)
export const eliminateSoloHintL2Option = mutation({
  args: {
    duelId: v.id("challenges"),
    option: v.string(),
  },
  handler: async (ctx, { duelId, option }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");
    const userId = identity.subject;
    
    const challenge = await ctx.db.get(duelId);
    if (!challenge) throw new Error("Challenge not found");

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", userId))
      .first();
    if (!user) throw new Error("User not found");

    const isChallenger = challenge.challengerId === user._id;
    const isOpponent = challenge.opponentId === user._id;
    if (!isChallenger && !isOpponent) throw new Error("User not part of this challenge");

    const playerRole = isChallenger ? "challenger" : "opponent";
    const otherRole = isChallenger ? "opponent" : "challenger";

    // Can only eliminate if the OTHER player requested and hint was accepted
    if (challenge.soloHintL2RequestedBy !== otherRole) throw new Error("No hint request from opponent");
    if (!challenge.soloHintL2Accepted) throw new Error("Hint not accepted yet");

    const currentEliminated = challenge.soloHintL2EliminatedOptions || [];
    
    // Max 2 eliminations
    if (currentEliminated.length >= 2) throw new Error("Maximum 2 options already eliminated");
    
    // Can't eliminate same option twice
    if (currentEliminated.includes(option)) throw new Error("Option already eliminated");

    // Verify the option is in the list and is NOT the correct answer
    const wordIndex = challenge.soloHintL2WordIndex;
    if (wordIndex === undefined) throw new Error("No word index for hint");
    
    const theme = await ctx.db.get(challenge.themeId);
    if (!theme) throw new Error("Theme not found");
    
    const currentWord = theme.words[wordIndex];
    if (!currentWord) throw new Error("Word not found");
    
    // Don't allow eliminating the correct answer
    if (option === currentWord.answer) throw new Error("Cannot eliminate the correct answer");

    await ctx.db.patch(duelId, {
      soloHintL2EliminatedOptions: [...currentEliminated, option],
    });
  },
});

// Cancel L2 hint request (requester can cancel)
export const cancelSoloHintL2 = mutation({
  args: {
    duelId: v.id("challenges"),
  },
  handler: async (ctx, { duelId }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");
    const userId = identity.subject;
    
    const challenge = await ctx.db.get(duelId);
    if (!challenge) throw new Error("Challenge not found");

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", userId))
      .first();
    if (!user) throw new Error("User not found");

    const isChallenger = challenge.challengerId === user._id;
    const isOpponent = challenge.opponentId === user._id;
    if (!isChallenger && !isOpponent) throw new Error("User not part of this challenge");

    const playerRole = isChallenger ? "challenger" : "opponent";

    // Can only cancel if this player requested
    if (challenge.soloHintL2RequestedBy !== playerRole) throw new Error("You did not request a hint");

    await ctx.db.patch(duelId, {
      soloHintL2RequestedBy: undefined,
      soloHintL2Accepted: undefined,
      soloHintL2WordIndex: undefined,
      soloHintL2Options: undefined,
      soloHintL2EliminatedOptions: undefined,
      soloHintL2Type: undefined,
    });
  },
});
