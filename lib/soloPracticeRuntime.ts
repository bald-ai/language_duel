import {
  INITIAL_POOL_RATIO,
  POOL_EXPANSION_SIZE,
  POOL_EXPANSION_THRESHOLD,
} from "./constants";

export const LEVEL_UP_PROBABILITY = 0.66;
export const LEVEL_2_TYPING_PROBABILITY = 0.5;
export const LEVEL_1_REVERSE_PROBABILITY = 0.5;
export const SOLO_CORRECT_ADVANCE_DELAY_MS = 750;
export const SOLO_INCORRECT_ADVANCE_DELAY_MS = 2250;

export type SoloMasteryLevel = 0 | 1 | 2 | 3;
export type SoloQuestionLevel = 0 | 1 | 2 | 3;
export type SoloLevel2Mode = "typing" | "multiple_choice";
export type SoloTranslationDirection = "forward" | "reverse";
export type RandomSource = () => number;

export interface SoloWordState {
  wordIndex: number;
  masteryLevel: SoloMasteryLevel;
  completedLevel3: boolean;
  answeredLevel2Plus: boolean;
}

export interface SoloSessionState {
  initialized: boolean;
  activePool: number[];
  remainingPool: number[];
  wordStates: Map<number, SoloWordState>;
  lastQuestionIndex: number | null;
  currentWordIndex: number | null;
  questionLevel: SoloQuestionLevel;
  translationDirection: SoloTranslationDirection;
  level2Mode: SoloLevel2Mode;
  questionsAnswered: number;
  correctAnswers: number;
  completed: boolean;
}

export const initialSoloSessionState: SoloSessionState = {
  initialized: false,
  activePool: [],
  remainingPool: [],
  wordStates: new Map(),
  lastQuestionIndex: null,
  currentWordIndex: null,
  questionLevel: 1,
  translationDirection: "forward",
  level2Mode: "typing",
  questionsAnswered: 0,
  correctAnswers: 0,
  completed: false,
};

function pickFrom<T>(items: T[], random: RandomSource): T {
  return items[Math.floor(random() * items.length)];
}

function shuffle<T>(items: T[], random: RandomSource): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export function pickSoloQuestionLevel(
  mastery: SoloMasteryLevel,
  random: RandomSource
): SoloQuestionLevel {
  if (mastery === 0) return 0;
  if (mastery === 1) return random() < LEVEL_UP_PROBABILITY ? 1 : 2;
  if (mastery === 2) return random() < LEVEL_UP_PROBABILITY ? 2 : 3;
  return 3;
}

export function pickSoloQuestionDirection(
  questionLevel: SoloQuestionLevel,
  random: RandomSource
): SoloTranslationDirection {
  if (questionLevel !== 1) return "forward";
  return random() < LEVEL_1_REVERSE_PROBABILITY ? "reverse" : "forward";
}

export function pickSoloLevel2Mode(random: RandomSource): SoloLevel2Mode {
  return random() < LEVEL_2_TYPING_PROBABILITY ? "typing" : "multiple_choice";
}

export function initializeSoloSession(params: {
  wordCount: number;
  initialConfidenceByWordIndex: Record<number, SoloMasteryLevel> | null;
  random: RandomSource;
}): SoloSessionState {
  const { wordCount, initialConfidenceByWordIndex, random } = params;
  const initialPoolSize = Math.max(1, Math.floor(wordCount * INITIAL_POOL_RATIO));
  const allIndices = Array.from({ length: wordCount }, (_, index) => index);
  const shuffled = shuffle(allIndices, random);
  const activePool = shuffled.slice(0, initialPoolSize);
  const remainingPool = shuffled.slice(initialPoolSize);
  const wordStates = new Map<number, SoloWordState>();

  allIndices.forEach((wordIndex) => {
    wordStates.set(wordIndex, {
      wordIndex,
      masteryLevel: initialConfidenceByWordIndex?.[wordIndex] ?? 1,
      completedLevel3: false,
      answeredLevel2Plus: false,
    });
  });

  const firstWordIndex = pickFrom(activePool, random);
  const firstMastery = wordStates.get(firstWordIndex)?.masteryLevel ?? 1;
  const questionLevel = pickSoloQuestionLevel(firstMastery, random);

  return {
    initialized: true,
    activePool,
    remainingPool,
    wordStates,
    lastQuestionIndex: null,
    currentWordIndex: firstWordIndex,
    questionLevel,
    translationDirection: pickSoloQuestionDirection(questionLevel, random),
    level2Mode: pickSoloLevel2Mode(random),
    questionsAnswered: 0,
    correctAnswers: 0,
    completed: false,
  };
}

export function selectNextSoloQuestion(
  state: SoloSessionState,
  random: RandomSource
): SoloSessionState {
  const { activePool, wordStates, lastQuestionIndex, remainingPool } = state;
  const level2PlusCount = activePool.filter(
    (wordIndex) => wordStates.get(wordIndex)?.answeredLevel2Plus
  ).length;
  const shouldExpand =
    level2PlusCount >= Math.ceil(activePool.length * POOL_EXPANSION_THRESHOLD) &&
    remainingPool.length > 0;

  let nextActivePool = [...activePool];
  let nextRemainingPool = [...remainingPool];

  if (shouldExpand) {
    const toAdd = Math.min(POOL_EXPANSION_SIZE, remainingPool.length);
    const shuffledRemaining = shuffle(remainingPool, random);
    nextActivePool = [...activePool, ...shuffledRemaining.slice(0, toAdd)];
    nextRemainingPool = shuffledRemaining.slice(toAdd);
  }

  const incompleteWords = nextActivePool.filter(
    (wordIndex) => !wordStates.get(wordIndex)?.completedLevel3
  );
  if (incompleteWords.length === 0) {
    return { ...state, completed: true };
  }

  let candidates = incompleteWords.filter((wordIndex) => wordIndex !== lastQuestionIndex);
  if (candidates.length === 0) {
    candidates = incompleteWords;
  }

  const currentWordIndex = pickFrom(candidates, random);
  const wordState = wordStates.get(currentWordIndex);
  if (!wordState) return state;

  const questionLevel = pickSoloQuestionLevel(wordState.masteryLevel, random);

  return {
    ...state,
    activePool: nextActivePool,
    remainingPool: nextRemainingPool,
    currentWordIndex,
    questionLevel,
    translationDirection: pickSoloQuestionDirection(questionLevel, random),
    level2Mode: pickSoloLevel2Mode(random),
    lastQuestionIndex: currentWordIndex,
  };
}

export function answerSoloQuestionCorrect(
  state: SoloSessionState,
  random: RandomSource
): SoloSessionState {
  if (state.currentWordIndex === null) return state;
  const wordState = state.wordStates.get(state.currentWordIndex);
  if (!wordState) return state;

  const wordStates = new Map(state.wordStates);
  let masteryLevel = wordState.masteryLevel;
  let completedLevel3 = wordState.completedLevel3;
  let answeredLevel2Plus = wordState.answeredLevel2Plus;

  if (state.questionLevel === 1) {
    masteryLevel = random() < LEVEL_UP_PROBABILITY ? 2 : 3;
  } else if (state.questionLevel === 2) {
    masteryLevel = 3;
    answeredLevel2Plus = true;
  } else if (state.questionLevel === 3) {
    completedLevel3 = true;
    answeredLevel2Plus = true;
  }

  wordStates.set(state.currentWordIndex, {
    ...wordState,
    masteryLevel,
    completedLevel3,
    answeredLevel2Plus,
  });

  return {
    ...state,
    wordStates,
    questionsAnswered: state.questionsAnswered + 1,
    correctAnswers: state.correctAnswers + 1,
  };
}

export function answerSoloQuestionIncorrect(state: SoloSessionState): SoloSessionState {
  if (state.currentWordIndex === null) return state;
  const wordState = state.wordStates.get(state.currentWordIndex);
  if (!wordState) return state;

  const wordStates = new Map(state.wordStates);
  const masteryLevel =
    wordState.masteryLevel > 0
      ? ((wordState.masteryLevel - 1) as SoloMasteryLevel)
      : wordState.masteryLevel;

  wordStates.set(state.currentWordIndex, {
    ...wordState,
    masteryLevel,
  });

  return {
    ...state,
    wordStates,
    questionsAnswered: state.questionsAnswered + 1,
  };
}

export function answerSoloLevel0GotIt(state: SoloSessionState): SoloSessionState {
  if (state.currentWordIndex === null) return state;
  const wordState = state.wordStates.get(state.currentWordIndex);
  if (!wordState) return state;

  const wordStates = new Map(state.wordStates);
  wordStates.set(state.currentWordIndex, {
    ...wordState,
    masteryLevel: 1,
  });

  return {
    ...state,
    wordStates,
    questionsAnswered: state.questionsAnswered + 1,
    correctAnswers: state.correctAnswers + 1,
  };
}

export function answerSoloLevel0NotYet(state: SoloSessionState): SoloSessionState {
  if (state.currentWordIndex === null) return state;
  const wordState = state.wordStates.get(state.currentWordIndex);
  if (!wordState) return state;

  const wordStates = new Map(state.wordStates);
  wordStates.set(state.currentWordIndex, {
    ...wordState,
    masteryLevel: 0,
  });

  return {
    ...state,
    wordStates,
    questionsAnswered: state.questionsAnswered + 1,
  };
}
