"use client";

import { useParams, useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useState, useEffect, useRef } from "react";
import type { Id } from "@/convex/_generated/dataModel";

// State for each word: hintCount and revealedPositions
interface HintState {
  hintCount: number;
  revealedPositions: number[];
}

const TIMER_OPTIONS = [60, 120, 180, 240, 300, 420, 600, 900]; // 1, 2, 3, 4, 5, 7, 10, 15 min

export default function DuelLearnPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useUser();
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

  // Determine if current user is challenger or opponent
  const isChallenger = challenger?.clerkId === user?.id;
  const isOpponent = opponent?.clerkId === user?.id;
  const myName = isChallenger ? challenger?.name : opponent?.name;
  const theirName = isChallenger ? opponent?.name : challenger?.name;

  // Get selections and confirmations
  const mySelection = isChallenger ? timerSelection?.challengerSelection : timerSelection?.opponentSelection;
  const theirSelection = isChallenger ? timerSelection?.opponentSelection : timerSelection?.challengerSelection;
  const myConfirmed = isChallenger ? timerSelection?.challengerConfirmed : timerSelection?.opponentConfirmed;
  const theirConfirmed = isChallenger ? timerSelection?.opponentConfirmed : timerSelection?.challengerConfirmed;
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
    }
  };

  // Handle confirm
  const handleConfirm = async () => {
    if (!duel?._id) return;
    try {
      await confirmTimer({ duelId: duel._id });
    } catch (error) {
      console.error("Failed to confirm:", error);
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
    }
  };

  // Handle exit
  const handleExit = async () => {
    if (duel?._id) {
      await stopDuel({ duelId: duel._id });
    }
    router.push("/");
  };

  // Format time as MM:SS
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  // Timer color
  const getTimerColor = () => {
    if (!timeRemaining || !confirmedDuration) return "text-white";
    const percentage = timeRemaining / confirmedDuration;
    if (percentage > 0.5) return "text-green-400";
    if (percentage > 0.17) return "text-yellow-400";
    return "text-red-400";
  };

  // Loading states
  if (!duelData || !theme) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
      </div>
    );
  }

  // Timer selection phase (before both confirm)
  if (!bothConfirmed) {
    return (
      <main className="min-h-screen bg-gray-900 flex flex-col items-center justify-center p-4">
        {/* Exit Button */}
        <button
          onClick={handleExit}
          className="absolute top-4 right-4 bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-4 rounded"
        >
          Exit
        </button>

        <div className="max-w-lg w-full text-center">
          <h1 className="text-2xl font-bold text-gray-300 mb-2">{theme.name}</h1>
          <p className="text-gray-400 mb-2">
            {challenger?.name} vs {opponent?.name}
          </p>
          <p className="text-gray-500 mb-8">Select study time together</p>

          {/* Timer Selection with dual indicators */}
          <div className="flex flex-wrap justify-center gap-3 mb-8">
            {TIMER_OPTIONS.map((option) => {
              const challengerSelected = timerSelection?.challengerSelection === option;
              const opponentSelected = timerSelection?.opponentSelection === option;
              const isMySelection = mySelection === option;

              return (
                <button
                  key={option}
                  onClick={() => handleSelectTimer(option)}
                  disabled={myConfirmed}
                  className={`relative px-6 py-3 rounded-xl font-bold text-lg transition-colors ${
                    isMySelection
                      ? "bg-blue-600 text-white"
                      : "bg-gray-800 text-gray-300 hover:bg-gray-700"
                  } ${myConfirmed ? "opacity-50 cursor-not-allowed" : ""}`}
                >
                  {formatTime(option)}
                  {/* Selection indicators */}
                  <div className="absolute -top-2 -right-2 flex gap-1">
                    {challengerSelected && (
                      <div className="w-4 h-4 rounded-full bg-green-500 border-2 border-gray-900" title={challenger?.name || "Challenger"} />
                    )}
                    {opponentSelected && (
                      <div className="w-4 h-4 rounded-full bg-blue-500 border-2 border-gray-900" title={opponent?.name || "Opponent"} />
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Player legend */}
          <div className="flex justify-center gap-6 mb-8 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full bg-green-500" />
              <span className="text-gray-400">{challenger?.name?.split(" ")[0] || "Challenger"}</span>
              {timerSelection?.challengerConfirmed && (
                <span className="text-green-400">✓</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full bg-blue-500" />
              <span className="text-gray-400">{opponent?.name?.split(" ")[0] || "Opponent"}</span>
              {timerSelection?.opponentConfirmed && (
                <span className="text-green-400">✓</span>
              )}
            </div>
          </div>

          {/* Word count info */}
          <p className="text-gray-500 mb-8">{theme.words.length} words to study</p>

          {/* Confirm Button */}
          {!myConfirmed ? (
            <button
              onClick={handleConfirm}
              className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-4 rounded-xl text-xl transition-colors mb-4"
            >
              Confirm Selection
            </button>
          ) : (
            <div className="w-full bg-gray-700 text-gray-300 font-bold py-4 rounded-xl text-xl mb-4">
              Waiting for {theirName?.split(" ")[0] || "opponent"}...
            </div>
          )}

          {/* Skip option */}
          <p className="text-gray-600 text-sm">
            Both players must confirm to start the timer
          </p>
        </div>
      </main>
    );
  }

  // Learning phase (timer running)
  return (
    <main className="min-h-screen bg-gray-900 flex flex-col">
      {/* Exit Button */}
      <button
        onClick={handleExit}
        className="absolute top-4 right-4 bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-4 rounded transition-colors"
      >
        Exit
      </button>

      {/* Header with Timer */}
      <header className="flex-shrink-0 pt-6 pb-4 px-4">
        <div className="max-w-md mx-auto text-center">
          <h1 className="text-xl font-bold text-gray-300 mb-2">{theme.name}</h1>
          <p className="text-gray-500 text-sm mb-2">
            {challenger?.name} vs {opponent?.name}
          </p>

          {/* Large Timer */}
          <div className={`text-6xl font-bold ${getTimerColor()} transition-colors`}>
            {timeRemaining !== null ? formatTime(timeRemaining) : "--:--"}
          </div>

          {/* Mode Toggle and Reset */}
          <div className="flex items-center justify-center gap-4 mt-4">
            <button
              onClick={() => setIsRevealed(!isRevealed)}
              className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
                isRevealed
                  ? "bg-green-600 text-white"
                  : "bg-gray-700 text-gray-300 hover:bg-gray-600"
              }`}
            >
              {isRevealed ? "Revealed" : "Testing"}
            </button>
            {!isRevealed && (
              <button
                onClick={resetAll}
                className="px-4 py-2 rounded-lg font-medium text-sm bg-gray-700 text-gray-300 hover:bg-gray-600 transition-colors"
              >
                Reset All
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Words List */}
      <div className="flex-1 overflow-y-auto px-4 pb-24">
        <div className="max-w-md mx-auto space-y-3">
          {theme.words.map((word, index) => {
            const wordKey = `${duelId}-${index}`;
            const state = getHintState(wordKey);
            const { revealedPositions } = state;
            const letters = word.answer.split("");
            const totalLetters = letters.filter((l) => l !== " ").length;
            const maxHints = Math.ceil(totalLetters / 3);
            const hintsRemaining = maxHints - state.hintCount;
            const isTTSDisabled = playingWordIndex !== null;
            const isThisPlaying = playingWordIndex === index;

            return (
              <div
                key={index}
                className="bg-gray-800 border border-gray-700 rounded-xl p-4"
              >
                <div className="flex items-center justify-between">
                  {/* Word & Answer Section */}
                  <div className="flex-1">
                    <div className="text-lg font-medium text-white mb-1">
                      {word.word}
                    </div>

                    {/* Answer - revealed or letter slots */}
                    {isRevealed ? (
                      <div className="text-lg font-bold text-green-400">
                        {word.answer}
                      </div>
                    ) : (
                      <div className="flex gap-1 flex-wrap">
                        {letters.map((letter, idx) =>
                          letter === " " ? (
                            <div key={idx} className="w-2" />
                          ) : (
                            <div
                              key={idx}
                              onClick={() =>
                                !revealedPositions.includes(idx) &&
                                hintsRemaining > 0 &&
                                revealLetter(wordKey, idx)
                              }
                              className={`w-5 h-6 flex items-end justify-center border-b-2 border-gray-500 ${
                                !revealedPositions.includes(idx) &&
                                hintsRemaining > 0
                                  ? "cursor-pointer hover:border-green-500"
                                  : ""
                              }`}
                            >
                              {revealedPositions.includes(idx) && (
                                <span className="text-base font-bold text-green-400">
                                  {letter.toUpperCase()}
                                </span>
                              )}
                            </div>
                          )
                        )}
                      </div>
                    )}
                  </div>

                  {/* Buttons Section */}
                  <div className="flex gap-2 items-center ml-4">
                    {/* Testing mode buttons */}
                    {!isRevealed && (
                      <>
                        <div
                          className={`w-8 h-8 rounded-full border-2 flex items-center justify-center text-sm font-bold ${
                            hintsRemaining > 0
                              ? "border-gray-500 text-gray-400"
                              : "border-gray-700 text-gray-600"
                          }`}
                        >
                          {hintsRemaining > 0 ? hintsRemaining : "–"}
                        </div>

                        <button
                          onClick={() => resetWord(wordKey)}
                          className="w-10 h-10 rounded-lg bg-gray-700 text-gray-300 hover:bg-gray-600 flex items-center justify-center transition-colors"
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            fill="none"
                            viewBox="0 0 24 24"
                            strokeWidth={2}
                            stroke="currentColor"
                            className="w-5 h-5"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99"
                            />
                          </svg>
                        </button>

                        <button
                          onClick={() => revealFullWord(wordKey, word.answer)}
                          className="w-10 h-10 rounded-lg bg-gray-700 text-gray-300 hover:bg-gray-600 flex items-center justify-center transition-colors"
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            fill="none"
                            viewBox="0 0 24 24"
                            strokeWidth={2}
                            stroke="currentColor"
                            className="w-5 h-5"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z"
                            />
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                            />
                          </svg>
                        </button>
                      </>
                    )}

                    {/* TTS Button */}
                    <button
                      onClick={() => playTTS(index, word.answer)}
                      disabled={isTTSDisabled}
                      className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${
                        isThisPlaying
                          ? "bg-green-500 text-white"
                          : isTTSDisabled
                          ? "bg-gray-800 text-gray-600 cursor-not-allowed"
                          : "bg-gray-700 text-gray-300 hover:bg-gray-600"
                      }`}
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                        strokeWidth={2}
                        stroke="currentColor"
                        className="w-6 h-6"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M19.114 5.636a9 9 0 010 12.728M16.463 8.288a5.25 5.25 0 010 7.424M6.75 8.25l4.72-4.72a.75.75 0 011.28.53v15.88a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.01 9.01 0 012.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75z"
                        />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Fixed Bottom Button */}
      <div className="fixed bottom-0 left-0 right-0 bg-gray-900 border-t border-gray-700 p-4">
        <div className="max-w-md mx-auto">
          <button
            onClick={handleSkip}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-xl text-lg transition-colors"
          >
            Skip to Challenge →
          </button>
        </div>
      </div>
    </main>
  );
}
