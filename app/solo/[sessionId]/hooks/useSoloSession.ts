"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  INITIAL_POOL_RATIO,
  POOL_EXPANSION_THRESHOLD,
  POOL_EXPANSION_COUNT,
  LEVEL_UP_CHANCE,
  LEVEL2_TYPING_CHANCE,
} from "../constants";

// Types
export interface WordState {
  wordIndex: number;
  masteryLevel: 0 | 1 | 2 | 3;
  completedLevel3: boolean;
  answeredLevel2Plus: boolean;
}

export interface SessionState {
  initialized: boolean;
  activePool: number[];
  remainingPool: number[];
  wordStates: Map<number, WordState>;
  lastQuestionIndex: number | null;
  currentWordIndex: number | null;
  questionLevel: 0 | 1 | 2 | 3;
  level2Mode: "typing" | "multiple_choice";
  questionsAnswered: number;
  correctAnswers: number;
  completed: boolean;
}

export interface WordEntry {
  word: string;
  answer: string;
  wrongAnswers: string[];
}

interface UseSoloSessionParams {
  words: WordEntry[] | undefined;
  initialConfidenceByWordIndex: Record<number, 0 | 1 | 2 | 3> | null;
}

interface UseSoloSessionResult {
  session: SessionState;
  showFeedback: boolean;
  feedbackCorrect: boolean;
  feedbackAnswer: string | null;
  elapsedTime: number;
  // Actions
  handleCorrect: () => void;
  handleIncorrect: () => void;
  handleLevel0GotIt: () => void;
  handleLevel0NotYet: () => void;
  // Derived
  currentWord: WordEntry | null;
  masteredCount: number;
}

const initialSession: SessionState = {
  initialized: false,
  activePool: [],
  remainingPool: [],
  wordStates: new Map(),
  lastQuestionIndex: null,
  currentWordIndex: null,
  questionLevel: 1,
  level2Mode: "typing",
  questionsAnswered: 0,
  correctAnswers: 0,
  completed: false,
};

/**
 * Manages the solo challenge session state machine.
 * Handles word pool management, mastery progression, and question selection.
 */
export function useSoloSession({
  words,
  initialConfidenceByWordIndex,
}: UseSoloSessionParams): UseSoloSessionResult {
  const [session, setSession] = useState<SessionState>(initialSession);
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedbackCorrect, setFeedbackCorrect] = useState(false);
  const [feedbackAnswer, setFeedbackAnswer] = useState<string | null>(null);

  // Timer state
  const [startTime, setStartTime] = useState<number | null>(null);
  const [elapsedTime, setElapsedTime] = useState(0);

  /**
   * Determines question level based on current mastery.
   * Uses probabilistic progression for natural learning curve.
   */
  const pickQuestionLevel = useCallback((mastery: 0 | 1 | 2 | 3): 0 | 1 | 2 | 3 => {
    if (mastery === 0) return 0;
    if (mastery === 1) return Math.random() < LEVEL_UP_CHANCE ? 1 : 2;
    if (mastery === 2) return Math.random() < LEVEL_UP_CHANCE ? 2 : 3;
    return 3;
  }, []);

  // Initialize session when words load
  useEffect(() => {
    if (words && words.length > 0 && !session.initialized) {
      const totalWords = words.length;

      // Initial pool: 40% rounded down, minimum 1
      const initialPoolSize = Math.max(1, Math.floor(totalWords * INITIAL_POOL_RATIO));

      // Shuffle all indices
      const allIndices = Array.from({ length: totalWords }, (_, i) => i);
      const shuffled = [...allIndices].sort(() => Math.random() - 0.5);

      const activePool = shuffled.slice(0, initialPoolSize);
      const remainingPool = shuffled.slice(initialPoolSize);

      // Initialize word states
      const wordStates = new Map<number, WordState>();
      allIndices.forEach((idx) => {
        const initialLevel = initialConfidenceByWordIndex?.[idx] ?? 1;
        wordStates.set(idx, {
          wordIndex: idx,
          masteryLevel: initialLevel,
          completedLevel3: false,
          answeredLevel2Plus: false,
        });
      });

      // Pick first question
      const firstWordIndex = activePool[Math.floor(Math.random() * activePool.length)];
      const firstMastery = wordStates.get(firstWordIndex)?.masteryLevel ?? 1;
      const firstQuestionLevel = pickQuestionLevel(firstMastery);
      const firstLevel2Mode = Math.random() < LEVEL2_TYPING_CHANCE ? "typing" : "multiple_choice";

      const newSession: SessionState = {
        initialized: true,
        activePool,
        remainingPool,
        wordStates,
        lastQuestionIndex: null,
        currentWordIndex: firstWordIndex,
        questionLevel: firstQuestionLevel,
        level2Mode: firstLevel2Mode,
        questionsAnswered: 0,
        correctAnswers: 0,
        completed: false,
      };

      // Use queueMicrotask to avoid synchronous setState in effect body
      queueMicrotask(() => {
        setSession(newSession);
        setStartTime(Date.now());
      });
    }
  }, [words, session.initialized, initialConfidenceByWordIndex, pickQuestionLevel]);

  // Live elapsed timer update
  useEffect(() => {
    if (!startTime || session.completed) return;

    const interval = setInterval(() => {
      setElapsedTime(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);

    return () => clearInterval(interval);
  }, [startTime, session.completed]);

  /**
   * Selects the next question, handling pool expansion when needed.
   */
  const selectNextQuestion = useCallback(() => {
    setSession((prev) => {
      const { activePool, wordStates, lastQuestionIndex, remainingPool } = prev;

      // Check pool expansion: threshold% of active pool has answeredLevel2Plus
      const level2PlusCount = activePool.filter(
        (idx) => wordStates.get(idx)?.answeredLevel2Plus
      ).length;
      const shouldExpand =
        level2PlusCount >= Math.ceil(activePool.length * POOL_EXPANSION_THRESHOLD) &&
        remainingPool.length > 0;

      let newActivePool = [...activePool];
      let newRemainingPool = [...remainingPool];

      if (shouldExpand) {
        // Add up to N random words from remaining
        const toAdd = Math.min(POOL_EXPANSION_COUNT, remainingPool.length);
        const shuffledRemaining = [...remainingPool].sort(() => Math.random() - 0.5);
        const wordsToAdd = shuffledRemaining.slice(0, toAdd);
        newActivePool = [...activePool, ...wordsToAdd];
        newRemainingPool = shuffledRemaining.slice(toAdd);
      }

      // Find incomplete words (not completed Level 3)
      const incompleteWords = newActivePool.filter(
        (idx) => !wordStates.get(idx)?.completedLevel3
      );

      // Check if all complete
      if (incompleteWords.length === 0) {
        return { ...prev, completed: true };
      }

      // Pick random word, avoiding last question if possible
      let candidates = incompleteWords.filter((idx) => idx !== lastQuestionIndex);
      if (candidates.length === 0) {
        candidates = incompleteWords;
      }
      const nextWordIndex = candidates[Math.floor(Math.random() * candidates.length)];

      // Determine question level based on word's mastery
      const wordState = wordStates.get(nextWordIndex)!;
      const nextQuestionLevel = pickQuestionLevel(wordState.masteryLevel);
      const nextLevel2Mode = Math.random() < LEVEL2_TYPING_CHANCE ? "typing" : "multiple_choice";

      return {
        ...prev,
        activePool: newActivePool,
        remainingPool: newRemainingPool,
        currentWordIndex: nextWordIndex,
        questionLevel: nextQuestionLevel,
        level2Mode: nextLevel2Mode,
        lastQuestionIndex: nextWordIndex,
      };
    });
    setShowFeedback(false);
    setFeedbackAnswer(null);
  }, [pickQuestionLevel]);

  /**
   * Handle correct answer - progress mastery and auto-advance.
   */
  const handleCorrect = useCallback(() => {
    setFeedbackCorrect(true);
    setShowFeedback(true);
    setFeedbackAnswer(null);

    setSession((prev) => {
      const newWordStates = new Map(prev.wordStates);
      const wordState = newWordStates.get(prev.currentWordIndex!)!;

      // Progress mastery level
      let newMastery = wordState.masteryLevel;
      let completedLevel3 = wordState.completedLevel3;
      let answeredLevel2Plus = wordState.answeredLevel2Plus;

      if (prev.questionLevel === 1) {
        // After correct at L1: probabilistic jump to L2 or L3
        newMastery = Math.random() < LEVEL_UP_CHANCE ? 2 : 3;
      } else if (prev.questionLevel === 2) {
        newMastery = 3;
        answeredLevel2Plus = true;
      } else if (prev.questionLevel === 3) {
        completedLevel3 = true;
        answeredLevel2Plus = true;
      }

      newWordStates.set(prev.currentWordIndex!, {
        ...wordState,
        masteryLevel: newMastery,
        completedLevel3,
        answeredLevel2Plus,
      });

      return {
        ...prev,
        wordStates: newWordStates,
        questionsAnswered: prev.questionsAnswered + 1,
        correctAnswers: prev.correctAnswers + 1,
      };
    });

    // Auto-advance after delay
    setTimeout(() => {
      selectNextQuestion();
    }, 1500);
  }, [selectNextQuestion]);

  /**
   * Handle incorrect answer - drop mastery by 1, show correct answer.
   */
  const handleIncorrect = useCallback(() => {
    if (!words || session.currentWordIndex === null) return;

    const currentWord = words[session.currentWordIndex];
    setFeedbackCorrect(false);
    setShowFeedback(true);
    setFeedbackAnswer(currentWord.answer);

    setSession((prev) => {
      const newWordStates = new Map(prev.wordStates);
      const wordState = newWordStates.get(prev.currentWordIndex!)!;

      // Lower mastery by 1 if possible
      let newMastery = wordState.masteryLevel;
      if (newMastery > 0) {
        newMastery = (newMastery - 1) as 0 | 1 | 2 | 3;
      }

      newWordStates.set(prev.currentWordIndex!, {
        ...wordState,
        masteryLevel: newMastery,
      });

      return {
        ...prev,
        wordStates: newWordStates,
        questionsAnswered: prev.questionsAnswered + 1,
      };
    });

    // Auto-advance after delay (longer to read answer)
    setTimeout(() => {
      selectNextQuestion();
    }, 2500);
  }, [selectNextQuestion, words, session.currentWordIndex]);

  /**
   * Level 0: User indicates they know the word.
   */
  const handleLevel0GotIt = useCallback(() => {
    setSession((prev) => {
      if (prev.currentWordIndex === null) return prev;
      const newWordStates = new Map(prev.wordStates);
      const wordState = newWordStates.get(prev.currentWordIndex);
      if (!wordState) return prev;

      newWordStates.set(prev.currentWordIndex, {
        ...wordState,
        masteryLevel: 1,
      });

      return {
        ...prev,
        wordStates: newWordStates,
        questionsAnswered: prev.questionsAnswered + 1,
        correctAnswers: prev.correctAnswers + 1,
      };
    });
    selectNextQuestion();
  }, [selectNextQuestion]);

  /**
   * Level 0: User indicates they don't know the word yet.
   */
  const handleLevel0NotYet = useCallback(() => {
    setSession((prev) => {
      if (prev.currentWordIndex === null) return prev;
      const newWordStates = new Map(prev.wordStates);
      const wordState = newWordStates.get(prev.currentWordIndex);
      if (!wordState) return prev;

      newWordStates.set(prev.currentWordIndex, {
        ...wordState,
        masteryLevel: 0,
      });

      return {
        ...prev,
        wordStates: newWordStates,
        questionsAnswered: prev.questionsAnswered + 1,
      };
    });
    selectNextQuestion();
  }, [selectNextQuestion]);

  // Derived values
  const currentWord = useMemo(() => {
    if (!words || session.currentWordIndex === null) return null;
    return words[session.currentWordIndex];
  }, [words, session.currentWordIndex]);

  const masteredCount = useMemo(() => {
    return Array.from(session.wordStates.values()).filter((ws) => ws.completedLevel3).length;
  }, [session.wordStates]);

  return {
    session,
    showFeedback,
    feedbackCorrect,
    feedbackAnswer,
    elapsedTime,
    handleCorrect,
    handleIncorrect,
    handleLevel0GotIt,
    handleLevel0NotYet,
    currentWord,
    masteredCount,
  };
}

