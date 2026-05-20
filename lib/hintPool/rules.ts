import { stripIrr } from "../stringUtils";
import { buildAnagramWithSpaces, generateAnagramLetters, seededShuffle } from "../prng";
import {
  HINT_PLUS_TEN_BONUS_SECONDS,
  HINT_UNIVERSAL_TIMER_BONUS_SECONDS,
} from "./constants";
import type { HintEffect, HintQuestion, HintType } from "./types";

export function canFireHint(
  pool: readonly HintType[],
  type: HintType,
  currentQuestionHintFired: boolean
): boolean {
  return !currentQuestionHintFired && !pool.includes(type);
}

export function resolveEffect(
  type: HintType,
  question: HintQuestion,
  seed: number
): HintEffect {
  const base: HintEffect = {
    type,
    eliminatedOptions: [],
    timerBonusSeconds: HINT_UNIVERSAL_TIMER_BONUS_SECONDS,
  };

  if (type === "fifty_fifty") {
    return {
      ...base,
      eliminatedOptions: getFiftyFiftyEliminations(question, seed),
    };
  }

  if (type === "plus_ten_seconds") {
    return {
      ...base,
      timerBonusSeconds:
        HINT_UNIVERSAL_TIMER_BONUS_SECONDS + HINT_PLUS_TEN_BONUS_SECONDS,
    };
  }

  if (type === "anagram") {
    return {
      ...base,
      reveal: {
        kind: "anagram",
        value: buildShuffledAnagram(question.correctOption, seed),
      },
    };
  }

  return {
    ...base,
    reveal: {
      kind: "letterCount",
      value: getWordLetterCounts(question.correctOption),
    },
  };
}

export function getWordLetterCounts(answer: string): number[] {
  return stripIrr(answer)
    .split(/\s+/)
    .map((word) => word.length)
    .filter((length) => length > 0);
}

export function getFiftyFiftyEliminations(
  question: HintQuestion,
  seed: number
): string[] {
  const visibleOptions = question.options;
  const removalCount = Math.floor(visibleOptions.length / 2);
  if (removalCount <= 0) return [];

  const wrongOptions = visibleOptions.filter(
    (option) => option !== question.correctOption
  );
  return seededShuffle(wrongOptions, seed).slice(0, removalCount);
}

function buildShuffledAnagram(answer: string, seed: number): string {
  const base = stripIrr(answer);
  const shuffledLetters = generateAnagramLetters(base, seed);
  return buildAnagramWithSpaces(base, shuffledLetters);
}
