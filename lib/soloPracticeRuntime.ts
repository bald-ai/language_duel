import {
  answerSentenceCorrect,
  answerSentenceIncorrect,
  type SoloSentenceLevel,
} from "./soloSentenceRuntime";
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
export const SOLO_SENTENCE_INCORRECT_ADVANCE_DELAY_MS = 850;

export type SoloMasteryLevel = 0 | 1 | 2 | 3;
export type SoloQuestionLevel = 0 | 1 | 2 | 3;
export type SoloLevel2Mode = "typing" | "multiple_choice";
export type SoloTranslationDirection = "forward" | "reverse";
export type SoloPracticeItemKind = "word" | "sentence";
export type RandomSource = () => number;

export interface SoloRuntimeItem {
  kind: SoloPracticeItemKind;
  maxLevel: SoloMasteryLevel;
}

export interface SoloItemState {
  itemIndex: number;
  kind: SoloPracticeItemKind;
  maxLevel: SoloMasteryLevel;
  masteryLevel: SoloMasteryLevel;
  completedMaxLevel: boolean;
  answeredExpansionGate: boolean;
}

export interface SoloSessionState {
  initialized: boolean;
  activePool: number[];
  remainingPool: number[];
  itemStates: Map<number, SoloItemState>;
  lastItemIndex: number | null;
  currentItemIndex: number | null;
  questionKey: number;
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
  itemStates: new Map(),
  lastItemIndex: null,
  currentItemIndex: null,
  questionKey: 0,
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

export function clampSoloMasteryLevel(
  level: number,
  maxLevel: SoloMasteryLevel
): SoloMasteryLevel {
  return Math.max(0, Math.min(maxLevel, level)) as SoloMasteryLevel;
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

function pickQuestionLevelForItem(
  itemState: SoloItemState,
  random: RandomSource
): SoloQuestionLevel {
  if (itemState.kind === "sentence") {
    return clampSoloMasteryLevel(
      itemState.masteryLevel,
      itemState.maxLevel
    ) as SoloQuestionLevel;
  }
  return pickSoloQuestionLevel(itemState.masteryLevel, random);
}

function questionDirectionForItem(
  itemState: SoloItemState,
  questionLevel: SoloQuestionLevel,
  random: RandomSource
): SoloTranslationDirection {
  if (itemState.kind === "sentence") return "forward";
  return pickSoloQuestionDirection(questionLevel, random);
}

function level2ModeForItem(
  itemState: SoloItemState,
  random: RandomSource
): SoloLevel2Mode {
  if (itemState.kind === "sentence") return "typing";
  return pickSoloLevel2Mode(random);
}

export function initializeSoloSession(params: {
  items: SoloRuntimeItem[];
  initialConfidenceByItemIndex: Record<number, SoloMasteryLevel> | null;
  random: RandomSource;
}): SoloSessionState {
  const { items, initialConfidenceByItemIndex, random } = params;
  if (items.length === 0) {
    return {
      ...initialSoloSessionState,
      initialized: true,
      completed: true,
    };
  }

  const initialPoolSize = Math.max(1, Math.floor(items.length * INITIAL_POOL_RATIO));
  const allIndices = Array.from({ length: items.length }, (_, index) => index);
  const shuffled = shuffle(allIndices, random);
  const activePool = shuffled.slice(0, initialPoolSize);
  const remainingPool = shuffled.slice(initialPoolSize);
  const itemStates = new Map<number, SoloItemState>();

  items.forEach((item, itemIndex) => {
    itemStates.set(itemIndex, {
      itemIndex,
      kind: item.kind,
      maxLevel: item.maxLevel,
      masteryLevel: clampSoloMasteryLevel(
        initialConfidenceByItemIndex?.[itemIndex] ?? 1,
        item.maxLevel
      ),
      completedMaxLevel: false,
      answeredExpansionGate: false,
    });
  });

  const firstItemIndex = pickFrom(activePool, random);
  const firstItemState = itemStates.get(firstItemIndex);
  if (!firstItemState) {
    return {
      ...initialSoloSessionState,
      initialized: true,
      completed: true,
    };
  }

  const questionLevel = pickQuestionLevelForItem(firstItemState, random);

  return {
    initialized: true,
    activePool,
    remainingPool,
    itemStates,
    lastItemIndex: null,
    currentItemIndex: firstItemIndex,
    questionKey: 0,
    questionLevel,
    translationDirection: questionDirectionForItem(firstItemState, questionLevel, random),
    level2Mode: level2ModeForItem(firstItemState, random),
    questionsAnswered: 0,
    correctAnswers: 0,
    completed: false,
  };
}

export function selectNextSoloQuestion(
  state: SoloSessionState,
  random: RandomSource
): SoloSessionState {
  const { activePool, itemStates, lastItemIndex, remainingPool } = state;
  const expansionGateCount = activePool.filter(
    (itemIndex) => itemStates.get(itemIndex)?.answeredExpansionGate
  ).length;
  const shouldExpand =
    expansionGateCount >= Math.ceil(activePool.length * POOL_EXPANSION_THRESHOLD) &&
    remainingPool.length > 0;

  let nextActivePool = [...activePool];
  let nextRemainingPool = [...remainingPool];

  if (shouldExpand) {
    const toAdd = Math.min(POOL_EXPANSION_SIZE, remainingPool.length);
    const shuffledRemaining = shuffle(remainingPool, random);
    nextActivePool = [...activePool, ...shuffledRemaining.slice(0, toAdd)];
    nextRemainingPool = shuffledRemaining.slice(toAdd);
  }

  const incompleteItems = nextActivePool.filter(
    (itemIndex) => !itemStates.get(itemIndex)?.completedMaxLevel
  );
  if (incompleteItems.length === 0) {
    return { ...state, completed: true };
  }

  let candidates = incompleteItems.filter((itemIndex) => itemIndex !== lastItemIndex);
  if (candidates.length === 0) {
    candidates = incompleteItems;
  }

  const currentItemIndex = pickFrom(candidates, random);
  const itemState = itemStates.get(currentItemIndex);
  if (!itemState) return state;

  const questionLevel = pickQuestionLevelForItem(itemState, random);

  return {
    ...state,
    activePool: nextActivePool,
    remainingPool: nextRemainingPool,
    currentItemIndex,
    questionKey: state.questionKey + 1,
    questionLevel,
    translationDirection: questionDirectionForItem(itemState, questionLevel, random),
    level2Mode: level2ModeForItem(itemState, random),
    lastItemIndex: currentItemIndex,
  };
}

function answerWordCorrect(
  itemState: SoloItemState,
  questionLevel: SoloQuestionLevel,
  random: RandomSource
): SoloItemState {
  let masteryLevel = itemState.masteryLevel;
  let completedMaxLevel = itemState.completedMaxLevel;
  let answeredExpansionGate = itemState.answeredExpansionGate;

  if (questionLevel === 1) {
    masteryLevel = random() < LEVEL_UP_PROBABILITY ? 2 : 3;
  } else if (questionLevel === 2) {
    masteryLevel = 3;
    answeredExpansionGate = true;
  } else if (questionLevel === 3) {
    completedMaxLevel = true;
    answeredExpansionGate = true;
  }

  return {
    ...itemState,
    masteryLevel,
    completedMaxLevel,
    answeredExpansionGate,
  };
}

export function answerSoloQuestionCorrect(
  state: SoloSessionState,
  random: RandomSource
): SoloSessionState {
  if (state.currentItemIndex === null) return state;
  const itemState = state.itemStates.get(state.currentItemIndex);
  if (!itemState) return state;

  const itemStates = new Map(state.itemStates);
  const nextItemState =
    itemState.kind === "sentence"
      ? {
          ...itemState,
          ...answerSentenceCorrect(
            {
              masteryLevel: itemState.masteryLevel as SoloSentenceLevel,
              maxLevel: itemState.maxLevel as SoloSentenceLevel,
              completedMaxLevel: itemState.completedMaxLevel,
              answeredExpansionGate: itemState.answeredExpansionGate,
            },
            state.questionLevel as SoloSentenceLevel
          ),
        }
      : answerWordCorrect(itemState, state.questionLevel, random);

  itemStates.set(state.currentItemIndex, nextItemState);

  return {
    ...state,
    itemStates,
    questionsAnswered: state.questionsAnswered + 1,
    correctAnswers: state.correctAnswers + 1,
  };
}

export function answerSoloQuestionIncorrect(state: SoloSessionState): SoloSessionState {
  if (state.currentItemIndex === null) return state;
  const itemState = state.itemStates.get(state.currentItemIndex);
  if (!itemState) return state;

  const itemStates = new Map(state.itemStates);
  const nextItemState =
    itemState.kind === "sentence"
      ? {
          ...itemState,
          ...answerSentenceIncorrect({
            masteryLevel: itemState.masteryLevel as SoloSentenceLevel,
            maxLevel: itemState.maxLevel as SoloSentenceLevel,
            completedMaxLevel: itemState.completedMaxLevel,
            answeredExpansionGate: itemState.answeredExpansionGate,
          }),
        }
      : {
          ...itemState,
          masteryLevel:
            itemState.masteryLevel > 0
              ? ((itemState.masteryLevel - 1) as SoloMasteryLevel)
              : itemState.masteryLevel,
        };

  itemStates.set(state.currentItemIndex, nextItemState);

  return {
    ...state,
    itemStates,
    questionsAnswered: state.questionsAnswered + 1,
  };
}

export function answerSoloLevel0GotIt(state: SoloSessionState): SoloSessionState {
  if (state.currentItemIndex === null) return state;
  const itemState = state.itemStates.get(state.currentItemIndex);
  if (!itemState || itemState.kind !== "word") return state;

  const itemStates = new Map(state.itemStates);
  itemStates.set(state.currentItemIndex, {
    ...itemState,
    masteryLevel: 1,
  });

  return {
    ...state,
    itemStates,
    questionsAnswered: state.questionsAnswered + 1,
    correctAnswers: state.correctAnswers + 1,
  };
}

export function answerSoloLevel0NotYet(state: SoloSessionState): SoloSessionState {
  if (state.currentItemIndex === null) return state;
  const itemState = state.itemStates.get(state.currentItemIndex);
  if (!itemState || itemState.kind !== "word") return state;

  const itemStates = new Map(state.itemStates);
  itemStates.set(state.currentItemIndex, {
    ...itemState,
    masteryLevel: 0,
  });

  return {
    ...state,
    itemStates,
    questionsAnswered: state.questionsAnswered + 1,
  };
}
