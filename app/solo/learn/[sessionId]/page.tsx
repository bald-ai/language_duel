"use client";

import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useState, useEffect, useRef } from "react";
import { Id } from "@/convex/_generated/dataModel";
import { TIMER_OPTIONS } from "@/lib/constants";
import { formatDuration } from "@/lib/stringUtils";
import { WordCard } from "./components";
import { useDraggableList } from "./hooks/useDraggableList";
import { DEFAULT_DURATION, LAYOUT, TIMER_THRESHOLDS } from "./constants";
import { LETTERS_PER_HINT } from "@/app/game/constants";

// State for each word: hintCount and revealedPositions
interface HintState {
  hintCount: number;
  revealedPositions: number[];
}

export default function LearnPhasePage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionId = params.sessionId as string;
  const themeId = searchParams.get("themeId");

  // Fetch theme data
  const theme = useQuery(
    api.themes.getTheme,
    themeId ? { themeId: themeId as Id<"themes"> } : "skip"
  );

  // Timer state
  const [duration, setDuration] = useState(DEFAULT_DURATION);
  const [timeRemaining, setTimeRemaining] = useState(DEFAULT_DURATION);
  const [isStarted, setIsStarted] = useState(false);

  // Hint states
  const [hintStates, setHintStates] = useState<Record<string, HintState>>({});
  const [isRevealed, setIsRevealed] = useState(true);

  // TTS state
  const [playingWordIndex, setPlayingWordIndex] = useState<number | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Confidence level per word
  const [confidenceLevels, setConfidenceLevels] = useState<Record<string, number>>({});
  const [isConfidenceLegendDismissed, setIsConfidenceLegendDismissed] = useState(false);

  // Initialize word order when theme loads
  const initialOrder = theme?.words.map((_, i) => i) ?? null;
  const gap = isRevealed ? LAYOUT.GAP_REVEALED : LAYOUT.GAP_TESTING;

  const {
    order: wordOrder,
    dragState,
    containerRef,
    itemRefs,
    dragOffset,
    handleMouseDown,
    getItemStyle,
  } = useDraggableList<number>(initialOrder, {
    itemCount: theme?.words.length ?? 0,
    gap,
  });

  const confidenceLegendStorageKey = `soloLearnConfidenceLegendDismissed:${sessionId}:${themeId ?? "no-theme"}`;

  useEffect(() => {
    try {
      setIsConfidenceLegendDismissed(sessionStorage.getItem(confidenceLegendStorageKey) === "1");
    } catch {
      // ignore
    }
  }, [confidenceLegendStorageKey]);

  // --- Helper functions ---
  const getConfidence = (wordKey: string): number => confidenceLevels[wordKey] ?? 0;

  const setConfidence = (wordKey: string, level: number) => {
    setConfidenceLevels((prev) => ({ ...prev, [wordKey]: level }));
  };

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

  const resetAll = () => setHintStates({});

  // --- Timer logic ---
  const handleStart = () => {
    setTimeRemaining(duration);
    setIsStarted(true);
  };

  useEffect(() => {
    if (!isStarted) return;
    const interval = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [isStarted]);

  useEffect(() => {
    if (timeRemaining === 0 && isStarted) {
      router.push(`/solo/${sessionId}?themeId=${themeId}`);
    }
  }, [timeRemaining, isStarted, router, sessionId, themeId]);

  // --- TTS ---
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

  // --- Navigation ---
  const handleSkip = () => {
    const confidenceByWordIndex: Record<number, number> = {};
    theme?.words.forEach((_, wordIndex) => {
      const wordKey = `${themeId}-${wordIndex}`;
      confidenceByWordIndex[wordIndex] = getConfidence(wordKey);
    });

    const urlParams = new URLSearchParams();
    if (themeId) urlParams.set("themeId", themeId);
    urlParams.set("confidence", JSON.stringify(confidenceByWordIndex));

    router.push(`/solo/${sessionId}?${urlParams.toString()}`);
  };

  const handleExit = () => router.push("/");

  // --- Timer display ---
  const getTimerColor = () => {
    const percentage = timeRemaining / duration;
    if (percentage > TIMER_THRESHOLDS.GREEN) return "text-green-400";
    if (percentage > TIMER_THRESHOLDS.YELLOW) return "text-yellow-400";
    return "text-red-400";
  };


  // --- Loading states ---
  if (!themeId) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-red-400">No theme selected</div>
      </div>
    );
  }

  if (!theme) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
      </div>
    );
  }

  // --- Pre-start screen ---
  if (!isStarted) {
    return (
      <main className="min-h-screen bg-gray-900 flex flex-col items-center justify-center p-4">
        <div className="max-w-md w-full text-center">
          <h1 className="text-2xl font-bold text-gray-300 mb-2">{theme.name}</h1>
          <p className="text-gray-400 mb-8">Set your study time</p>

          <div className="flex flex-wrap justify-center gap-3 mb-8">
            {TIMER_OPTIONS.map((option) => (
              <button
                key={option}
                onClick={() => setDuration(option)}
                className={`px-6 py-3 rounded-xl font-bold text-lg transition-colors ${
                  duration === option
                    ? "bg-blue-600 text-white"
                    : "bg-gray-800 text-gray-300 hover:bg-gray-700"
                }`}
              >
                {formatDuration(option)}
              </button>
            ))}
          </div>

          <p className="text-gray-500 mb-8">{theme.words.length} words to study</p>

          <button
            onClick={handleStart}
            className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-4 rounded-xl text-xl transition-colors mb-4"
          >
            Start Learning
          </button>

          <button
            onClick={handleExit}
            className="w-full bg-gray-700 hover:bg-gray-600 text-gray-300 font-bold py-3 rounded-xl transition-colors"
          >
            Back to Home
          </button>
        </div>
      </main>
    );
  }

  // --- Main learning UI ---
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
          <div className={`text-6xl font-bold ${getTimerColor()} transition-colors`}>
            {formatDuration(timeRemaining)}
          </div>

          <div className="flex items-center justify-center gap-4 mt-4">
            <button
              onClick={() => setIsRevealed(!isRevealed)}
              className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
                isRevealed
                  ? "bg-gray-700 text-gray-300 hover:bg-gray-600"
                  : "bg-green-600 text-white"
              }`}
            >
              {isRevealed ? "Testing" : "Reveal"}
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
        <div
          ref={containerRef}
          className={`max-w-md mx-auto relative ${isRevealed ? "space-y-2" : "space-y-3"}`}
        >
          {/* Confidence legend */}
          {!isConfidenceLegendDismissed && (
            <div className="sticky top-2 z-10 w-fit">
              <div className="rounded-xl border border-gray-700 bg-gray-900/80 px-3 py-2 backdrop-blur">
                <div className="flex items-center gap-2">
                  <div className="flex h-2 w-20 overflow-hidden rounded-full">
                    <div className="flex-1 bg-gray-600" />
                    <div className="flex-1 bg-green-500" />
                    <div className="flex-1 bg-orange-400" />
                    <div className="flex-1 bg-red-500" />
                  </div>
                  <div className="text-[11px] leading-tight text-gray-300">
                    Confidence sets the starting challenge level (0 quick check → 3 no hints).
                  </div>
                  <button
                    type="button"
                    aria-label="Dismiss confidence legend"
                    onClick={() => {
                      setIsConfidenceLegendDismissed(true);
                      try {
                        sessionStorage.setItem(confidenceLegendStorageKey, "1");
                      } catch {
                        // ignore
                      }
                    }}
                    className="ml-1 inline-flex h-6 w-6 items-center justify-center rounded-full text-gray-400 hover:bg-white/5 hover:text-gray-200 transition-colors"
                  >
                    <span className="text-base leading-none">×</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {wordOrder.map((originalIndex, orderIdx) => {
            const word = theme.words[originalIndex];
            const wordKey = `${themeId}-${originalIndex}`;
            const state = getHintState(wordKey);
            const totalLetters = word.answer.split("").filter((l) => l !== " ").length;
            const maxHints = Math.ceil(totalLetters / LETTERS_PER_HINT);
            const hintsRemaining = maxHints - state.hintCount;

            return (
              <WordCard
                key={originalIndex}
                word={word}
                isRevealed={isRevealed}
                confidence={getConfidence(wordKey)}
                onConfidenceChange={(val) => setConfidence(wordKey, val)}
                revealedPositions={state.revealedPositions}
                hintsRemaining={hintsRemaining}
                onRevealLetter={(pos) => revealLetter(wordKey, pos)}
                onRevealFullWord={() => revealFullWord(wordKey, word.answer)}
                onResetWord={() => resetWord(wordKey)}
                isTTSPlaying={playingWordIndex === originalIndex}
                isTTSDisabled={playingWordIndex !== null}
                onPlayTTS={() => playTTS(originalIndex, word.answer)}
                isDragging={dragState.draggedIndex === orderIdx}
                onMouseDown={(e) => handleMouseDown(e, orderIdx)}
                style={getItemStyle(orderIdx, originalIndex)}
                refCallback={(el) => itemRefs.current.set(originalIndex, el)}
              />
            );
          })}
        </div>
      </div>

      {/* Floating dragged card */}
      {dragState.draggedIndex !== null && wordOrder.length > 0 && (
        <div
          className="fixed pointer-events-none z-50"
          style={{
            left: dragState.mousePos.x - dragOffset.current.x,
            top: dragState.mousePos.y - dragOffset.current.y,
            width: containerRef.current?.offsetWidth,
          }}
        >
          {(() => {
            const originalIndex = wordOrder[dragState.draggedIndex];
            const word = theme.words[originalIndex];
            const wordKey = `${themeId}-${originalIndex}`;
            const state = getHintState(wordKey);
            const totalLetters = word.answer.split("").filter((l) => l !== " ").length;
            const maxHints = Math.ceil(totalLetters / LETTERS_PER_HINT);
            const hintsRemaining = maxHints - state.hintCount;

            return (
              <WordCard
                word={word}
                isRevealed={isRevealed}
                confidence={getConfidence(wordKey)}
                onConfidenceChange={() => {}}
                revealedPositions={state.revealedPositions}
                hintsRemaining={hintsRemaining}
                onRevealLetter={() => {}}
                onRevealFullWord={() => {}}
                onResetWord={() => {}}
                isTTSPlaying={playingWordIndex === originalIndex}
                isTTSDisabled={playingWordIndex !== null}
                onPlayTTS={() => {}}
                isFloating
              />
            );
          })()}
        </div>
      )}

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
