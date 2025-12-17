"use client";

import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useState, useEffect, useRef } from "react";
import type { Id } from "@/convex/_generated/dataModel";
import { toast } from "sonner";
import { TimerSelectionView, LearnGridView } from "./components";

// State for each word: hintCount and revealedPositions
interface HintState {
  hintCount: number;
  revealedPositions: number[];
}

// Timer color thresholds
const TIMER_GREEN_THRESHOLD = 0.5;   // >50% time remaining
const TIMER_YELLOW_THRESHOLD = 0.17; // >17% time remaining

export default function DuelLearnPage() {
  const params = useParams();
  const router = useRouter();
  const duelId = params.duelId as string;

  // Fetch duel data
  const duelData = useQuery(api.duel.getDuel, { duelId: duelId as Id<"challenges"> });
  const theme = useQuery(
    api.themes.getTheme,
    duelData?.duel?.themeId ? { themeId: duelData.duel.themeId } : "skip"
  );

  // Mutations
  const selectTimer = useMutation(api.duel.selectLearnTimer);
  const confirmTimer = useMutation(api.duel.confirmLearnTimer);
  const initializeChallenge = useMutation(api.duel.initializeDuelChallenge);
  const stopDuel = useMutation(api.duel.stopDuel);

  // Local state
  const [hintStates, setHintStates] = useState<Record<string, HintState>>({});
  const [isRevealed, setIsRevealed] = useState(true);
  const [playingWordIndex, setPlayingWordIndex] = useState<number | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const hasInitializedRef = useRef(false);

  // Extract duel data
  const duel = duelData?.duel;
  const challenger = duelData?.challenger;
  const opponent = duelData?.opponent;
  const timerSelection = duel?.learnTimerSelection;
  const viewerRole = duelData?.viewerRole as "challenger" | "opponent" | undefined;

  // Determine if current user is challenger or opponent
  const isChallenger = viewerRole === "challenger";
  const opponentName = isChallenger ? opponent?.name : challenger?.name;

  // Get selections and confirmations
  const mySelection = isChallenger ? timerSelection?.challengerSelection : timerSelection?.opponentSelection;
  const myConfirmed = isChallenger ? timerSelection?.challengerConfirmed : timerSelection?.opponentConfirmed;
  const bothConfirmed = timerSelection?.challengerConfirmed && timerSelection?.opponentConfirmed;
  const confirmedDuration = timerSelection?.confirmedDuration;
  const learnStartTime = timerSelection?.learnStartTime;

  // Calculate time remaining
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);

  useEffect(() => {
    if (!learnStartTime || !confirmedDuration) {
      setTimeRemaining(null);
      return;
    }

    const updateTimer = () => {
      const elapsed = Math.floor((Date.now() - learnStartTime) / 1000);
      const remaining = Math.max(0, confirmedDuration - elapsed);
      setTimeRemaining(remaining);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);

    return () => clearInterval(interval);
  }, [learnStartTime, confirmedDuration]);

  // Navigate to challenge when timer ends
  useEffect(() => {
    if (timeRemaining === 0 && !hasInitializedRef.current) {
      hasInitializedRef.current = true;
      initializeChallenge({ duelId: duel?._id as Id<"challenges"> })
        .then(() => {
          router.push(`/duel/${duelId}`);
        })
        .catch(console.error);
    }
  }, [timeRemaining, duel?._id, duelId, router, initializeChallenge]);

  // Redirect if status changed
  useEffect(() => {
    if (duel?.status === "challenging") {
      router.push(`/duel/${duelId}`);
    } else if (duel?.status === "stopped" || duel?.status === "rejected") {
      router.push("/");
    }
  }, [duel?.status, duelId, router]);

  // Hint functions
  const getHintState = (wordKey: string): HintState => {
    return hintStates[wordKey] || { hintCount: 0, revealedPositions: [] };
  };

  const revealLetter = (wordKey: string, position: number) => {
    setHintStates((prev) => {
      const current = prev[wordKey] || { hintCount: 0, revealedPositions: [] };
      if (current.revealedPositions.includes(position)) return prev;
      return {
        ...prev,
        [wordKey]: {
          hintCount: current.hintCount + 1,
          revealedPositions: [...current.revealedPositions, position],
        },
      };
    });
  };

  const revealFullWord = (wordKey: string, answer: string) => {
    const allPositions = answer
      .split("")
      .map((char, idx) => (char !== " " ? idx : -1))
      .filter((idx) => idx !== -1);
    setHintStates((prev) => ({
      ...prev,
      [wordKey]: {
        hintCount: allPositions.length,
        revealedPositions: allPositions,
      },
    }));
  };

  const resetWord = (wordKey: string) => {
    setHintStates((prev) => {
      const newState = { ...prev };
      delete newState[wordKey];
      return newState;
    });
  };

  const resetAll = () => {
    setHintStates({});
  };

  // TTS function
  const playTTS = async (wordIndex: number, spanishWord: string) => {
    if (playingWordIndex !== null) return;

    setPlayingWordIndex(wordIndex);
    try {
      const response = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: spanishWord }),
      });

      if (!response.ok) throw new Error("TTS request failed");

      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);

      if (audioRef.current) audioRef.current.pause();

      const audio = new Audio(audioUrl);
      audioRef.current = audio;

      audio.onended = () => {
        setPlayingWordIndex(null);
        URL.revokeObjectURL(audioUrl);
      };

      audio.onerror = () => {
        setPlayingWordIndex(null);
        URL.revokeObjectURL(audioUrl);
      };

      await audio.play();
    } catch (error) {
      console.error("Failed to play audio:", error);
      setPlayingWordIndex(null);
    }
  };

  // Handle timer selection
  const handleSelectTimer = async (duration: number) => {
    if (myConfirmed || !duel?._id) return;
    try {
      await selectTimer({ duelId: duel._id, duration });
    } catch (error) {
      console.error("Failed to select timer:", error);
      toast.error("Failed to select timer");
    }
  };

  // Handle confirm
  const handleConfirm = async () => {
    if (!duel?._id) return;
    try {
      await confirmTimer({ duelId: duel._id });
    } catch (error) {
      console.error("Failed to confirm:", error);
      toast.error("Failed to confirm");
    }
  };

  // Handle skip to challenge
  const handleSkip = async () => {
    if (!duel?._id) return;
    hasInitializedRef.current = true;
    try {
      await initializeChallenge({ duelId: duel._id });
      router.push(`/duel/${duelId}`);
    } catch (error) {
      console.error("Failed to skip:", error);
      toast.error("Failed to skip to challenge");
    }
  };

  // Handle exit
  const handleExit = async () => {
    try {
      if (duel?._id) {
        await stopDuel({ duelId: duel._id });
      }
      router.push("/");
    } catch (error) {
      console.error("Failed to exit:", error);
      toast.error("Failed to exit duel");
    }
  };

  const getTimerColor = () => {
    if (!timeRemaining || !confirmedDuration) return "text-white";
    const percentage = timeRemaining / confirmedDuration;
    if (percentage > TIMER_GREEN_THRESHOLD) return "text-green-400";
    if (percentage > TIMER_YELLOW_THRESHOLD) return "text-yellow-400";
    return "text-red-400";
  };

  // Loading states
  if (duelData === null) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center text-white">
        You&apos;re not part of this duel
      </div>
    );
  }
  if (duelData === undefined || theme === undefined) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
      </div>
    );
  }
  if (!theme) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center text-white">
        Theme not found
      </div>
    );
  }

  // Timer selection phase (before both confirm)
  if (!bothConfirmed) {
    return (
      <TimerSelectionView
        themeName={theme.name}
        wordCount={theme.words.length}
        challenger={challenger}
        opponent={opponent}
        timerSelection={timerSelection}
        mySelection={mySelection}
        myConfirmed={myConfirmed}
        opponentName={opponentName}
        onSelectTimer={handleSelectTimer}
        onConfirm={handleConfirm}
        onExit={handleExit}
      />
    );
  }

  // Learning phase (timer running)
  return (
    <LearnGridView
      themeName={theme.name}
      challengerName={challenger?.name}
      opponentName={opponent?.name}
      words={theme.words}
      duelId={duelId}
      timeRemaining={timeRemaining}
      timerColor={getTimerColor()}
      isRevealed={isRevealed}
      playingWordIndex={playingWordIndex}
      getHintState={getHintState}
      onToggleRevealed={() => setIsRevealed(!isRevealed)}
      onResetAll={resetAll}
      onRevealLetter={revealLetter}
      onRevealFullWord={revealFullWord}
      onResetWord={resetWord}
      onPlayTTS={playTTS}
      onSkip={handleSkip}
      onExit={handleExit}
    />
  );
}
