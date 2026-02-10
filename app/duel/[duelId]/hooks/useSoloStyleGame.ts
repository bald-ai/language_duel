"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";
import { HINT_BANNER_DURATION_MS, FEEDBACK_SHORT_MS, FEEDBACK_LONG_MS } from "@/lib/constants";
import { useTTS } from "@/app/game/hooks/useTTS";

interface Word {
  word: string;
  answer: string;
  wrongAnswers: string[];
  ttsStorageId?: string;
}

interface WordState {
  completedLevel3: boolean;
}

interface PlayerStats {
  questionsAnswered: number;
  correctAnswers: number;
}

interface UseSoloStyleGameParams {
  duel: Doc<"challenges">;
  theme: Doc<"themes">;
  viewerRole: "challenger" | "opponent";
}

export function useSoloStyleGame({
  duel,
  theme,
  viewerRole,
}: UseSoloStyleGameParams) {
  const router = useRouter();
  const isChallenger = viewerRole === "challenger";

  // Mutations
  const submitAnswer = useMutation(api.duel.submitSoloAnswer);
  const stopDuel = useMutation(api.duel.stopDuel);
  const requestSoloHint = useMutation(api.duel.requestSoloHint);
  const acceptSoloHint = useMutation(api.duel.acceptSoloHint);
  const provideSoloHint = useMutation(api.duel.provideSoloHint);
  const updateSoloHintState = useMutation(api.duel.updateSoloHintState);
  const cancelSoloHint = useMutation(api.duel.cancelSoloHint);
  // L2 hint mutations
  const requestSoloHintL2 = useMutation(api.duel.requestSoloHintL2);
  const acceptSoloHintL2 = useMutation(api.duel.acceptSoloHintL2);
  const eliminateSoloHintL2Option = useMutation(api.duel.eliminateSoloHintL2Option);
  const cancelSoloHintL2 = useMutation(api.duel.cancelSoloHintL2);

  // Feedback state
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedbackCorrect, setFeedbackCorrect] = useState(false);
  const [feedbackAnswer, setFeedbackAnswer] = useState<string | null>(null);

  // Duel duration tracking
  const duelStartTimeRef = useRef<number | null>(null);
  const [duelDuration, setDuelDuration] = useState<number>(0);

  // Opponent status tracking
  const [opponentAnswerFeedback, setOpponentAnswerFeedback] = useState<"correct" | "wrong" | null>(null);
  const [opponentLastAnsweredWord, setOpponentLastAnsweredWord] = useState<string | null>(null);
  const [opponentFeedbackMessage, setOpponentFeedbackMessage] = useState<string | null>(null);
  const opponentFeedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const opponentWordFailCountsRef = useRef<Record<number, number>>({});
  const prevOpponentStatsRef = useRef<{
    questionsAnswered: number;
    correctAnswers: number;
    wordIndex: number;
    level: number;
  } | null>(null);

  // Hint giver view visibility
  const [showHintGiverView, setShowHintGiverView] = useState(false);
  const [showL2HintGiverView, setShowL2HintGiverView] = useState(false);

  // Hint selector visibility (can be dismissed)
  const [hintSelectorDismissed, setHintSelectorDismissed] = useState(false);
  const [hintL2SelectorDismissed, setHintL2SelectorDismissed] = useState(false);

  const ttsPlayedForHintRef = useRef<string | null>(null);

  // Flash hint state
  const [showFlashHint, setShowFlashHint] = useState(false);
  const [flashHintAnswer, setFlashHintAnswer] = useState<string | null>(null);
  const flashHintShownRef = useRef<string | null>(null);
  const flashHintTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flashHintL2TimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Temporary "hint sent" banners
  const [showHintSentBanner, setShowHintSentBanner] = useState(false);
  const [showHintSentBannerL2, setShowHintSentBannerL2] = useState(false);
  const { playTTS } = useTTS();

  // Get player-specific state from duel
  const myWordStates = (isChallenger ? duel.challengerWordStates : duel.opponentWordStates) as WordState[] | undefined;
  const myCurrentWordIndex = isChallenger ? duel.challengerCurrentWordIndex : duel.opponentCurrentWordIndex;
  const myCurrentLevel = isChallenger ? duel.challengerCurrentLevel : duel.opponentCurrentLevel;
  const myLevel2Mode = isChallenger ? duel.challengerLevel2Mode : duel.opponentLevel2Mode;
  const myCompleted = isChallenger ? duel.challengerCompleted : duel.opponentCompleted;
  const myStats = (isChallenger ? duel.challengerStats : duel.opponentStats) as PlayerStats | undefined;

  const theirCompleted = isChallenger ? duel.opponentCompleted : duel.challengerCompleted;
  const theirStats = (isChallenger ? duel.opponentStats : duel.challengerStats) as PlayerStats | undefined;
  const theirWordStates = (isChallenger ? duel.opponentWordStates : duel.challengerWordStates) as WordState[] | undefined;
  const theirCurrentWordIndex = isChallenger ? duel.opponentCurrentWordIndex : duel.challengerCurrentWordIndex;
  const theirCurrentLevel = isChallenger ? duel.opponentCurrentLevel : duel.challengerCurrentLevel;

  // Current word
  const currentWord: Word | null = myCurrentWordIndex !== undefined ? theme.words[myCurrentWordIndex] : null;

  // === Hint system state ===
  const myRole = isChallenger ? "challenger" : "opponent";
  const theirRole = isChallenger ? "opponent" : "challenger";

  const hintRequestedBy = duel.soloHintRequestedBy;
  const hintAccepted = duel.soloHintAccepted;
  const hintRequesterState = duel.soloHintRequesterState;
  const hintRevealedPositions = duel.soloHintRevealedPositions || [];
  const hintType = duel.soloHintType;
  const hintRequesterLevel = hintRequesterState?.level;

  const canRequestHint = !hintRequestedBy;
  const iRequestedHint = hintRequestedBy === myRole;
  const theyRequestedHint = hintRequestedBy === theirRole;
  const canAcceptHint = theyRequestedHint && !hintAccepted;
  const isHintGiver = theyRequestedHint && hintAccepted;

  const hintRequesterWord: Word | null = hintRequesterState
    ? theme.words[hintRequesterState.wordIndex]
    : null;

  // === L2 Multiple Choice Hint system state ===
  const hintL2RequestedBy = duel.soloHintL2RequestedBy;
  const hintL2Accepted = duel.soloHintL2Accepted;
  const hintL2WordIndex = duel.soloHintL2WordIndex;
  const hintL2Options = duel.soloHintL2Options || [];
  const hintL2EliminatedOptions = duel.soloHintL2EliminatedOptions || [];
  const hintL2Type = duel.soloHintL2Type;

  const canRequestHintL2 = myCurrentLevel === 2 && myLevel2Mode === "multiple_choice" && !hintL2RequestedBy;
  const iRequestedHintL2 = hintL2RequestedBy === myRole;
  const theyRequestedHintL2 = hintL2RequestedBy === theirRole;
  const canAcceptHintL2 = theyRequestedHintL2 && !hintL2Accepted;
  const isHintGiverL2 = theyRequestedHintL2 && hintL2Accepted;

  const hintL2RequesterWord: Word | null = hintL2WordIndex !== undefined
    ? theme.words[hintL2WordIndex]
    : null;

  // Progress calculation
  const myMastered = myWordStates?.filter((ws) => ws.completedLevel3).length || 0;
  const theirMastered = theirWordStates?.filter((ws) => ws.completedLevel3).length || 0;
  const totalWords = theme.words.length;

  // Track duel start time and calculate duration
  useEffect(() => {
    if (duel.status === "challenging" && duelStartTimeRef.current === null) {
      duelStartTimeRef.current = Date.now();
    }
    if (duel.status === "completed" && duelStartTimeRef.current !== null) {
      const duration = Math.floor((Date.now() - duelStartTimeRef.current) / 1000);
      setDuelDuration(duration);
    }
  }, [duel.status]);

  // Opponent answer feedback effect
  useEffect(() => {
    if (!theirStats || theirCurrentWordIndex === undefined || theirCurrentLevel === undefined) {
      if (opponentFeedbackTimerRef.current) {
        clearTimeout(opponentFeedbackTimerRef.current);
        opponentFeedbackTimerRef.current = null;
      }
      prevOpponentStatsRef.current = null;
      return;
    }

    const prev = prevOpponentStatsRef.current;

    if (prev && theirStats.questionsAnswered > prev.questionsAnswered) {
      const answeredWord = theme.words[prev.wordIndex]?.word || "...";
      setOpponentLastAnsweredWord(answeredWord);

      const wasCorrect = theirStats.correctAnswers > prev.correctAnswers;
      setOpponentAnswerFeedback(wasCorrect ? "correct" : "wrong");

      if (!wasCorrect) {
        const currentCount = opponentWordFailCountsRef.current[prev.wordIndex] || 0;
        opponentWordFailCountsRef.current[prev.wordIndex] = currentCount + 1;
        const failCount = currentCount + 1;
        setOpponentFeedbackMessage(`Failed ${failCount} time${failCount > 1 ? "s" : ""}`);
      } else if (prev.level === 3) {
        setOpponentFeedbackMessage("Word completed!");
      } else {
        setOpponentFeedbackMessage(null);
      }

      if (opponentFeedbackTimerRef.current) {
        clearTimeout(opponentFeedbackTimerRef.current);
      }
      opponentFeedbackTimerRef.current = setTimeout(() => {
        setOpponentAnswerFeedback(null);
        setOpponentLastAnsweredWord(null);
        setOpponentFeedbackMessage(null);
        opponentFeedbackTimerRef.current = null;
      }, 1500);
    }

    prevOpponentStatsRef.current = {
      questionsAnswered: theirStats.questionsAnswered,
      correctAnswers: theirStats.correctAnswers,
      wordIndex: theirCurrentWordIndex,
      level: theirCurrentLevel,
    };

    return () => {
      if (opponentFeedbackTimerRef.current) {
        clearTimeout(opponentFeedbackTimerRef.current);
        opponentFeedbackTimerRef.current = null;
      }
    };
  }, [theirStats, theirCurrentWordIndex, theirCurrentLevel, theme.words]);

  // Auto-show hint giver view when hint is accepted (only for "letters" type)
  useEffect(() => {
    if (isHintGiver && hintType === "letters") {
      setShowHintGiverView(true);
    } else {
      setShowHintGiverView(false);
    }
  }, [isHintGiver, hintType]);

  // Auto-show L2 hint giver view when L2 hint is accepted (only for "eliminate" type)
  useEffect(() => {
    if (isHintGiverL2 && hintL2Type === "eliminate") {
      setShowL2HintGiverView(true);
    } else {
      setShowL2HintGiverView(false);
    }
  }, [isHintGiverL2, hintL2Type]);

  // Reset hint selector dismissed state when hint request is cleared
  useEffect(() => {
    if (!hintRequestedBy) {
      setHintSelectorDismissed(false);
    }
  }, [hintRequestedBy]);

  useEffect(() => {
    if (!hintL2RequestedBy) {
      setHintL2SelectorDismissed(false);
    }
  }, [hintL2RequestedBy]);

  // Auto-hide hint sent banners (L1/L2 typing/Level 3)
  useEffect(() => {
    const shouldShow = isHintGiver && hintAccepted && ["tts", "flash", "anagram"].includes(hintType || "");
    if (shouldShow) {
      setShowHintSentBanner(true);
      const timer = setTimeout(() => setShowHintSentBanner(false), HINT_BANNER_DURATION_MS);
      return () => clearTimeout(timer);
    }
    setShowHintSentBanner(false);
  }, [isHintGiver, hintAccepted, hintType]);

  // Auto-hide hint sent banners for L2 multiple choice
  useEffect(() => {
    const shouldShowL2 = isHintGiverL2 && hintL2Accepted && ["tts", "flash"].includes(hintL2Type || "");
    if (shouldShowL2) {
      setShowHintSentBannerL2(true);
      const timer = setTimeout(() => setShowHintSentBannerL2(false), HINT_BANNER_DURATION_MS);
      return () => clearTimeout(timer);
    }
    setShowHintSentBannerL2(false);
  }, [isHintGiverL2, hintL2Accepted, hintL2Type]);

  // Play TTS for hint
  const playTTSHint = useCallback(
    (wordKey: string, word: string, storageId?: string) => {
      if (!word) return;
      void playTTS(wordKey, word, { storageId });
    },
    [playTTS]
  );

  // Auto-play TTS when I requested a hint and helper chose TTS type (L1)
  /* eslint-disable react-hooks/exhaustive-deps */
  useEffect(() => {
    const hintKey = `L1-${myCurrentWordIndex}`;
    if (iRequestedHint && hintAccepted && hintType === "tts" && currentWord && ttsPlayedForHintRef.current !== hintKey) {
      ttsPlayedForHintRef.current = hintKey;
      playTTSHint(`solo-hint-${hintKey}`, currentWord.answer, currentWord.ttsStorageId);
    }
    if (!iRequestedHint) {
      ttsPlayedForHintRef.current = null;
    }
  }, [currentWord?.answer, currentWord?.ttsStorageId, hintAccepted, hintType, iRequestedHint, myCurrentWordIndex, playTTSHint]);
  /* eslint-enable react-hooks/exhaustive-deps */

  // Auto-play TTS when I requested a hint and helper chose TTS type (L2)
  /* eslint-disable react-hooks/exhaustive-deps */
  useEffect(() => {
    const hintKey = `L2-${hintL2WordIndex}`;
    if (iRequestedHintL2 && hintL2Accepted && hintL2Type === "tts" && hintL2RequesterWord && ttsPlayedForHintRef.current !== hintKey) {
      ttsPlayedForHintRef.current = hintKey;
      playTTSHint(`solo-hint-${hintKey}`, hintL2RequesterWord.answer, hintL2RequesterWord.ttsStorageId);
    }
    if (!iRequestedHintL2) {
      ttsPlayedForHintRef.current = null;
    }
  }, [hintL2Accepted, hintL2RequesterWord?.answer, hintL2RequesterWord?.ttsStorageId, hintL2Type, hintL2WordIndex, iRequestedHintL2, playTTSHint]);
  /* eslint-enable react-hooks/exhaustive-deps */

  // Show flash hint when I requested a hint and helper chose flash type
  /* eslint-disable react-hooks/exhaustive-deps */
  useEffect(() => {
    const hintKey = `flash-${myCurrentWordIndex}`;
    if (iRequestedHint && hintAccepted && hintType === "flash" && currentWord && flashHintShownRef.current !== hintKey) {
      flashHintShownRef.current = hintKey;
      setFlashHintAnswer(currentWord.answer);
      setShowFlashHint(true);
      if (flashHintTimerRef.current) {
        clearTimeout(flashHintTimerRef.current);
      }
      flashHintTimerRef.current = setTimeout(() => {
        setShowFlashHint(false);
        setFlashHintAnswer(null);
        flashHintTimerRef.current = null;
      }, 500);
    }
    if (!iRequestedHint) {
      flashHintShownRef.current = null;
    }

    return () => {
      if (flashHintTimerRef.current) {
        clearTimeout(flashHintTimerRef.current);
        flashHintTimerRef.current = null;
      }
    };
  }, [iRequestedHint, hintAccepted, hintType, currentWord?.answer, myCurrentWordIndex]);
  /* eslint-enable react-hooks/exhaustive-deps */

  // Show flash hint for L2 hints
  /* eslint-disable react-hooks/exhaustive-deps */
  useEffect(() => {
    const hintKey = `flash-L2-${hintL2WordIndex}`;
    if (iRequestedHintL2 && hintL2Accepted && hintL2Type === "flash" && hintL2RequesterWord && flashHintShownRef.current !== hintKey) {
      flashHintShownRef.current = hintKey;
      setFlashHintAnswer(hintL2RequesterWord.answer);
      setShowFlashHint(true);
      if (flashHintL2TimerRef.current) {
        clearTimeout(flashHintL2TimerRef.current);
      }
      flashHintL2TimerRef.current = setTimeout(() => {
        setShowFlashHint(false);
        setFlashHintAnswer(null);
        flashHintL2TimerRef.current = null;
      }, 500);
    }
    if (!iRequestedHintL2) {
      flashHintShownRef.current = null;
    }

    return () => {
      if (flashHintL2TimerRef.current) {
        clearTimeout(flashHintL2TimerRef.current);
        flashHintL2TimerRef.current = null;
      }
    };
  }, [iRequestedHintL2, hintL2Accepted, hintL2Type, hintL2RequesterWord?.answer, hintL2WordIndex]);
  /* eslint-enable react-hooks/exhaustive-deps */

  // === Handlers ===
  const handleCorrect = useCallback(
    (submittedAnswer: string) => {
      setFeedbackCorrect(true);
      setShowFeedback(true);
      setFeedbackAnswer(null);
      submitAnswer({ duelId: duel._id, answer: submittedAnswer, questionIndex: myCurrentWordIndex ?? 0 }).catch(console.error);
      setTimeout(() => setShowFeedback(false), FEEDBACK_SHORT_MS);
    },
    [duel._id, myCurrentWordIndex, submitAnswer]
  );

  const handleWrong = useCallback(
    (submittedAnswer: string) => {
      setFeedbackCorrect(false);
      setShowFeedback(true);
      setFeedbackAnswer(currentWord?.answer || null);
      submitAnswer({ duelId: duel._id, answer: submittedAnswer, questionIndex: myCurrentWordIndex ?? 0 }).catch(console.error);
      setTimeout(() => setShowFeedback(false), FEEDBACK_LONG_MS);
    },
    [duel._id, myCurrentWordIndex, currentWord?.answer, submitAnswer]
  );

  const handleSkip = useCallback(() => {
    setFeedbackCorrect(false);
    setShowFeedback(true);
    setFeedbackAnswer(currentWord?.answer || null);
    submitAnswer({ duelId: duel._id, answer: "", questionIndex: myCurrentWordIndex ?? 0 }).catch(console.error);
    setTimeout(() => setShowFeedback(false), FEEDBACK_LONG_MS);
  }, [duel._id, myCurrentWordIndex, currentWord?.answer, submitAnswer]);

  const handleExit = useCallback(async () => {
    await stopDuel({ duelId: duel._id });
    router.push("/");
  }, [duel._id, stopDuel, router]);

  // === Hint handlers ===
  const handleRequestHint = useCallback(
    async (typedLetters: string[], revealedPositions: number[]) => {
      try {
        await requestSoloHint({ duelId: duel._id, typedLetters, revealedPositions });
      } catch (error) {
        console.error("Failed to request hint:", error);
      }
    },
    [duel._id, requestSoloHint]
  );

  const handleRequestSimpleHint = useCallback(async () => {
    try {
      await requestSoloHint({ duelId: duel._id, typedLetters: [], revealedPositions: [] });
    } catch (error) {
      console.error("Failed to request hint:", error);
    }
  }, [duel._id, requestSoloHint]);

  const handleCancelHint = useCallback(async () => {
    try {
      await cancelSoloHint({ duelId: duel._id });
    } catch (error) {
      console.error("Failed to cancel hint:", error);
    }
  }, [duel._id, cancelSoloHint]);

  const handleAcceptHint = useCallback(
    async (hintTypeArg: string) => {
      try {
        await acceptSoloHint({ duelId: duel._id, hintType: hintTypeArg });
      } catch (error) {
        console.error("Failed to accept hint:", error);
      }
    },
    [duel._id, acceptSoloHint]
  );

  const handleProvideHint = useCallback(
    async (position: number) => {
      try {
        await provideSoloHint({ duelId: duel._id, position });
      } catch (error) {
        console.error("Failed to provide hint:", error);
      }
    },
    [duel._id, provideSoloHint]
  );

  const handleUpdateHintState = useCallback(
    async (typedLetters: string[], revealedPositions: number[]) => {
      try {
        await updateSoloHintState({ duelId: duel._id, typedLetters, revealedPositions });
      } catch (error) {
        console.error("Failed to update hint state:", error);
      }
    },
    [duel._id, updateSoloHintState]
  );

  // === L2 Hint handlers ===
  const handleRequestHintL2 = useCallback(
    async (options: string[]) => {
      try {
        await requestSoloHintL2({ duelId: duel._id, options });
      } catch (error) {
        console.error("Failed to request L2 hint:", error);
      }
    },
    [duel._id, requestSoloHintL2]
  );

  const handleCancelHintL2 = useCallback(async () => {
    try {
      await cancelSoloHintL2({ duelId: duel._id });
    } catch (error) {
      console.error("Failed to cancel L2 hint:", error);
    }
  }, [duel._id, cancelSoloHintL2]);

  const handleAcceptHintL2 = useCallback(
    async (hintTypeArg: string) => {
      try {
        await acceptSoloHintL2({ duelId: duel._id, hintType: hintTypeArg });
      } catch (error) {
        console.error("Failed to accept L2 hint:", error);
      }
    },
    [duel._id, acceptSoloHintL2]
  );

  const handleEliminateL2Option = useCallback(
    async (option: string) => {
      try {
        await eliminateSoloHintL2Option({ duelId: duel._id, option });
      } catch (error) {
        console.error("Failed to eliminate L2 option:", error);
      }
    },
    [duel._id, eliminateSoloHintL2Option]
  );

  return {
    // Feedback state
    showFeedback,
    feedbackCorrect,
    feedbackAnswer,

    // Duration
    duelDuration,

    // Opponent tracking
    opponentAnswerFeedback,
    opponentLastAnsweredWord,
    opponentFeedbackMessage,

    // Hint giver views
    showHintGiverView,
    setShowHintGiverView,
    showL2HintGiverView,
    setShowL2HintGiverView,

    // Hint selector dismissed
    hintSelectorDismissed,
    setHintSelectorDismissed,
    hintL2SelectorDismissed,
    setHintL2SelectorDismissed,

    // Flash hint
    showFlashHint,
    flashHintAnswer,

    // Hint sent banners
    showHintSentBanner,
    showHintSentBannerL2,

    // Player state
    currentWord,
    myCurrentWordIndex,
    myCurrentLevel,
    myLevel2Mode,
    myCompleted,
    myStats,
    myMastered,
    theirCompleted,
    theirStats,
    theirMastered,
    theirCurrentWordIndex,
    theirCurrentLevel,
    totalWords,

    // Hint state (L1)
    canRequestHint,
    iRequestedHint,
    theyRequestedHint,
    canAcceptHint,
    isHintGiver,
    hintRequesterWord,
    hintRequesterState,
    hintRevealedPositions,
    hintType,
    hintRequesterLevel,
    hintAccepted,

    // Hint state (L2)
    canRequestHintL2,
    iRequestedHintL2,
    theyRequestedHintL2,
    canAcceptHintL2,
    isHintGiverL2,
    hintL2RequesterWord,
    hintL2Options,
    hintL2EliminatedOptions,
    hintL2Type,
    hintL2Accepted,

    // Handlers
    handleCorrect,
    handleWrong,
    handleSkip,
    handleExit,

    // Hint handlers (L1)
    handleRequestHint,
    handleRequestSimpleHint,
    handleCancelHint,
    handleAcceptHint,
    handleProvideHint,
    handleUpdateHintState,

    // Hint handlers (L2)
    handleRequestHintL2,
    handleCancelHintL2,
    handleAcceptHintL2,
    handleEliminateL2Option,
  };
}
