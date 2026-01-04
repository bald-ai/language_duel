/**
 * Hint system mutations for both classic and solo-style duels.
 */

import { mutation } from "./_generated/server";
import { v } from "convex/values";
import {
  getDuelParticipant,
  getOtherRole,
  hasPlayerAnswered,
  isDuelChallenging,
} from "./helpers/auth";
import {
  calculateClassicDifficultyDistribution,
  isHardModeIndex,
  isNoneOfTheAboveCorrect,
  type ClassicDifficultyPreset,
} from "./helpers/gameLogic";
import {
  HINT_TIME_BONUS_MS,
  MAX_ELIMINATED_OPTIONS_CLASSIC,
  MAX_LETTER_HINTS,
  MAX_ELIMINATED_OPTIONS_L2,
  NONE_OF_THE_ABOVE,
} from "./constants";

// ===========================================
// Classic Mode Hint System
// ===========================================

export const requestHint = mutation({
  args: { duelId: v.id("challenges") },
  handler: async (ctx, { duelId }) => {
    const { duel, playerRole } = await getDuelParticipant(ctx, duelId);
    const otherRole = getOtherRole(playerRole);

    // Mode guard: classic mode only
    if (duel.mode !== "classic") {
      throw new Error("Not a classic duel");
    }

    // Status guard: duel must be active
    if (duel.status !== "accepted") {
      throw new Error("Duel is not active");
    }

    const hasAnswered = hasPlayerAnswered(duel, playerRole);
    const opponentHasAnswered = hasPlayerAnswered(duel, otherRole);

    // Can only request hint if: you haven't answered, opponent has answered, no hint already requested
    if (hasAnswered) throw new Error("You already answered");
    if (!opponentHasAnswered) throw new Error("Opponent hasn't answered yet");
    if (duel.hintRequestedBy) throw new Error("Hint already requested");

    await ctx.db.patch(duelId, { hintRequestedBy: playerRole });
  },
});

export const acceptHint = mutation({
  args: { duelId: v.id("challenges") },
  handler: async (ctx, { duelId }) => {
    const { duel, playerRole } = await getDuelParticipant(ctx, duelId);
    const otherRole = getOtherRole(playerRole);

    // Mode guard: classic mode only
    if (duel.mode !== "classic") {
      throw new Error("Not a classic duel");
    }

    // Status guard: duel must be active
    if (duel.status !== "accepted") {
      throw new Error("Duel is not active");
    }

    // Can only accept hint if: you have answered and the OTHER player requested a hint
    const hasAnswered = hasPlayerAnswered(duel, playerRole);
    if (!hasAnswered) throw new Error("You haven't answered yet");

    // Check that the other player requested a hint
    if (duel.hintRequestedBy !== otherRole) throw new Error("No hint request from opponent");
    if (duel.hintAccepted) throw new Error("Hint already accepted");

    const now = Date.now();
    const currentStart =
      typeof duel.questionStartTime === "number" ? duel.questionStartTime : now;
    // Add time bonus by shifting start time forward
    const bumpedStart = currentStart + HINT_TIME_BONUS_MS;

    await ctx.db.patch(duelId, {
      hintAccepted: true,
      eliminatedOptions: [],
      // Pause the question timer while hint is being provided
      questionTimerPausedAt: now,
      questionTimerPausedBy: playerRole,
      // Give requester time bonus
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
    const { duel, playerRole } = await getDuelParticipant(ctx, duelId);
    const otherRole = getOtherRole(playerRole);

    // Mode guard: classic mode only
    if (duel.mode !== "classic") {
      throw new Error("Not a classic duel");
    }

    // Status guard: duel must be active
    if (duel.status !== "accepted") {
      throw new Error("Duel is not active");
    }

    // Hint provider is the one who DIDN'T request the hint
    if (duel.hintRequestedBy !== otherRole) throw new Error("You are not the hint provider");
    if (!duel.hintAccepted) throw new Error("Hint not accepted yet");

    // Verify the option is a wrong answer (not the correct one)
    const theme = await ctx.db.get(duel.themeId);
    if (!theme) throw new Error("Theme not found");

    const actualWordIndex = duel.wordOrder
      ? duel.wordOrder[duel.currentWordIndex]
      : duel.currentWordIndex;
    const currentWord = theme.words[actualWordIndex];

    // Check if this is a hard mode question
    const wordCount = theme.words.length;
    const classicPreset = (duel.classicDifficultyPreset ?? "easy") as ClassicDifficultyPreset;
    const distribution = calculateClassicDifficultyDistribution(wordCount, classicPreset);
    const isHardMode = isHardModeIndex(duel.currentWordIndex, distribution);

    // For hard mode, "None of the above" is a valid option
    const isNoneOfTheAboveOption = option === NONE_OF_THE_ABOVE;

    if (option === currentWord.answer) {
      throw new Error("Cannot eliminate the correct answer");
    }

    // In hard mode, check if "None of the above" is the correct answer
    if (isHardMode && isNoneOfTheAboveOption) {
      const noneIsCorrect = isNoneOfTheAboveCorrect(currentWord.word, duel.currentWordIndex);
      if (noneIsCorrect) {
        throw new Error("Cannot eliminate the correct answer");
      }
    } else if (!currentWord.wrongAnswers.includes(option) && !isNoneOfTheAboveOption) {
      throw new Error("Invalid option");
    }

    const currentEliminated = duel.eliminatedOptions || [];
    if (currentEliminated.includes(option)) {
      throw new Error("Option already eliminated");
    }
    if (currentEliminated.length >= MAX_ELIMINATED_OPTIONS_CLASSIC) {
      throw new Error(`Maximum ${MAX_ELIMINATED_OPTIONS_CLASSIC} options can be eliminated`);
    }

    const nextEliminated = [...currentEliminated, option];
    const update: Record<string, unknown> = {
      eliminatedOptions: nextEliminated,
    };

    // When both eliminations are provided, resume the question timer
    if (nextEliminated.length >= MAX_ELIMINATED_OPTIONS_CLASSIC) {
      const pausedAt =
        typeof duel.questionTimerPausedAt === "number" ? duel.questionTimerPausedAt : undefined;
      const pauseDuration = pausedAt ? Date.now() - pausedAt : 0;
      if (typeof duel.questionStartTime === "number") {
        update.questionStartTime = duel.questionStartTime + pauseDuration;
      }
      update.questionTimerPausedAt = undefined;
      update.questionTimerPausedBy = undefined;
    }

    await ctx.db.patch(duelId, update);
  },
});

// ===========================================
// Solo-Style Hint System (All Levels)
// ===========================================

export const requestSoloHint = mutation({
  args: {
    duelId: v.id("challenges"),
    typedLetters: v.array(v.string()),
    revealedPositions: v.array(v.number()),
  },
  handler: async (ctx, { duelId, typedLetters, revealedPositions }) => {
    const { duel, playerRole, isChallenger } = await getDuelParticipant(ctx, duelId);

    if (!isDuelChallenging(duel)) throw new Error("Not in challenging phase");

    const currentLevel = isChallenger
      ? duel.challengerCurrentLevel
      : duel.opponentCurrentLevel;
    const currentWordIndex = isChallenger
      ? duel.challengerCurrentWordIndex
      : duel.opponentCurrentWordIndex;

    // Allow re-requesting if same player; block if opponent already requested
    if (duel.soloHintRequestedBy && duel.soloHintRequestedBy !== playerRole) {
      throw new Error("Opponent already requested a hint");
    }

    await ctx.db.patch(duelId, {
      soloHintRequestedBy: playerRole,
      soloHintAccepted: false,
      soloHintRequesterState: {
        wordIndex: currentWordIndex!,
        typedLetters,
        revealedPositions,
        level: currentLevel!,
      },
      soloHintRevealedPositions: [],
      soloHintType: undefined,
    });
  },
});

export const updateSoloHintState = mutation({
  args: {
    duelId: v.id("challenges"),
    typedLetters: v.array(v.string()),
    revealedPositions: v.array(v.number()),
  },
  handler: async (ctx, { duelId, typedLetters, revealedPositions }) => {
    const { duel, playerRole, isChallenger } = await getDuelParticipant(ctx, duelId);

    const currentWordIndex = isChallenger
      ? duel.challengerCurrentWordIndex
      : duel.opponentCurrentWordIndex;
    const currentLevel = isChallenger
      ? duel.challengerCurrentLevel
      : duel.opponentCurrentLevel;

    // Can only update if this player requested the hint
    if (duel.soloHintRequestedBy !== playerRole) return;

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

export const acceptSoloHint = mutation({
  args: {
    duelId: v.id("challenges"),
    hintType: v.string(),
  },
  handler: async (ctx, { duelId, hintType }) => {
    const { duel, playerRole } = await getDuelParticipant(ctx, duelId);
    const otherRole = getOtherRole(playerRole);

    // Can only accept if the OTHER player requested
    if (duel.soloHintRequestedBy !== otherRole) throw new Error("No hint request from opponent");
    if (duel.soloHintAccepted) throw new Error("Hint already accepted");

    const allowedHintTypes = ["letters", "tts", "flash", "anagram"];
    if (!allowedHintTypes.includes(hintType)) throw new Error("Invalid hint type");

    await ctx.db.patch(duelId, {
      soloHintAccepted: true,
      soloHintType: hintType,
    });
  },
});

export const provideSoloHint = mutation({
  args: {
    duelId: v.id("challenges"),
    position: v.number(),
  },
  handler: async (ctx, { duelId, position }) => {
    const { duel, playerRole } = await getDuelParticipant(ctx, duelId);
    const otherRole = getOtherRole(playerRole);

    // Can only provide hint if the OTHER player requested and hint was accepted
    if (duel.soloHintRequestedBy !== otherRole) throw new Error("No hint request from opponent");
    if (!duel.soloHintAccepted) throw new Error("Hint not accepted yet");

    const currentRevealed = duel.soloHintRevealedPositions || [];

    if (currentRevealed.length >= MAX_LETTER_HINTS)
      throw new Error(`Maximum ${MAX_LETTER_HINTS} hints already provided`);
    if (currentRevealed.includes(position)) throw new Error("Position already revealed");

    // Can't reveal a position that was already revealed by the requester
    const requesterState = duel.soloHintRequesterState;
    if (requesterState?.revealedPositions.includes(position)) {
      throw new Error("Position already revealed by requester");
    }

    await ctx.db.patch(duelId, {
      soloHintRevealedPositions: [...currentRevealed, position],
    });
  },
});

export const cancelSoloHint = mutation({
  args: { duelId: v.id("challenges") },
  handler: async (ctx, { duelId }) => {
    const { duel, playerRole } = await getDuelParticipant(ctx, duelId);

    // Can only cancel if this player requested
    if (duel.soloHintRequestedBy !== playerRole) throw new Error("You did not request a hint");

    await ctx.db.patch(duelId, {
      soloHintRequestedBy: undefined,
      soloHintAccepted: undefined,
      soloHintRequesterState: undefined,
      soloHintRevealedPositions: undefined,
      soloHintType: undefined,
    });
  },
});

// ===========================================
// Solo-Style L2 Multiple Choice Hint System
// ===========================================

export const requestSoloHintL2 = mutation({
  args: {
    duelId: v.id("challenges"),
    options: v.array(v.string()),
  },
  handler: async (ctx, { duelId, options }) => {
    const { duel, playerRole, isChallenger } = await getDuelParticipant(ctx, duelId);

    if (!isDuelChallenging(duel)) throw new Error("Not in challenging phase");

    const currentLevel = isChallenger
      ? duel.challengerCurrentLevel
      : duel.opponentCurrentLevel;
    const currentWordIndex = isChallenger
      ? duel.challengerCurrentWordIndex
      : duel.opponentCurrentWordIndex;
    const level2Mode = isChallenger ? duel.challengerLevel2Mode : duel.opponentLevel2Mode;

    // Can only request hint on Level 2 multiple choice questions
    if (currentLevel !== 2 || level2Mode !== "multiple_choice") {
      throw new Error("Hints only available on Level 2 multiple choice questions");
    }

    // Allow re-requesting if same player; block if opponent already requested
    if (duel.soloHintL2RequestedBy && duel.soloHintL2RequestedBy !== playerRole) {
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

export const acceptSoloHintL2 = mutation({
  args: {
    duelId: v.id("challenges"),
    hintType: v.string(),
  },
  handler: async (ctx, { duelId, hintType }) => {
    const { duel, playerRole } = await getDuelParticipant(ctx, duelId);
    const otherRole = getOtherRole(playerRole);

    // Can only accept if the OTHER player requested
    if (duel.soloHintL2RequestedBy !== otherRole)
      throw new Error("No hint request from opponent");
    if (duel.soloHintL2Accepted) throw new Error("Hint already accepted");

    await ctx.db.patch(duelId, {
      soloHintL2Accepted: true,
      soloHintL2Type: hintType,
    });
  },
});

export const eliminateSoloHintL2Option = mutation({
  args: {
    duelId: v.id("challenges"),
    option: v.string(),
  },
  handler: async (ctx, { duelId, option }) => {
    const { duel, playerRole } = await getDuelParticipant(ctx, duelId);
    const otherRole = getOtherRole(playerRole);

    // Can only eliminate if the OTHER player requested and hint was accepted
    if (duel.soloHintL2RequestedBy !== otherRole)
      throw new Error("No hint request from opponent");
    if (!duel.soloHintL2Accepted) throw new Error("Hint not accepted yet");

    const currentEliminated = duel.soloHintL2EliminatedOptions || [];

    if (currentEliminated.length >= MAX_ELIMINATED_OPTIONS_L2)
      throw new Error(`Maximum ${MAX_ELIMINATED_OPTIONS_L2} options already eliminated`);
    if (currentEliminated.includes(option)) throw new Error("Option already eliminated");

    // Verify the option is NOT the correct answer
    const wordIndex = duel.soloHintL2WordIndex;
    if (wordIndex === undefined) throw new Error("No word index for hint");

    const theme = await ctx.db.get(duel.themeId);
    if (!theme) throw new Error("Theme not found");

    const currentWord = theme.words[wordIndex];
    if (!currentWord) throw new Error("Word not found");

    if (option === currentWord.answer) throw new Error("Cannot eliminate the correct answer");

    await ctx.db.patch(duelId, {
      soloHintL2EliminatedOptions: [...currentEliminated, option],
    });
  },
});

export const cancelSoloHintL2 = mutation({
  args: { duelId: v.id("challenges") },
  handler: async (ctx, { duelId }) => {
    const { duel, playerRole } = await getDuelParticipant(ctx, duelId);

    // Can only cancel if this player requested
    if (duel.soloHintL2RequestedBy !== playerRole) throw new Error("You did not request a hint");

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

