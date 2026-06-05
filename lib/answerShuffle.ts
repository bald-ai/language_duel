/**
 * Answer shuffling utilities for duel questions.
 * Uses seeded PRNG so the server can prepare a stable duel-question snapshot.
 */

import { hashSeed, seededShuffle, mulberry32 } from "./prng";
import { HARD_MODE_NONE_CHANCE } from "./constants";
import { RELAY_QUESTION_POINTS } from "./duelConstants";
import {
  DIFFICULTY_POINTS,
  DIFFICULTY_WRONG_COUNT,
  calculateDuelDifficultyDistribution,
  getDifficultyForIndex,
  type DuelDifficultyPreset,
} from "./difficultyUtils";
import { buildSentenceQuestionSnapshot } from "./sentenceGameplay/engine";
import { SENTENCE_DISTRACTOR_COUNT_BY_LEVEL } from "./themes/sentenceConstants";
import type { SentenceQuestionSnapshot } from "./sentenceGameplay/types";
import {
  isSessionSentenceItem,
  isSessionWordItem,
  type SessionItem,
} from "./sessionItems";
import type { DifficultyInfo, DifficultyLevel, WordEntry, ShuffleDifficultyInfo } from "./types";

export const NONE_OF_ABOVE = "None of the above" as const;

export interface WordQuestionSnapshot {
  kind: "word";
  options: string[];
  correctOption: string;
  difficulty: DifficultyLevel;
  points: number;
}

/**
 * Mixed-content question snapshot. Word positions render multiple-choice grids;
 * sentence positions render the tile-builder board. Parallel to `itemOrder`.
 */
export type DuelQuestionSnapshot = WordQuestionSnapshot | SentenceQuestionSnapshot;

function getPointsForDifficulty(difficulty: ShuffleDifficultyInfo | DifficultyInfo): number {
  return "points" in difficulty ? difficulty.points : DIFFICULTY_POINTS[difficulty.level];
}

/**
 * Builds the authoritative answer snapshot for a word duel question.
 */
export function buildDuelQuestionSnapshot(
  word: WordEntry,
  questionIndex: number,
  difficulty: ShuffleDifficultyInfo
): WordQuestionSnapshot {
  if (!word.wrongAnswers?.length) {
    return {
      kind: "word",
      options: [],
      correctOption: word.answer,
      difficulty: difficulty.level,
      points: getPointsForDifficulty(difficulty),
    };
  }

  // Create seed from word content + question index for deterministic shuffle
  const seedString = `${word.word}::${questionIndex}`;
  const baseSeed = hashSeed(seedString);
  const random = mulberry32(baseSeed);

  // Shuffle all wrong answers first, then pick the required count
  const shuffledWrong = seededShuffle(word.wrongAnswers, baseSeed);
  const selectedWrong = shuffledWrong.slice(0, difficulty.wrongCount);

  let answers: string[];
  let correctOption = word.answer;

  if (difficulty.level === "hard") {
    // For hard: configurable chance "None of the above" is the correct answer
    const noneIsCorrect = random() < HARD_MODE_NONE_CHANCE;
    if (noneIsCorrect) {
      // All options are wrong + "None of the above" (which is correct)
      answers = [...selectedWrong, NONE_OF_ABOVE];
      correctOption = NONE_OF_ABOVE;
    } else {
      // Correct answer + wrong decoys + "None of the above" (which is wrong).
      // Drop one wrong answer so "None" takes its slot and the total still
      // matches the hard-mode option count.
      const fewerWrong = selectedWrong.slice(0, Math.max(0, difficulty.wrongCount - 1));
      answers = [word.answer, ...fewerWrong, NONE_OF_ABOVE];
    }
  } else {
    // Easy/medium: correct answer + wrong answers
    answers = [word.answer, ...selectedWrong];
  }

  // Final shuffle of all options using a new seed offset
  const shuffleSeed = hashSeed(`${seedString}::final`);
  return {
    kind: "word",
    options: seededShuffle(answers, shuffleSeed),
    correctOption,
    difficulty: difficulty.level,
    points: getPointsForDifficulty(difficulty),
  };
}

/**
 * Mixed-content question set. Word items get the progressive-difficulty
 * snapshot; sentence items get the deterministic tile-pool snapshot. The two
 * snapshots share the same `itemOrder`-indexed array shape so consumers walk
 * positions uniformly and branch on `snapshot.kind`.
 */
export function buildDuelQuestionSet(
  items: SessionItem[],
  itemOrder: number[],
  preset: DuelDifficultyPreset = "easy"
): DuelQuestionSnapshot[] {
  // Word-only positions drive the progressive difficulty distribution; sentence
  // positions don't participate in that distribution — the preset instead picks
  // how many distractors each sentence shows (handled below).
  const wordPositionCount = itemOrder.reduce((count, sessionIndex) => {
    return isSessionWordItem(items[sessionIndex]) ? count + 1 : count;
  }, 0);
  const distribution = calculateDuelDifficultyDistribution(wordPositionCount, preset);

  let wordPositionIndex = 0;
  return itemOrder.map((sessionIndex, questionIndex) => {
    const item = items[sessionIndex];
    if (isSessionSentenceItem(item)) {
      // Uniform mapping (decision: sentence difficulty): every sentence in the
      // duel shows the same count for the duel's single preset. Boss has no
      // picker and resolves to "easy" → 1 distractor automatically. The count
      // always comes from the constant, never a literal here.
      return buildSentenceQuestionSnapshot({
        englishPrompt: item.englishPrompt,
        spanishSentence: item.spanishSentence,
        wordMeanings: item.wordMeanings,
        freeWordPositions: item.freeWordPositions,
        distractors: item.distractors,
        questionIndex,
        distractorCount: SENTENCE_DISTRACTOR_COUNT_BY_LEVEL[preset],
      });
    }
    const difficulty = getDifficultyForIndex(wordPositionIndex, distribution);
    wordPositionIndex += 1;
    return buildDuelQuestionSnapshot(item, questionIndex, difficulty);
  });
}

// Relay served word questions are a single fixed difficulty worth a flat point
// (decisions #10/#11). "medium" is the base snapshot; "hard" is the upgrade
// variant. Both emit 6 options, so the grid stays visually stable. Sentence
// positions are built identically for both levels (a fixed easy distractor
// count, never 🔥-upgraded in v1), so `duelQuestions[idx]` and
// `relayHardQuestions[idx]` yield the same sentence pool — the answerer's board
// always equals the board the validator reads (plan R1).
export type RelayQuestionLevel = "medium" | "hard";

export function buildRelayQuestionSet(
  items: SessionItem[],
  itemOrder: number[],
  level: RelayQuestionLevel
): DuelQuestionSnapshot[] {
  return itemOrder.map((sessionIndex, questionIndex) => {
    const item = items[sessionIndex];
    if (isSessionSentenceItem(item)) {
      // Fixed count (never 🔥-upgraded in v1), so the medium and hard sets emit
      // an identical sentence pool — indices always align. Relay sentences show
      // 1 distractor (easy). The count comes from the table, never a literal.
      return buildSentenceQuestionSnapshot({
        englishPrompt: item.englishPrompt,
        spanishSentence: item.spanishSentence,
        wordMeanings: item.wordMeanings,
        freeWordPositions: item.freeWordPositions,
        distractors: item.distractors,
        questionIndex,
        distractorCount: SENTENCE_DISTRACTOR_COUNT_BY_LEVEL.easy,
      });
    }
    if (!isSessionWordItem(item)) {
      throw new Error("unknown session item kind");
    }
    return {
      ...buildDuelQuestionSnapshot(item, questionIndex, {
        level,
        wrongCount: DIFFICULTY_WRONG_COUNT[level],
      }),
      points: RELAY_QUESTION_POINTS,
    };
  });
}

export function isWordQuestionSnapshot(
  snapshot: DuelQuestionSnapshot | undefined
): snapshot is WordQuestionSnapshot {
  return snapshot?.kind === "word";
}

export function isSentenceQuestionSnapshot(
  snapshot: DuelQuestionSnapshot | undefined
): snapshot is SentenceQuestionSnapshot {
  return snapshot?.kind === "sentence";
}
