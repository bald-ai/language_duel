"use client";

import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useUser } from "@clerk/nextjs";
import { useRouter, useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import { useSyncUser } from "@/hooks/useSyncUser";
import { useDuelLobby } from "@/hooks/useDuelLobby";
import { MenuButton } from "@/app/components/MenuButton";
import { ThemedPage } from "@/app/components/ThemedPage";
import { AuthButtons, LeftNavButtons } from "@/app/components/auth";
import { buildClassicQuestionSnapshot } from "@/lib/answerShuffle";
import type { WordEntry } from "@/lib/types";
import type { Id } from "@/convex/_generated/dataModel";

type HomeScreenMode = "home" | "memory" | "missing_chunk" | "rebuild_sentence" | "speed";
type MemoryGameStatus = "idle" | "playing" | "completed";
type MemoryCardSide = "source" | "translation";
type SentenceFeedbackState = "idle" | "wrong" | "correct";
type SpeedModeFeedbackState = "idle" | "correct" | "wrong" | "timed_out";

interface MemoryPair {
  pairId: string;
  source: string;
  translation: string;
}

interface MemoryCard {
  id: string;
  pairId: string;
  text: string;
  side: MemoryCardSide;
}

interface MissingChunkExercise {
  english: string;
  sentenceStart: string;
  sentenceEnd: string;
  correctChunk: string;
  options: string[];
}

interface MissingChunkSessionState {
  currentCardIndex: number;
  selectedOption: string | null;
  solved: boolean;
  completed: boolean;
  feedback: SentenceFeedbackState;
}

interface RebuildSentenceExercise {
  english: string;
  tokens: string[];
}

interface RebuildSentenceSessionState {
  currentCardIndex: number;
  builtTokenIndexes: number[];
  shuffledTokens: string[];
  solved: boolean;
  completed: boolean;
  feedback: SentenceFeedbackState;
}

type SpeedModeExercise = Pick<WordEntry, "word" | "answer" | "wrongAnswers">;

interface SpeedModeSessionState {
  currentCardIndex: number;
  score: number;
  selectedOption: string | null;
  feedback: SpeedModeFeedbackState;
  secondsRemaining: number;
  completed: boolean;
  locked: boolean;
}

const MEMORY_GAME_PAIRS: MemoryPair[] = [
  { pairId: "bonjour", source: "bonjour", translation: "hello" },
  { pairId: "merci", source: "merci", translation: "thank you" },
  { pairId: "pomme", source: "pomme", translation: "apple" },
  { pairId: "maison", source: "maison", translation: "house" },
  { pairId: "livre", source: "livre", translation: "book" },
  { pairId: "soleil", source: "soleil", translation: "sun" },
];

const MISSING_CHUNK_EXERCISES: MissingChunkExercise[] = [
  {
    english: "I want water.",
    sentenceStart: "Yo",
    sentenceEnd: "agua.",
    correctChunk: "quiero",
    options: ["quiero", "tengo", "bebo"],
  },
  {
    english: "We are at home.",
    sentenceStart: "Nosotros estamos",
    sentenceEnd: "casa.",
    correctChunk: "en",
    options: ["en", "con", "para"],
  },
  {
    english: "She eats with friends.",
    sentenceStart: "Ella come",
    sentenceEnd: "amigos.",
    correctChunk: "con",
    options: ["con", "sin", "sobre"],
  },
];

const REBUILD_SENTENCE_EXERCISES: RebuildSentenceExercise[] = [
  {
    english: "I write at night.",
    tokens: ["Yo", "escribo", "por", "la", "noche."],
  },
  {
    english: "The dog runs fast.",
    tokens: ["El", "perro", "corre", "rápido."],
  },
  {
    english: "We live in Madrid.",
    tokens: ["Nosotros", "vivimos", "en", "Madrid."],
  },
];

const MEMORY_MISMATCH_DELAY_MS = 900;
const SPEED_MODE_CARD_SECONDS = 5;
const SPEED_MODE_FEEDBACK_DELAY_MS = 700;
const SPEED_MODE_EXERCISES: SpeedModeExercise[] = [
  {
    word: "el padre",
    answer: "father",
    wrongAnswers: ["mother", "brother", "grandfather", "uncle", "son"],
  },
  {
    word: "la madre",
    answer: "mother",
    wrongAnswers: ["sister", "grandmother", "daughter", "aunt", "wife"],
  },
  {
    word: "el hermano",
    answer: "brother",
    wrongAnswers: ["father", "cousin", "husband", "boyfriend", "nephew"],
  },
  {
    word: "la hermana",
    answer: "sister",
    wrongAnswers: ["mother", "girlfriend", "daughter", "grandmother", "niece"],
  },
  {
    word: "el abuelo",
    answer: "grandfather",
    wrongAnswers: ["uncle", "father", "brother", "grandson", "godfather"],
  },
  {
    word: "la abuela",
    answer: "grandmother",
    wrongAnswers: ["mother", "aunt", "sister", "granddaughter", "mother-in-law"],
  },
];

function shuffleCards<T>(items: T[]): T[] {
  const copy = [...items];

  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }

  return copy;
}

function buildMemoryDeck(): MemoryCard[] {
  return shuffleCards(
    MEMORY_GAME_PAIRS.flatMap((pair) => [
      {
        id: `${pair.pairId}-source`,
        pairId: pair.pairId,
        text: pair.source,
        side: "source" as const,
      },
      {
        id: `${pair.pairId}-translation`,
        pairId: pair.pairId,
        text: pair.translation,
        side: "translation" as const,
      },
    ])
  );
}

function formatElapsedTime(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function createMissingChunkSessionState(): MissingChunkSessionState {
  return {
    currentCardIndex: 0,
    selectedOption: null,
    solved: false,
    completed: false,
    feedback: "idle",
  };
}

function createRebuildSentenceSessionState(cardIndex = 0): RebuildSentenceSessionState {
  return {
    currentCardIndex: cardIndex,
    builtTokenIndexes: [],
    shuffledTokens: shuffleCards(REBUILD_SENTENCE_EXERCISES[cardIndex].tokens),
    solved: false,
    completed: false,
    feedback: "idle",
  };
}

function createSpeedModeSessionState(cardIndex = 0, score = 0): SpeedModeSessionState {
  return {
    currentCardIndex: cardIndex,
    score,
    selectedOption: null,
    feedback: "idle",
    secondsRemaining: SPEED_MODE_CARD_SECONDS,
    completed: false,
    locked: false,
  };
}

function joinSentenceTokens(tokens: string[]) {
  return tokens.join(" ");
}

function PrototypeActionButton({
  children,
  dataTestId,
  disabled = false,
  fullWidth = false,
  onClick,
  variant = "secondary",
}: {
  children: ReactNode;
  dataTestId?: string;
  disabled?: boolean;
  fullWidth?: boolean;
  onClick: () => void;
  variant?: "primary" | "secondary" | "ghost";
}) {
  const stylesByVariant = {
    primary: {
      backgroundColor: "var(--color-cta)",
      borderColor: "var(--color-cta-light)",
      color: "#ffffff",
    },
    secondary: {
      backgroundColor: "color-mix(in srgb, var(--color-primary) 32%, white 10%)",
      borderColor: "color-mix(in srgb, var(--color-primary) 70%, white 10%)",
      color: "var(--color-text)",
    },
    ghost: {
      backgroundColor: "transparent",
      borderColor: "color-mix(in srgb, var(--color-neutral) 55%, transparent)",
      color: "var(--color-text)",
    },
  } as const;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      data-testid={dataTestId}
      className={`rounded-2xl border-2 px-4 py-3 text-sm font-semibold transition ${
        fullWidth ? "w-full" : ""
      } disabled:cursor-not-allowed disabled:opacity-50`}
      style={stylesByVariant[variant]}
    >
      {children}
    </button>
  );
}

const StudyIcon = () => (
  <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="var(--color-cta-light)" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
  </svg>
);

const SoloIcon = () => (
  <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="var(--color-cta-light)" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
  </svg>
);

const DuelIcon = () => (
  <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="var(--color-cta-light)" strokeWidth={2}>
    <g transform="rotate(45 12 12)">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v13" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 16a3 3 0 0 0 6 0" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 19v3" />
    </g>
    <g transform="rotate(-45 12 12)">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v13" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 16a3 3 0 0 0 6 0" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 19v3" />
    </g>
  </svg>
);

const ThemesIcon = () => (
  <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="var(--color-cta-light)" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
  </svg>
);

const MemoryIcon = () => (
  <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="var(--color-cta-light)" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M8 5.5A2.5 2.5 0 0 1 10.5 3h3A2.5 2.5 0 0 1 16 5.5V6h1.5A2.5 2.5 0 0 1 20 8.5v9a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 17.5v-9A2.5 2.5 0 0 1 6.5 6H8v-.5Z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 10h6M9 14h3" />
  </svg>
);

const MissingChunkIcon = () => (
  <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="var(--color-cta-light)" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M4 7h6m4 0h6M4 12h3m7 0h6M4 17h6m4 0h6" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M11 10h2v4h-2z" />
  </svg>
);

const RebuildSentenceIcon = () => (
  <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="var(--color-cta-light)" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M4 8h7l-2-2m2 2-2 2" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M20 16h-7l2-2m-2 2 2 2" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 16h4m4-8h4" />
  </svg>
);

const SpeedModeIcon = () => (
  <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="var(--color-cta-light)" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M13 2 5 14h5l-1 8 8-12h-5l1-8Z" />
  </svg>
);

const MockFeaturesIcon = () => (
  <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="var(--color-cta-light)" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M4 7h16M4 12h16M4 17h16" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M7 4v6M12 9v6M17 14v6" />
  </svg>
);

const UnifiedDuelModal = dynamic(
  () =>
    import("@/app/components/modals/UnifiedDuelModal").then((mod) => mod.UnifiedDuelModal),
  { loading: () => null }
);
const SoloModal = dynamic(
  () => import("@/app/components/modals/SoloModal").then((mod) => mod.SoloModal),
  { loading: () => null }
);
const WaitingModal = dynamic(
  () => import("@/app/components/modals/WaitingModal").then((mod) => mod.WaitingModal),
  { loading: () => null }
);
const JoiningModal = dynamic(
  () => import("@/app/components/modals/JoiningModal").then((mod) => mod.JoiningModal),
  { loading: () => null }
);

export default function Home() {
  const { isSignedIn } = useUser();
  useSyncUser();

  const router = useRouter();
  const [screen, setScreen] = useState<HomeScreenMode>("home");
  const [showMockFeaturesMenu, setShowMockFeaturesMenu] = useState(false);
  const [cards, setCards] = useState<MemoryCard[]>(() => buildMemoryDeck());
  const [selectedCardIndexes, setSelectedCardIndexes] = useState<number[]>([]);
  const [matchedPairIds, setMatchedPairIds] = useState<string[]>([]);
  const [moves, setMoves] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [isResolvingMismatch, setIsResolvingMismatch] = useState(false);
  const [status, setStatus] = useState<MemoryGameStatus>("idle");
  const [missingChunkSession, setMissingChunkSession] = useState<MissingChunkSessionState>(
    createMissingChunkSessionState
  );
  const [rebuildSentenceSession, setRebuildSentenceSession] = useState<RebuildSentenceSessionState>(
    () => createRebuildSentenceSessionState()
  );
  const [speedModeSession, setSpeedModeSession] = useState<SpeedModeSessionState>(() => createSpeedModeSessionState());
  const [flashAuth, setFlashAuth] = useState(false);
  const flashTimer = useRef<ReturnType<typeof setTimeout>>(null);

  const guardAuth = useCallback(
    (action: () => void) => {
      if (!isSignedIn) {
        setFlashAuth(false);
        requestAnimationFrame(() => setFlashAuth(true));
        if (flashTimer.current) clearTimeout(flashTimer.current);
        flashTimer.current = setTimeout(() => setFlashAuth(false), 750);
        return;
      }
      action();
    },
    [isSignedIn]
  );
  const searchParams = useSearchParams();
  const lobby = useDuelLobby();
  const handledSoloDeepLinkRef = useRef<string | null>(null);
  const { openSoloModal } = lobby;

  const openSoloParam = searchParams.get("openSolo");
  const themeIdParam = searchParams.get("themeId");
  const themeIdsParam = searchParams.get("themeIds");
  const soloModeParam = searchParams.get("soloMode");
  const soloThemeIds = useMemo(
    () =>
      openSoloParam === "true"
        ? (
            themeIdsParam
              ? themeIdsParam.split(",").filter(Boolean)
              : themeIdParam
                ? [themeIdParam]
                : []
          ) as Id<"themes">[]
        : undefined,
    [openSoloParam, themeIdParam, themeIdsParam]
  );
  const soloInitialMode =
    openSoloParam === "true" && soloModeParam === "challenge_only"
      ? "challenge_only"
      : undefined;
  const soloDeepLinkKey =
    openSoloParam === "true"
      ? `${themeIdsParam ?? themeIdParam ?? ""}:${soloModeParam ?? ""}`
      : null;

  const missingChunkExercise = MISSING_CHUNK_EXERCISES[missingChunkSession.currentCardIndex];
  const rebuildSentenceExercise = REBUILD_SENTENCE_EXERCISES[rebuildSentenceSession.currentCardIndex];
  const speedModeExercise = SPEED_MODE_EXERCISES[speedModeSession.currentCardIndex];
  const builtTokens = rebuildSentenceSession.builtTokenIndexes.map(
    (tokenIndex) => rebuildSentenceSession.shuffledTokens[tokenIndex]
  );
  const otherSentenceMode = screen === "missing_chunk" ? "rebuild_sentence" : "missing_chunk";
  const speedModeQuestion = useMemo(() => {
    if (!speedModeExercise) {
      return null;
    }

    return buildClassicQuestionSnapshot(
      speedModeExercise,
      speedModeSession.currentCardIndex,
      { level: "easy", wrongCount: 3 }
    );
  }, [speedModeExercise, speedModeSession.currentCardIndex]);

  const resetMemoryGame = useCallback(() => {
    setCards(buildMemoryDeck());
    setSelectedCardIndexes([]);
    setMatchedPairIds([]);
    setMoves(0);
    setElapsedSeconds(0);
    setIsResolvingMismatch(false);
    setStatus("idle");
  }, []);

  const openMemoryGame = useCallback(() => {
    resetMemoryGame();
    setShowMockFeaturesMenu(false);
    setScreen("memory");
  }, [resetMemoryGame]);

  const handleBackToHome = useCallback(() => {
    setScreen("home");
    setShowMockFeaturesMenu(false);
    resetMemoryGame();
    setSpeedModeSession(createSpeedModeSessionState());
  }, [resetMemoryGame]);

  const handleRestartMemoryGame = useCallback(() => {
    resetMemoryGame();
  }, [resetMemoryGame]);

  const openSentencePrototype = useCallback((mode: "missing_chunk" | "rebuild_sentence") => {
    if (mode === "missing_chunk") {
      setMissingChunkSession(createMissingChunkSessionState());
    } else {
      setRebuildSentenceSession(createRebuildSentenceSessionState());
    }

    setShowMockFeaturesMenu(false);
    setScreen(mode);
  }, []);

  const restartSentencePrototype = useCallback((mode: "missing_chunk" | "rebuild_sentence") => {
    if (mode === "missing_chunk") {
      setMissingChunkSession(createMissingChunkSessionState());
    } else {
      setRebuildSentenceSession(createRebuildSentenceSessionState());
    }
  }, []);

  const openSpeedMode = useCallback(() => {
    setSpeedModeSession(createSpeedModeSessionState());
    setShowMockFeaturesMenu(false);
    setScreen("speed");
  }, []);

  const restartSpeedMode = useCallback(() => {
    setSpeedModeSession(createSpeedModeSessionState());
  }, []);

  const handleMissingChunkOption = useCallback((option: string) => {
    setMissingChunkSession((currentSession) => {
      if (screen !== "missing_chunk" || currentSession.solved || currentSession.completed) {
        return currentSession;
      }

      const isCorrect = option === MISSING_CHUNK_EXERCISES[currentSession.currentCardIndex].correctChunk;

      return {
        ...currentSession,
        selectedOption: option,
        feedback: isCorrect ? "correct" : "wrong",
        solved: isCorrect,
      };
    });
  }, [screen]);

  const handleMissingChunkNext = useCallback(() => {
    setMissingChunkSession((currentSession) => {
      if (screen !== "missing_chunk" || !currentSession.solved) {
        return currentSession;
      }

      const isLastCard = currentSession.currentCardIndex === MISSING_CHUNK_EXERCISES.length - 1;

      if (isLastCard) {
        return {
          ...currentSession,
          completed: true,
        };
      }

      return {
        currentCardIndex: currentSession.currentCardIndex + 1,
        selectedOption: null,
        solved: false,
        completed: false,
        feedback: "idle",
      };
    });
  }, [screen]);

  const handleAddRebuildToken = useCallback((tokenIndex: number) => {
    setRebuildSentenceSession((currentSession) => {
      if (
        screen !== "rebuild_sentence" ||
        currentSession.solved ||
        currentSession.completed ||
        currentSession.builtTokenIndexes.includes(tokenIndex)
      ) {
        return currentSession;
      }

      return {
        ...currentSession,
        builtTokenIndexes: [...currentSession.builtTokenIndexes, tokenIndex],
        feedback: "idle",
      };
    });
  }, [screen]);

  const handleRemoveRebuildToken = useCallback((builtIndex: number) => {
    setRebuildSentenceSession((currentSession) => {
      if (screen !== "rebuild_sentence" || currentSession.solved || currentSession.completed) {
        return currentSession;
      }

      return {
        ...currentSession,
        builtTokenIndexes: currentSession.builtTokenIndexes.filter((_, index) => index !== builtIndex),
        feedback: "idle",
      };
    });
  }, [screen]);

  const handleRebuildUndo = useCallback(() => {
    setRebuildSentenceSession((currentSession) => {
      if (
        screen !== "rebuild_sentence" ||
        currentSession.solved ||
        currentSession.completed ||
        currentSession.builtTokenIndexes.length === 0
      ) {
        return currentSession;
      }

      return {
        ...currentSession,
        builtTokenIndexes: currentSession.builtTokenIndexes.slice(0, -1),
        feedback: "idle",
      };
    });
  }, [screen]);

  const handleRebuildClear = useCallback(() => {
    setRebuildSentenceSession((currentSession) => {
      if (
        screen !== "rebuild_sentence" ||
        currentSession.solved ||
        currentSession.completed ||
        currentSession.builtTokenIndexes.length === 0
      ) {
        return currentSession;
      }

      return {
        ...currentSession,
        builtTokenIndexes: [],
        feedback: "idle",
      };
    });
  }, [screen]);

  const handleCheckRebuildSentence = useCallback(() => {
    setRebuildSentenceSession((currentSession) => {
      if (screen !== "rebuild_sentence" || currentSession.solved || currentSession.completed) {
        return currentSession;
      }

      const exercise = REBUILD_SENTENCE_EXERCISES[currentSession.currentCardIndex];
      const assembledSentence = joinSentenceTokens(
        currentSession.builtTokenIndexes.map((tokenIndex) => currentSession.shuffledTokens[tokenIndex])
      );
      const correctSentence = joinSentenceTokens(exercise.tokens);
      const isCorrect = assembledSentence === correctSentence;

      return {
        ...currentSession,
        feedback: isCorrect ? "correct" : "wrong",
        solved: isCorrect,
      };
    });
  }, [screen]);

  const handleRebuildNext = useCallback(() => {
    setRebuildSentenceSession((currentSession) => {
      if (screen !== "rebuild_sentence" || !currentSession.solved) {
        return currentSession;
      }

      const isLastCard = currentSession.currentCardIndex === REBUILD_SENTENCE_EXERCISES.length - 1;

      if (isLastCard) {
        return {
          ...currentSession,
          completed: true,
        };
      }

      return createRebuildSentenceSessionState(currentSession.currentCardIndex + 1);
    });
  }, [screen]);

  const handleSpeedModeAnswer = useCallback((option: string) => {
    setSpeedModeSession((currentSession) => {
      if (screen !== "speed" || currentSession.locked || currentSession.completed) {
        return currentSession;
      }

      const question = buildClassicQuestionSnapshot(
        SPEED_MODE_EXERCISES[currentSession.currentCardIndex],
        currentSession.currentCardIndex,
        { level: "easy", wrongCount: 3 }
      );
      const isCorrect = option === question.correctOption;

      return {
        ...currentSession,
        selectedOption: option,
        feedback: isCorrect ? "correct" : "wrong",
        score: currentSession.score + (isCorrect ? 1 : 0),
        locked: true,
      };
    });
  }, [screen]);

  const handleSelectMemoryCard = useCallback((cardIndex: number) => {
    setSelectedCardIndexes((currentSelection) => {
      if (screen !== "memory" || isResolvingMismatch || status === "completed") {
        return currentSelection;
      }

      if (currentSelection.includes(cardIndex)) {
        return currentSelection;
      }

      const card = cards[cardIndex];
      if (!card || matchedPairIds.includes(card.pairId)) {
        return currentSelection;
      }

      if (status === "idle") {
        setStatus("playing");
      }

      if (currentSelection.length === 0) {
        return [cardIndex];
      }

      if (currentSelection.length > 1) {
        return currentSelection;
      }

      const [firstCardIndex] = currentSelection;
      const firstCard = cards[firstCardIndex];
      if (!firstCard) {
        return [cardIndex];
      }

      const nextSelection = [firstCardIndex, cardIndex];
      const isMatch = firstCard.pairId === card.pairId && firstCard.side !== card.side;

      setMoves((currentMoves) => currentMoves + 1);

      if (isMatch) {
        if (matchedPairIds.length + 1 === MEMORY_GAME_PAIRS.length) {
          setStatus("completed");
        }
        setMatchedPairIds((currentMatchedPairIds) => [...currentMatchedPairIds, card.pairId]);
        return [];
      }

      setIsResolvingMismatch(true);
      return nextSelection;
    });
  }, [cards, isResolvingMismatch, matchedPairIds, screen, status]);

  useEffect(() => {
    if (!isResolvingMismatch || selectedCardIndexes.length !== 2) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setSelectedCardIndexes([]);
      setIsResolvingMismatch(false);
    }, MEMORY_MISMATCH_DELAY_MS);

    return () => window.clearTimeout(timeoutId);
  }, [isResolvingMismatch, selectedCardIndexes]);

  useEffect(() => {
    if (screen !== "memory" || status !== "playing") {
      return;
    }

    const intervalId = window.setInterval(() => {
      setElapsedSeconds((currentElapsedSeconds) => currentElapsedSeconds + 1);
    }, 1000);

    return () => window.clearInterval(intervalId);
  }, [screen, status]);

  useEffect(() => {
    if (screen !== "speed" || speedModeSession.completed || speedModeSession.locked) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setSpeedModeSession((currentSession) => {
        if (screen !== "speed" || currentSession.completed || currentSession.locked) {
          return currentSession;
        }

        if (currentSession.secondsRemaining <= 1) {
          return {
            ...currentSession,
            secondsRemaining: 0,
            feedback: "timed_out",
            locked: true,
          };
        }

        return {
          ...currentSession,
          secondsRemaining: currentSession.secondsRemaining - 1,
        };
      });
    }, 1000);

    return () => window.clearTimeout(timeoutId);
  }, [screen, speedModeSession.completed, speedModeSession.locked, speedModeSession.secondsRemaining]);

  useEffect(() => {
    if (
      screen !== "speed" ||
      speedModeSession.completed ||
      !speedModeSession.locked ||
      speedModeSession.feedback === "idle"
    ) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setSpeedModeSession((currentSession) => {
        if (screen !== "speed" || currentSession.completed || !currentSession.locked) {
          return currentSession;
        }

        const isLastCard = currentSession.currentCardIndex === SPEED_MODE_EXERCISES.length - 1;

        if (isLastCard) {
          return {
            ...currentSession,
            completed: true,
          };
        }

        return createSpeedModeSessionState(currentSession.currentCardIndex + 1, currentSession.score);
      });
    }, SPEED_MODE_FEEDBACK_DELAY_MS);

    return () => window.clearTimeout(timeoutId);
  }, [screen, speedModeSession.completed, speedModeSession.feedback, speedModeSession.locked]);

  const formattedElapsedTime = useMemo(() => formatElapsedTime(elapsedSeconds), [elapsedSeconds]);
  const revealedCardIndexes = useMemo(
    () =>
      new Set([
        ...selectedCardIndexes,
        ...cards
          .map((card, index) => (matchedPairIds.includes(card.pairId) ? index : -1))
          .filter((index) => index >= 0),
      ]),
    [cards, matchedPairIds, selectedCardIndexes]
  );

  useEffect(() => {
    if (!soloThemeIds || soloThemeIds.length === 0 || !soloDeepLinkKey) {
      handledSoloDeepLinkRef.current = null;
      return;
    }

    if (handledSoloDeepLinkRef.current === soloDeepLinkKey) {
      return;
    }

    handledSoloDeepLinkRef.current = soloDeepLinkKey;
    openSoloModal();
  }, [soloThemeIds, soloDeepLinkKey, openSoloModal]);

  const handleCloseSoloModal = () => {
    lobby.closeSoloModal();
  };

  const renderSentenceCompletion = () => (
    <div className="space-y-4 text-center">
      <div className="space-y-2">
        <p
          className="text-xs font-black uppercase tracking-[0.24em]"
          style={{ color: "var(--color-cta-dark)" }}
        >
          Prototype Complete
        </p>
        <h2 className="text-2xl font-bold" style={{ color: "var(--color-text)" }}>
          {screen === "missing_chunk" ? "Missing Chunk finished" : "Rebuild Sentence finished"}
        </h2>
        <p className="text-sm leading-6" style={{ color: "var(--color-text)" }}>
          You can restart this fake flow, go back home, or switch to the other sentence beta.
        </p>
      </div>

      <div className="grid gap-3">
        <PrototypeActionButton
          fullWidth
          variant="primary"
          onClick={() => restartSentencePrototype(screen === "missing_chunk" ? "missing_chunk" : "rebuild_sentence")}
          dataTestId={`prototype-${screen}-restart`}
        >
          Restart
        </PrototypeActionButton>
        <PrototypeActionButton fullWidth onClick={handleBackToHome} dataTestId={`prototype-${screen}-back-home`}>
          Back to Home
        </PrototypeActionButton>
        <PrototypeActionButton
          fullWidth
          variant="ghost"
          onClick={() => openSentencePrototype(otherSentenceMode)}
          dataTestId={`prototype-${screen}-other-mode`}
        >
          Try Other Mode
        </PrototypeActionButton>
      </div>
    </div>
  );

  const renderMissingChunkPanel = () => {
    if (missingChunkSession.completed) {
      return renderSentenceCompletion();
    }

    return (
      <div className="space-y-4">
        <div className="space-y-2 text-center">
          <p
            className="text-xs font-black uppercase tracking-[0.24em]"
            style={{ color: "var(--color-cta-dark)" }}
          >
            Card {missingChunkSession.currentCardIndex + 1} of {MISSING_CHUNK_EXERCISES.length}
          </p>
          <h2 className="text-2xl font-bold" style={{ color: "var(--color-text)" }}>
            Sentence Beta: Missing Chunk
          </h2>
          <p className="text-sm leading-6" style={{ color: "var(--color-text)" }}>
            Tap the chunk that correctly completes the Spanish sentence.
          </p>
        </div>

        <div
          className="rounded-3xl border-2 p-4 sm:p-5 backdrop-blur-sm"
          style={{
            borderColor: "color-mix(in srgb, var(--color-primary) 75%, transparent)",
            backgroundColor: "color-mix(in srgb, var(--color-primary) 22%, white 78%)",
          }}
        >
          <div className="space-y-3">
            <div>
              <p
                className="text-[11px] font-black uppercase tracking-[0.22em]"
                style={{ color: "var(--color-text-muted)" }}
              >
                English meaning
              </p>
              <p className="mt-1 text-lg font-semibold" style={{ color: "var(--color-text)" }}>
                {missingChunkExercise.english}
              </p>
            </div>

            <div>
              <p
                className="text-[11px] font-black uppercase tracking-[0.22em]"
                style={{ color: "var(--color-text-muted)" }}
              >
                Spanish sentence
              </p>
              <p
                className="mt-2 text-xl font-semibold leading-8"
                style={{
                  color: missingChunkSession.solved ? "var(--color-cta-dark)" : "var(--color-text)",
                }}
              >
                {missingChunkSession.solved ? (
                  `${missingChunkExercise.sentenceStart} ${missingChunkExercise.correctChunk} ${missingChunkExercise.sentenceEnd}`
                ) : (
                  <>
                    {missingChunkExercise.sentenceStart}{" "}
                    <span
                      className="inline-flex min-w-24 items-center justify-center rounded-xl border border-dashed px-3 py-1 text-base"
                      style={{
                        borderColor: "color-mix(in srgb, var(--color-cta) 70%, transparent)",
                        color: "var(--color-cta-dark)",
                      }}
                    >
                      ______
                    </span>{" "}
                    {missingChunkExercise.sentenceEnd}
                  </>
                )}
              </p>
            </div>
          </div>
        </div>

        <div className="grid gap-3">
          {missingChunkExercise.options.map((option) => {
            const isSelected = missingChunkSession.selectedOption === option;
            const isCorrectSelected = isSelected && missingChunkSession.feedback === "correct";
            const isWrongSelected = isSelected && missingChunkSession.feedback === "wrong";

            return (
              <button
                key={option}
                type="button"
                onClick={() => handleMissingChunkOption(option)}
                disabled={missingChunkSession.solved}
                className="w-full rounded-2xl border-2 px-4 py-3 text-left text-base font-semibold transition disabled:cursor-not-allowed disabled:opacity-70"
                data-testid={`missing-chunk-option-${option}`}
                style={{
                  backgroundColor: isCorrectSelected
                    ? "color-mix(in srgb, var(--color-cta) 22%, transparent)"
                    : isWrongSelected
                      ? "rgba(239, 68, 68, 0.12)"
                      : "color-mix(in srgb, var(--color-primary) 22%, white 78%)",
                  borderColor: isCorrectSelected
                    ? "var(--color-cta)"
                    : isWrongSelected
                      ? "rgb(239 68 68)"
                      : "color-mix(in srgb, var(--color-primary) 75%, transparent)",
                  color: "var(--color-text)",
                }}
              >
                {option}
                {missingChunkSession.solved && option === missingChunkExercise.correctChunk ? "  ✓" : ""}
              </button>
            );
          })}
        </div>

        {missingChunkSession.feedback === "wrong" && (
          <p className="text-sm font-semibold text-center text-red-500" data-testid="missing-chunk-feedback-wrong">
            Not quite. Try another chunk.
          </p>
        )}

        <div className="flex gap-3">
          <PrototypeActionButton
            fullWidth
            variant="ghost"
            onClick={handleBackToHome}
            dataTestId="missing-chunk-back-home"
          >
            Back to Home
          </PrototypeActionButton>
          <PrototypeActionButton
            fullWidth
            variant="primary"
            onClick={handleMissingChunkNext}
            disabled={!missingChunkSession.solved}
            dataTestId="missing-chunk-next"
          >
            Next
          </PrototypeActionButton>
        </div>
      </div>
    );
  };

  const renderRebuildSentencePanel = () => {
    if (rebuildSentenceSession.completed) {
      return renderSentenceCompletion();
    }

    const correctSentence = joinSentenceTokens(rebuildSentenceExercise.tokens);

    return (
      <div className="space-y-4">
        <div className="space-y-2 text-center">
          <p
            className="text-xs font-black uppercase tracking-[0.24em]"
            style={{ color: "var(--color-cta-dark)" }}
          >
            Card {rebuildSentenceSession.currentCardIndex + 1} of {REBUILD_SENTENCE_EXERCISES.length}
          </p>
          <h2 className="text-2xl font-bold" style={{ color: "var(--color-text)" }}>
            Sentence Beta: Rebuild Sentence
          </h2>
          <p className="text-sm leading-6" style={{ color: "var(--color-text)" }}>
            Tap tokens to rebuild the Spanish sentence, then check it.
          </p>
        </div>

        <div
          className="rounded-3xl border-2 p-4 sm:p-5 backdrop-blur-sm"
          style={{
            borderColor: "color-mix(in srgb, var(--color-primary) 75%, transparent)",
            backgroundColor: "color-mix(in srgb, var(--color-primary) 22%, white 78%)",
          }}
        >
          <div className="space-y-3">
            <div>
              <p
                className="text-[11px] font-black uppercase tracking-[0.22em]"
                style={{ color: "var(--color-text-muted)" }}
              >
                English meaning
              </p>
              <p className="mt-1 text-lg font-semibold" style={{ color: "var(--color-text)" }}>
                {rebuildSentenceExercise.english}
              </p>
            </div>

            <div>
              <p
                className="text-[11px] font-black uppercase tracking-[0.22em]"
                style={{ color: "var(--color-text-muted)" }}
              >
                Your answer
              </p>
              <div
                className="mt-2 min-h-24 rounded-2xl border-2 border-dashed p-3"
                style={{ borderColor: "color-mix(in srgb, var(--color-primary) 60%, transparent)" }}
              >
                {rebuildSentenceSession.solved ? (
                  <p
                    className="text-xl font-semibold leading-8"
                    style={{ color: "var(--color-cta-dark)" }}
                  >
                    {correctSentence}
                  </p>
                ) : builtTokens.length === 0 ? (
                  <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
                    Tap tokens below to build the sentence.
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {builtTokens.map((token, index) => (
                      <button
                        key={`${token}-${index}`}
                        type="button"
                        onClick={() => handleRemoveRebuildToken(index)}
                        disabled={rebuildSentenceSession.solved}
                        className="rounded-xl border-2 px-3 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-70"
                        data-testid={`rebuild-built-token-${index}`}
                        style={{
                          borderColor: "color-mix(in srgb, var(--color-cta) 65%, transparent)",
                          backgroundColor: "color-mix(in srgb, var(--color-cta) 18%, transparent)",
                          color: "var(--color-text)",
                        }}
                      >
                        {token}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="flex gap-2">
              <PrototypeActionButton
                fullWidth
                variant="ghost"
                onClick={handleRebuildUndo}
                disabled={rebuildSentenceSession.solved || builtTokens.length === 0}
                dataTestId="rebuild-sentence-undo"
              >
                Undo
              </PrototypeActionButton>
              <PrototypeActionButton
                fullWidth
                variant="ghost"
                onClick={handleRebuildClear}
                disabled={rebuildSentenceSession.solved || builtTokens.length === 0}
                dataTestId="rebuild-sentence-clear"
              >
                Clear
              </PrototypeActionButton>
            </div>
          </div>
        </div>

        <div>
          <p
            className="mb-2 text-[11px] font-black uppercase tracking-[0.22em]"
            style={{ color: "var(--color-text-muted)" }}
          >
            Available tokens
          </p>
          <div className="flex flex-wrap gap-2">
            {rebuildSentenceSession.shuffledTokens.map((token, index) => {
              const isUsed = rebuildSentenceSession.builtTokenIndexes.includes(index);

              return (
                <button
                  key={`${token}-${index}`}
                  type="button"
                  onClick={() => handleAddRebuildToken(index)}
                  disabled={isUsed || rebuildSentenceSession.solved}
                  className="rounded-xl border-2 px-3 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-40"
                  data-testid={`rebuild-token-${index}`}
                  style={{
                    borderColor: "color-mix(in srgb, var(--color-primary) 75%, transparent)",
                    backgroundColor: "color-mix(in srgb, var(--color-primary) 22%, white 78%)",
                    color: "var(--color-text)",
                  }}
                >
                  {token}
                </button>
              );
            })}
          </div>
        </div>

        {rebuildSentenceSession.feedback === "wrong" && (
          <p className="text-sm font-semibold text-center text-red-500" data-testid="rebuild-sentence-feedback-wrong">
            That order is not right yet. Keep trying.
          </p>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <PrototypeActionButton
            fullWidth
            variant="primary"
            onClick={handleCheckRebuildSentence}
            disabled={rebuildSentenceSession.solved || builtTokens.length === 0}
            dataTestId="rebuild-sentence-check"
          >
            Check
          </PrototypeActionButton>
          <PrototypeActionButton
            fullWidth
            onClick={handleRebuildNext}
            disabled={!rebuildSentenceSession.solved}
            dataTestId="rebuild-sentence-next"
          >
            Next
          </PrototypeActionButton>
        </div>

        <PrototypeActionButton fullWidth variant="ghost" onClick={handleBackToHome} dataTestId="rebuild-sentence-back-home">
          Back to Home
        </PrototypeActionButton>
      </div>
    );
  };

  const renderSpeedModePanel = () => {
    if (speedModeSession.completed) {
      return (
        <div className="space-y-4 text-center">
          <div className="space-y-2">
            <p
              className="text-xs font-black uppercase tracking-[0.24em]"
              style={{ color: "var(--color-cta-dark)" }}
            >
              Prototype Complete
            </p>
            <h2 className="text-2xl font-bold" style={{ color: "var(--color-text)" }}>
              Speed Mode finished
            </h2>
            <p className="text-sm leading-6" style={{ color: "var(--color-text)" }}>
              You cleared all {SPEED_MODE_EXERCISES.length} cards and scored {speedModeSession.score} point
              {speedModeSession.score === 1 ? "" : "s"}.
            </p>
          </div>

          <div
            className="rounded-3xl border-2 px-4 py-5"
            data-testid="speed-mode-final-score"
            style={{
              borderColor: "color-mix(in srgb, var(--color-cta) 24%, transparent)",
              backgroundColor: "color-mix(in srgb, var(--color-cta-light) 18%, white 82%)",
            }}
          >
            <p
              className="text-[11px] font-black uppercase tracking-[0.22em]"
              style={{ color: "var(--color-cta-dark)" }}
            >
              Final Score
            </p>
            <p className="mt-2 text-4xl font-black" style={{ color: "var(--color-text)" }}>
              {speedModeSession.score}/{SPEED_MODE_EXERCISES.length}
            </p>
          </div>

          <div className="grid gap-3">
            <PrototypeActionButton
              fullWidth
              variant="primary"
              onClick={restartSpeedMode}
              dataTestId="speed-mode-restart"
            >
              Restart
            </PrototypeActionButton>
            <PrototypeActionButton
              fullWidth
              onClick={handleBackToHome}
              dataTestId="speed-mode-back-home"
            >
              Back to Home
            </PrototypeActionButton>
          </div>
        </div>
      );
    }

    const feedbackMessage = {
      idle: "Answer before the timer hits zero.",
      correct: "Nice. +1 point.",
      wrong: "Wrong answer. Moving to the next card.",
      timed_out: "Time ran out. Moving to the next card.",
    } satisfies Record<SpeedModeFeedbackState, string>;

    if (!speedModeExercise || !speedModeQuestion) {
      return null;
    }

    return (
      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-2.5 sm:gap-3">
          <div
            className="rounded-2xl border px-3 py-2.5"
            data-testid="speed-mode-score"
            style={{
              backgroundColor: "color-mix(in srgb, var(--color-cta-light) 26%, white 74%)",
              borderColor: "color-mix(in srgb, var(--color-cta) 20%, transparent)",
            }}
          >
            <p className="text-[11px] font-bold uppercase tracking-[0.18em]" style={{ color: "var(--color-cta-dark)" }}>
              Score
            </p>
            <p className="mt-1 text-xl font-black" style={{ color: "var(--color-text)" }}>
              {speedModeSession.score}
            </p>
          </div>

          <div
            className="rounded-2xl border px-3 py-2.5"
            data-testid="speed-mode-card-progress"
            style={{
              backgroundColor: "color-mix(in srgb, var(--color-primary-light) 24%, white 76%)",
              borderColor: "color-mix(in srgb, var(--color-primary) 32%, white 10%)",
            }}
          >
            <p className="text-[11px] font-bold uppercase tracking-[0.18em]" style={{ color: "var(--color-primary-dark)" }}>
              Card
            </p>
            <p className="mt-1 text-xl font-black" style={{ color: "var(--color-text)" }}>
              {speedModeSession.currentCardIndex + 1}/{SPEED_MODE_EXERCISES.length}
            </p>
          </div>

          <div
            className="rounded-2xl border px-3 py-2.5"
            data-testid="speed-mode-time-left"
            style={{
              backgroundColor:
                speedModeSession.secondsRemaining <= 2
                  ? "rgba(239, 68, 68, 0.12)"
                  : "color-mix(in srgb, var(--color-neutral) 14%, white 86%)",
              borderColor:
                speedModeSession.secondsRemaining <= 2
                  ? "rgba(239, 68, 68, 0.42)"
                  : "color-mix(in srgb, var(--color-neutral) 32%, transparent)",
            }}
          >
            <p className="text-[11px] font-bold uppercase tracking-[0.18em]" style={{ color: "var(--color-text)" }}>
              Time Left
            </p>
            <p className="mt-1 text-xl font-black" style={{ color: "var(--color-text)" }}>
              {speedModeSession.secondsRemaining}s
            </p>
          </div>
        </div>

        <div
          className="rounded-3xl border-2 p-4 sm:p-5 backdrop-blur-sm"
          style={{
            borderColor: "color-mix(in srgb, var(--color-primary) 75%, transparent)",
            backgroundColor: "color-mix(in srgb, var(--color-primary) 22%, white 78%)",
          }}
        >
          <div className="space-y-3">
            <div>
              <p
                className="text-[11px] font-black uppercase tracking-[0.22em]"
                style={{ color: "var(--color-text-muted)" }}
              >
                Spanish word
              </p>
              <p className="mt-1 text-xl font-semibold leading-8" style={{ color: "var(--color-text)" }}>
                {speedModeExercise.word}
              </p>
            </div>

            <p className="text-sm leading-6" style={{ color: "var(--color-text)" }}>
              Pick the English meaning as fast as you can, just like a duel multiple-choice card.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {speedModeQuestion.options.map((option, index) => {
            const isSelected = speedModeSession.selectedOption === option;
            const isCorrectOption = option === speedModeQuestion.correctOption;
            const showCorrectState =
              speedModeSession.locked && (speedModeSession.feedback === "correct" || isCorrectOption);
            const showWrongState = isSelected && speedModeSession.feedback === "wrong";

            return (
              <button
                key={option}
                type="button"
                onClick={() => handleSpeedModeAnswer(option)}
                disabled={speedModeSession.locked}
                data-testid={`speed-mode-answer-${index}`}
                className="w-full rounded-2xl border-2 px-4 py-3 text-left text-base font-semibold transition disabled:cursor-not-allowed disabled:opacity-80"
                style={{
                  backgroundColor: showCorrectState
                    ? "color-mix(in srgb, var(--color-cta) 22%, transparent)"
                    : showWrongState
                      ? "rgba(239, 68, 68, 0.12)"
                      : "color-mix(in srgb, var(--color-primary) 22%, white 78%)",
                  borderColor: showCorrectState
                    ? "var(--color-cta)"
                    : showWrongState
                      ? "rgb(239 68 68)"
                      : "color-mix(in srgb, var(--color-primary) 75%, transparent)",
                  color: "var(--color-text)",
                }}
              >
                {option}
                {showCorrectState && isCorrectOption ? "  ✓" : ""}
                {showWrongState ? "  ✕" : ""}
              </button>
            );
          })}
        </div>

        <p
          className={`text-sm font-semibold text-center ${
            speedModeSession.feedback === "correct"
              ? "text-emerald-600"
              : speedModeSession.feedback === "wrong" || speedModeSession.feedback === "timed_out"
                ? "text-red-500"
                : ""
          }`}
          style={{
            color:
              speedModeSession.feedback === "idle"
                ? "var(--color-text)"
                : undefined,
          }}
          data-testid={`speed-mode-feedback-${speedModeSession.feedback}`}
        >
          {feedbackMessage[speedModeSession.feedback]}
        </p>

        {speedModeSession.locked && (
          <div
            className="rounded-2xl border px-4 py-3"
            style={{
              borderColor: "color-mix(in srgb, var(--color-primary) 24%, transparent)",
              backgroundColor: "color-mix(in srgb, var(--color-background-elevated) 72%, transparent)",
            }}
          >
            <p
              className="text-[11px] font-black uppercase tracking-[0.22em]"
              style={{ color: "var(--color-text-muted)" }}
            >
              Duel Answer
            </p>
            <p className="mt-1 text-sm leading-6" style={{ color: "var(--color-text)" }}>
              {`"${speedModeExercise.word}" means "${speedModeExercise.answer}".`}
            </p>
          </div>
        )}
      </div>
    );
  };

  const renderSentencePrototypeShell = (children: ReactNode, title: string, mode: "missing_chunk" | "rebuild_sentence" | "speed") => (
    <main className="relative z-10 flex flex-1 w-full items-start justify-center px-4 pt-20 pb-[calc(24px+env(safe-area-inset-bottom))]">
      <section
        className="w-full max-w-[420px] rounded-[28px] border p-4 sm:p-5 shadow-2xl backdrop-blur-md animate-slide-up"
        style={{
          background:
            "linear-gradient(180deg, color-mix(in srgb, var(--color-background-elevated) 82%, white 18%) 0%, color-mix(in srgb, var(--color-background-elevated) 90%, transparent) 100%)",
          borderColor: "color-mix(in srgb, var(--color-primary) 22%, white 24%)",
          boxShadow: "0 24px 70px rgba(0, 0, 0, 0.28)",
        }}
      >
        <div className="mb-4 flex items-center justify-between gap-3">
          <PrototypeActionButton
            variant="ghost"
            onClick={handleBackToHome}
            dataTestId={`${mode}-header-back-home`}
          >
            Back to Home
          </PrototypeActionButton>

          <div className="text-right">
            <p
              className="text-[11px] font-bold uppercase tracking-[0.28em]"
              style={{ color: "var(--color-primary-dark)" }}
            >
              Homepage Prototype
            </p>
            <h2 className="title-font text-3xl leading-none" style={{ color: "var(--color-text)" }}>
              {title}
            </h2>
          </div>
        </div>

        {children}
      </section>
    </main>
  );

  return (
    <ThemedPage className={screen === "home" ? "justify-between" : undefined}>
      <div className="absolute top-3 left-2 sm:left-4 z-20">
        <LeftNavButtons />
      </div>

      <div className="absolute top-3 right-2 sm:right-4 z-20">
        <AuthButtons flash={flashAuth} />
      </div>

      {screen === "home" ? (
        <>
          <header className="relative z-10 flex flex-col items-center pt-8 pb-4 animate-slide-up shrink-0">
            <div
              className="w-16 h-0.5 bg-gradient-to-r from-transparent via-current to-transparent mb-3 rounded-full"
              style={{ color: "var(--color-text-muted)" }}
            />

            <h1 className="title-font text-5xl sm:text-6xl md:text-7xl tracking-tight text-center leading-none relative">
              <span
                className="title-text-outline"
                data-text="Language"
                style={{
                  backgroundImage:
                    "linear-gradient(135deg, var(--color-primary-dark) 0%, var(--color-primary-light) 50%, var(--color-primary-dark) 100%)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                }}
              >
                Language
              </span>
              <br />
              <span
                className="title-text-outline-accent"
                data-text="Duel"
                style={{
                  backgroundImage:
                    "linear-gradient(135deg, var(--color-cta-dark) 0%, var(--color-cta-light) 50%, var(--color-cta-dark) 100%)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                }}
              >
                Duel
              </span>
            </h1>

            <p
              className="mt-3 text-base sm:text-lg text-center max-w-[360px] px-4 font-light tracking-wide animate-slide-up delay-200"
              style={{ color: "var(--color-text)" }}
            >
              Achieve <b><u>oral mastery</u></b> and find out
              <br />
              which one of you <b><u>sucks</u></b> more
            </p>
          </header>

          <div className="flex-1" />

          <main className="relative z-10 w-full max-w-[360px] mx-auto px-6 pb-[calc(20px+env(safe-area-inset-bottom))] animate-slide-up delay-300">
            <nav className="w-full flex flex-col gap-2.5">
              {showMockFeaturesMenu ? (
                <>
                  <div className="animate-slide-up delay-300">
                    <MenuButton onClick={() => guardAuth(openMemoryGame)} dataTestId="home-memory-game">
                      <MemoryIcon />
                      Memory Game
                    </MenuButton>
                  </div>

                  <div className="animate-slide-up delay-400">
                    <MenuButton onClick={() => openSentencePrototype("missing_chunk")} dataTestId="home-beta-missing-chunk">
                      <MissingChunkIcon />
                      Sentence Beta: Missing Chunk
                    </MenuButton>
                  </div>

                  <div className="animate-slide-up delay-500">
                    <MenuButton onClick={() => openSentencePrototype("rebuild_sentence")} dataTestId="home-beta-rebuild-sentence">
                      <RebuildSentenceIcon />
                      Sentence Beta: Rebuild Sentence
                    </MenuButton>
                  </div>

                  <div className="animate-slide-up delay-600">
                    <MenuButton onClick={openSpeedMode} dataTestId="home-speed-mode">
                      <SpeedModeIcon />
                      Speed Mode
                    </MenuButton>
                  </div>

                  <div className="animate-slide-up delay-700">
                    <MenuButton
                      onClick={() => setShowMockFeaturesMenu(false)}
                      dataTestId="home-mock-features-back"
                    >
                      <MockFeaturesIcon />
                      Back to Main Menu
                    </MenuButton>
                  </div>
                </>
              ) : (
                <>
                  <div className="animate-slide-up delay-300">
                    <MenuButton onClick={() => guardAuth(() => router.push("/study"))} dataTestId="home-study">
                      <StudyIcon />
                      Study
                    </MenuButton>
                  </div>

                  <div className="animate-slide-up delay-400">
                    <MenuButton onClick={() => guardAuth(lobby.openSoloModal)} dataTestId="home-solo-challenge">
                      <SoloIcon />
                      Solo Challenge
                    </MenuButton>
                  </div>

                  <div className="animate-slide-up delay-500">
                    <MenuButton onClick={() => guardAuth(lobby.openUnifiedDuelModal)} dataTestId="home-duel">
                      <DuelIcon />
                      Duel
                    </MenuButton>
                  </div>

                  <div className="animate-slide-up delay-600">
                    <MenuButton onClick={() => guardAuth(() => router.push("/themes"))} dataTestId="home-manage-themes">
                      <ThemesIcon />
                      Manage Themes
                    </MenuButton>
                  </div>

                  <div className="animate-slide-up delay-700">
                    <MenuButton onClick={() => setShowMockFeaturesMenu(true)} dataTestId="home-mock-features">
                      <MockFeaturesIcon />
                      Mock Features
                    </MenuButton>
                  </div>
                </>
              )}
            </nav>
          </main>
        </>
      ) : screen === "memory" ? (
        <main className="relative z-10 flex flex-1 w-full items-start justify-center px-4 pt-20 pb-[calc(24px+env(safe-area-inset-bottom))]">
          <section
            className="w-full max-w-[420px] rounded-[28px] border p-4 sm:p-5 shadow-2xl backdrop-blur-md animate-slide-up"
            style={{
              background:
                "linear-gradient(180deg, color-mix(in srgb, var(--color-background-elevated) 82%, white 18%) 0%, color-mix(in srgb, var(--color-background-elevated) 90%, transparent) 100%)",
              borderColor: "color-mix(in srgb, var(--color-primary) 22%, white 24%)",
              boxShadow: "0 24px 70px rgba(0, 0, 0, 0.28)",
            }}
          >
            <div className="flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={handleBackToHome}
                data-testid="memory-game-back"
                className="rounded-full border px-3 py-1.5 text-sm font-semibold uppercase tracking-[0.18em] transition-colors"
                style={{
                  color: "var(--color-text)",
                  borderColor: "color-mix(in srgb, var(--color-primary) 40%, transparent)",
                  backgroundColor: "color-mix(in srgb, var(--color-background-elevated) 65%, transparent)",
                }}
              >
                Back
              </button>

              <div className="text-right">
                <p
                  className="text-[11px] font-bold uppercase tracking-[0.28em]"
                  style={{ color: "var(--color-primary-dark)" }}
                >
                  Solo Prototype
                </p>
                <h2 className="title-font text-3xl leading-none" style={{ color: "var(--color-text)" }}>
                  Memory Game
                </h2>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-3 gap-2.5 sm:gap-3">
              <div
                className="rounded-2xl border px-3 py-2.5"
                style={{
                  backgroundColor: "color-mix(in srgb, var(--color-primary-light) 24%, white 76%)",
                  borderColor: "color-mix(in srgb, var(--color-primary) 32%, white 10%)",
                }}
              >
                <p className="text-[11px] font-bold uppercase tracking-[0.18em]" style={{ color: "var(--color-primary-dark)" }}>
                  Moves
                </p>
                <p className="mt-1 text-xl font-black" style={{ color: "var(--color-text)" }}>
                  {moves}
                </p>
              </div>

              <div
                className="rounded-2xl border px-3 py-2.5"
                style={{
                  backgroundColor: "color-mix(in srgb, var(--color-cta-light) 26%, white 74%)",
                  borderColor: "color-mix(in srgb, var(--color-cta) 18%, transparent)",
                }}
              >
                <p className="text-[11px] font-bold uppercase tracking-[0.18em]" style={{ color: "var(--color-cta-dark)" }}>
                  Time
                </p>
                <p className="mt-1 text-xl font-black" style={{ color: "var(--color-text)" }}>
                  {formattedElapsedTime}
                </p>
              </div>

              <div
                className="rounded-2xl border px-3 py-2.5"
                style={{
                  backgroundColor: "color-mix(in srgb, var(--color-neutral) 14%, white 86%)",
                  borderColor: "color-mix(in srgb, var(--color-neutral) 32%, transparent)",
                }}
              >
                <p className="text-[11px] font-bold uppercase tracking-[0.18em]" style={{ color: "var(--color-text)" }}>
                  Pairs
                </p>
                <p className="mt-1 text-xl font-black" style={{ color: "var(--color-text)" }}>
                  {matchedPairIds.length}/{MEMORY_GAME_PAIRS.length}
                </p>
              </div>
            </div>

            <div
              className="mt-4 rounded-2xl border px-4 py-3"
              style={{
                backgroundColor:
                  status === "completed"
                    ? "color-mix(in srgb, var(--color-cta-light) 18%, white 82%)"
                    : "color-mix(in srgb, var(--color-background-elevated) 72%, transparent)",
                borderColor:
                  status === "completed"
                    ? "color-mix(in srgb, var(--color-cta) 28%, transparent)"
                    : "color-mix(in srgb, var(--color-primary) 14%, transparent)",
              }}
            >
              <p className="text-sm font-semibold" style={{ color: "var(--color-text)" }}>
                {status === "idle" && "Tap two cards to match each word with its translation."}
                {status === "playing" && !isResolvingMismatch && "Keep going. Match every vocabulary pair to finish the round."}
                {status === "playing" && isResolvingMismatch && "Not a match. Those cards will flip back in a moment."}
                {status === "completed" && `You cleared the board in ${moves} moves and ${formattedElapsedTime}.`}
              </p>
            </div>

            <div className="mt-4 grid grid-cols-3 gap-2.5 sm:gap-3">
              {cards.map((card, index) => {
                const isMatched = matchedPairIds.includes(card.pairId);
                const isRevealed = revealedCardIndexes.has(index);

                return (
                  <button
                    key={card.id}
                    type="button"
                    onClick={() => handleSelectMemoryCard(index)}
                    data-testid={`memory-card-${index}`}
                    disabled={isMatched || isRevealed || isResolvingMismatch || status === "completed"}
                    className="group relative aspect-[0.9] rounded-2xl text-left transition-transform duration-200"
                    style={{
                      perspective: "1000px",
                      opacity: isMatched ? 0.9 : 1,
                    }}
                  >
                    <div
                      className="relative h-full w-full rounded-2xl transition-transform duration-300"
                      style={{
                        transformStyle: "preserve-3d",
                        transform: isRevealed ? "rotateY(180deg)" : "rotateY(0deg)",
                      }}
                    >
                      <div
                        className="absolute inset-0 flex h-full w-full flex-col justify-between rounded-2xl border p-3 shadow-lg"
                        style={{
                          backfaceVisibility: "hidden",
                          borderColor: "color-mix(in srgb, var(--color-primary) 24%, transparent)",
                          background:
                            "linear-gradient(180deg, color-mix(in srgb, var(--color-primary) 95%, black 5%) 0%, color-mix(in srgb, var(--color-primary-dark) 88%, black 12%) 100%)",
                        }}
                      >
                        <span
                          className="text-[10px] font-bold uppercase tracking-[0.22em]"
                          style={{ color: "color-mix(in srgb, white 80%, var(--color-primary-light) 20%)" }}
                        >
                          Hidden
                        </span>
                        <span className="text-2xl font-black" style={{ color: "white" }}>
                          ?
                        </span>
                      </div>

                      <div
                        className="absolute inset-0 flex h-full w-full flex-col justify-between rounded-2xl border p-3 shadow-lg"
                        style={{
                          backfaceVisibility: "hidden",
                          transform: "rotateY(180deg)",
                          borderColor: isMatched
                            ? "color-mix(in srgb, var(--color-cta) 28%, transparent)"
                            : "color-mix(in srgb, var(--color-primary) 32%, white 10%)",
                          background:
                            card.side === "source"
                              ? "linear-gradient(180deg, color-mix(in srgb, var(--color-primary-light) 30%, white 70%) 0%, color-mix(in srgb, var(--color-background-elevated) 88%, white 12%) 100%)"
                              : "linear-gradient(180deg, color-mix(in srgb, var(--color-cta-light) 28%, white 72%) 0%, color-mix(in srgb, var(--color-background-elevated) 88%, white 12%) 100%)",
                        }}
                      >
                        <span
                          className="text-[10px] font-bold uppercase tracking-[0.22em]"
                          style={{ color: card.side === "source" ? "var(--color-primary-dark)" : "var(--color-cta-dark)" }}
                        >
                          {card.side === "source" ? "Word" : "Translation"}
                        </span>
                        <span
                          className="text-base font-black leading-tight sm:text-lg"
                          style={{ color: "var(--color-text)" }}
                        >
                          {card.text}
                        </span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                onClick={handleRestartMemoryGame}
                data-testid="memory-game-play-again"
                className="flex-1 rounded-xl border px-4 py-3 text-sm font-bold uppercase tracking-[0.2em] transition-transform duration-200 hover:translate-y-0.5"
                style={{
                  color: "white",
                  borderColor: "var(--color-cta-light)",
                  background:
                    "linear-gradient(to bottom, var(--color-cta) 0%, var(--color-cta-dark) 100%)",
                  boxShadow: "0 10px 24px color-mix(in srgb, var(--color-cta) 38%, transparent)",
                }}
              >
                Play Again
              </button>

              <button
                type="button"
                onClick={handleBackToHome}
                data-testid="memory-game-home"
                className="flex-1 rounded-xl border px-4 py-3 text-sm font-bold uppercase tracking-[0.2em] transition-colors"
                style={{
                  color: "var(--color-text)",
                  borderColor: "color-mix(in srgb, var(--color-primary) 24%, transparent)",
                  backgroundColor: "color-mix(in srgb, var(--color-background-elevated) 72%, transparent)",
                }}
              >
                Back to Home
              </button>
            </div>
          </section>
        </main>
      ) : screen === "missing_chunk" ? (
        renderSentencePrototypeShell(renderMissingChunkPanel(), "Missing Chunk", "missing_chunk")
      ) : screen === "speed" ? (
        renderSentencePrototypeShell(renderSpeedModePanel(), "Speed Mode", "speed")
      ) : (
        renderSentencePrototypeShell(renderRebuildSentencePanel(), "Rebuild Sentence", "rebuild_sentence")
      )}

      {lobby.showUnifiedDuelModal && (
        <UnifiedDuelModal
          users={lobby.users}
          themes={lobby.themes}
          pendingDuels={[
            ...(lobby.pendingClassicDuels?.map((duel) => ({
              ...duel,
              challenge: { ...duel.challenge, mode: "classic" as const },
            })) || []),
            ...(lobby.pendingSoloStyleDuels?.map((duel) => ({
              ...duel,
              challenge: { ...duel.challenge, mode: "solo" as const },
            })) || []),
          ]}
          isJoiningDuel={lobby.isJoiningDuel}
          isCreatingDuel={lobby.isCreatingDuel}
          onAcceptDuel={lobby.handleAcceptDuel}
          onRejectDuel={lobby.handleRejectDuel}
          onCreateDuel={lobby.handleCreateDuel}
          onClose={lobby.closeUnifiedDuelModal}
          onNavigateToThemes={lobby.navigateToThemes}
        />
      )}

      {lobby.showSoloModal && (
        <SoloModal
          themes={lobby.themes}
          onContinue={lobby.handleContinueSolo}
          onClose={handleCloseSoloModal}
          onNavigateToThemes={lobby.navigateToThemes}
          initialThemeIds={soloThemeIds}
          initialMode={soloInitialMode}
        />
      )}

      {lobby.showWaitingModal && (
        <WaitingModal
          isCancelling={lobby.isCancellingDuel}
          onCancel={lobby.handleCancelWaiting}
        />
      )}

      {lobby.isJoiningDuel && <JoiningModal />}
    </ThemedPage>
  );
}
