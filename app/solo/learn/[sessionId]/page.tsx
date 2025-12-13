"use client";

import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useState, useEffect, useRef } from "react";
import { Id } from "@/convex/_generated/dataModel";

// State for each word: hintCount and revealedPositions
interface HintState {
  hintCount: number;
  revealedPositions: number[];
}

const DEFAULT_DURATION = 300; // 5 minutes default
const TIMER_OPTIONS = [60, 120, 180, 240, 300, 420, 600, 900]; // 1, 2, 3, 4, 5, 7, 10, 15 min

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

  // Hint states (like study page)
  const [hintStates, setHintStates] = useState<Record<string, HintState>>({});
  const [isRevealed, setIsRevealed] = useState(true); // Start with revealed mode

  // TTS state
  const [playingWordIndex, setPlayingWordIndex] = useState<number | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Session-only word order (array of original indices)
  const [wordOrder, setWordOrder] = useState<number[] | null>(null);

  // Initialize word order when theme loads
  useEffect(() => {
    if (theme && wordOrder === null) {
      setWordOrder(theme.words.map((_, i) => i));
    }
  }, [theme, wordOrder]);

  // Smooth gap drag-and-drop state
  const [draggedOrderIdx, setDraggedOrderIdx] = useState<number | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [dropIndex, setDropIndex] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Map<number, HTMLDivElement | null>>(new Map());
  const dragOffset = useRef({ x: 0, y: 0 });

  // Confidence level per word (0-3), keyed by wordKey
  const [confidenceLevels, setConfidenceLevels] = useState<Record<string, number>>({});

  const getConfidence = (wordKey: string): number => {
    return confidenceLevels[wordKey] ?? 0;
  };

  const setConfidence = (wordKey: string, level: number) => {
    setConfidenceLevels((prev) => ({ ...prev, [wordKey]: level }));
  };

  // Get color for confidence level slider
  const getConfidenceColor = (level: number) => {
    switch (level) {
      case 0:
        return { bg: "bg-white", track: "#ffffff", thumb: "#ffffff" };
      case 1:
        return { bg: "bg-green-500", track: "#22c55e", thumb: "#22c55e" };
      case 2:
        return { bg: "bg-orange-500", track: "#f97316", thumb: "#f97316" };
      case 3:
        return { bg: "bg-red-500", track: "#ef4444", thumb: "#ef4444" };
      default:
        return { bg: "bg-white", track: "#ffffff", thumb: "#ffffff" };
    }
  };

  // Handle mouse down to start drag
  const handleMouseDown = (e: React.MouseEvent, orderIdx: number) => {
    // Don't start drag if clicking on interactive elements
    const target = e.target as HTMLElement;
    if (target.closest('button') || target.closest('input')) return;

    const rect = e.currentTarget.getBoundingClientRect();
    dragOffset.current = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
    setDraggedOrderIdx(orderIdx);
    setMousePos({ x: e.clientX, y: e.clientY });
  };

  // Mouse move and mouse up handlers
  useEffect(() => {
    if (draggedOrderIdx === null || !wordOrder) return;

    const handleMouseMove = (e: MouseEvent) => {
      setMousePos({ x: e.clientX, y: e.clientY });

      // Calculate drop position based on mouse Y (using actual element heights)
      if (containerRef.current) {
        const containerRect = containerRef.current.getBoundingClientRect();
        const relativeY = e.clientY - containerRect.top;
        const gap = isRevealed ? 8 : 12; // space-y-2 = 8px, space-y-3 = 12px

        let newDropIndex = 0;
        let accumulatedHeight = 0;

        wordOrder.forEach((originalIdx, index) => {
          const itemEl = itemRefs.current.get(originalIdx);
          if (itemEl && index !== draggedOrderIdx) {
            const height = itemEl.offsetHeight + gap;
            if (relativeY > accumulatedHeight + height / 2) {
              newDropIndex = index + 1;
            }
            accumulatedHeight += height;
          } else if (index === draggedOrderIdx) {
            accumulatedHeight += gap; // Just the gap for dragged item
          }
        });

        setDropIndex(newDropIndex);
      }
    };

    const handleMouseUp = () => {
      if (draggedOrderIdx !== null && dropIndex !== null && wordOrder) {
        if (draggedOrderIdx !== dropIndex) {
          const newOrder = [...wordOrder];
          const [removed] = newOrder.splice(draggedOrderIdx, 1);
          const adjustedIndex = dropIndex > draggedOrderIdx ? dropIndex - 1 : dropIndex;
          newOrder.splice(adjustedIndex, 0, removed);
          setWordOrder(newOrder);
        }
      }
      setDraggedOrderIdx(null);
      setDropIndex(null);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [draggedOrderIdx, dropIndex, wordOrder, isRevealed]);

  // Calculate transform style for items during drag (matches reference exactly)
  const getItemStyle = (orderIdx: number, originalIndex: number): React.CSSProperties => {
    if (draggedOrderIdx === null || dropIndex === null || !wordOrder) return {};
    if (orderIdx === draggedOrderIdx) return {};

    // Get actual item height for accurate transforms
    const itemEl = itemRefs.current.get(originalIndex);
    const gap = isRevealed ? 8 : 12;
    const itemHeight = itemEl ? itemEl.offsetHeight + gap : 64 + gap;

    const adjustedDropIndex = dropIndex > draggedOrderIdx ? dropIndex - 1 : dropIndex;

    // Exact logic from reference code
    if (orderIdx >= adjustedDropIndex && draggedOrderIdx > orderIdx) {
      return {
        transform: `translateY(${itemHeight}px)`,
        transition: "transform 200ms cubic-bezier(0.2, 0, 0, 1)",
      };
    }
    if (orderIdx < adjustedDropIndex && draggedOrderIdx < orderIdx) {
      return {
        transform: `translateY(-${itemHeight}px)`,
        transition: "transform 200ms cubic-bezier(0.2, 0, 0, 1)",
      };
    }
    if (draggedOrderIdx < orderIdx && orderIdx <= adjustedDropIndex) {
      return {
        transform: `translateY(-${itemHeight}px)`,
        transition: "transform 200ms cubic-bezier(0.2, 0, 0, 1)",
      };
    }
    if (draggedOrderIdx > orderIdx && orderIdx >= adjustedDropIndex) {
      return {
        transform: `translateY(${itemHeight}px)`,
        transition: "transform 200ms cubic-bezier(0.2, 0, 0, 1)",
      };
    }

    return { transition: "transform 200ms cubic-bezier(0.2, 0, 0, 1)" };
  };

  // Hint functions
  const getHintState = (wordKey: string): HintState => {
    return hintStates[wordKey] || { hintCount: 0, revealedPositions: [] };
  };

  const revealLetter = (wordKey: string, position: number) => {
    setHintStates((prev) => {
      const current = prev[wordKey] || { hintCount: 0, revealedPositions: [] };

      if (current.revealedPositions.includes(position)) {
        return prev;
      }

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

  // Start timer when user clicks start (after adjusting timer)
  const handleStart = () => {
    setTimeRemaining(duration);
    setIsStarted(true);
  };

  // Countdown timer
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

  // Navigate when timer reaches 0
  useEffect(() => {
    if (timeRemaining === 0 && isStarted) {
      router.push(`/solo/${sessionId}?themeId=${themeId}`);
    }
  }, [timeRemaining, isStarted, router, sessionId, themeId]);

  // TTS function - blocks other TTS while playing
  const playTTS = async (wordIndex: number, spanishWord: string) => {
    // Block if any TTS is currently playing
    if (playingWordIndex !== null) return;

    setPlayingWordIndex(wordIndex);
    try {
      const response = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: spanishWord }),
      });

      if (!response.ok) {
        throw new Error("TTS request failed");
      }

      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);

      if (audioRef.current) {
        audioRef.current.pause();
      }

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

  // Skip to challenge
  const handleSkip = () => {
    const confidenceByWordIndex: Record<number, number> = {};
    theme?.words.forEach((_, wordIndex) => {
      const wordKey = `${themeId}-${wordIndex}`;
      confidenceByWordIndex[wordIndex] = getConfidence(wordKey);
    });

    const params = new URLSearchParams();
    if (themeId) params.set("themeId", themeId);
    params.set("confidence", JSON.stringify(confidenceByWordIndex));

    router.push(`/solo/${sessionId}?${params.toString()}`);
  };

  // Exit back to home
  const handleExit = () => {
    router.push("/");
  };

  // Timer color based on remaining time
  const getTimerColor = () => {
    const percentage = timeRemaining / duration;
    if (percentage > 0.5) return "text-green-400";
    if (percentage > 0.17) return "text-yellow-400";
    return "text-red-400";
  };

  // Format time as MM:SS
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  // Loading states
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

  // Pre-start screen - timer adjustment
  if (!isStarted) {
    return (
      <main className="min-h-screen bg-gray-900 flex flex-col items-center justify-center p-4">
        <div className="max-w-md w-full text-center">
          <h1 className="text-2xl font-bold text-gray-300 mb-2">{theme.name}</h1>
          <p className="text-gray-400 mb-8">Set your study time</p>

          {/* Timer Selection */}
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
                {formatTime(option)}
              </button>
            ))}
          </div>

          {/* Word count info */}
          <p className="text-gray-500 mb-8">{theme.words.length} words to study</p>

          {/* Start Button */}
          <button
            onClick={handleStart}
            className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-4 rounded-xl text-xl transition-colors mb-4"
          >
            Start Learning
          </button>

          {/* Back Button */}
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
          {/* Theme Name */}
          <h1 className="text-xl font-bold text-gray-300 mb-2">{theme.name}</h1>

          {/* Large Timer */}
          <div className={`text-6xl font-bold ${getTimerColor()} transition-colors`}>
            {formatTime(timeRemaining)}
          </div>

          {/* Mode Toggle and Reset */}
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
          {(wordOrder ?? []).map((originalIndex, orderIdx) => {
            const word = theme.words[originalIndex];
            const wordKey = `${themeId}-${originalIndex}`;
            const state = getHintState(wordKey);
            const { revealedPositions } = state;
            const letters = word.answer.split("");
            const totalLetters = letters.filter((l) => l !== " ").length;
            const maxHints = Math.ceil(totalLetters / 3);
            const hintsRemaining = maxHints - state.hintCount;
            const isTTSDisabled = playingWordIndex !== null;
            const isThisPlaying = playingWordIndex === originalIndex;
            const isDragging = draggedOrderIdx === orderIdx;

            return (
              <div
                key={originalIndex}
                ref={(el) => {
                  itemRefs.current.set(originalIndex, el);
                }}
                onMouseDown={(e) => handleMouseDown(e, orderIdx)}
                style={getItemStyle(orderIdx, originalIndex)}
                className={`bg-gray-800 border border-gray-700 rounded-xl ${
                  isRevealed ? "p-2.5" : "p-4"
                } cursor-grab active:cursor-grabbing select-none ${
                  isDragging ? "opacity-0" : ""
                }`}
              >
                <div className="flex items-stretch justify-between">
                  {/* Word & Answer Section */}
                  <div className="flex-1">
                    <div
                      className={`font-medium text-white ${
                        isRevealed ? "text-base mb-0.5 leading-tight" : "text-lg mb-1"
                      }`}
                    >
                      {word.word}
                    </div>

                    {/* Answer - revealed or letter slots */}
                    {isRevealed ? (
                      <div className="font-bold text-green-400 text-base leading-tight">
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
                  <div className={`flex items-center ${isRevealed ? "gap-1.5 ml-3" : "gap-2 ml-4"}`}>
                    {/* Confidence Slider - only in revealed mode */}
                    {isRevealed && (() => {
                      const confidence = getConfidence(wordKey);
                      const colors = getConfidenceColor(confidence);
                      return (
                        <div className="flex flex-col items-center h-12 mr-1.5">
                          <input
                            type="range"
                            min={0}
                            max={3}
                            step={1}
                            value={confidence}
                            onChange={(e) => setConfidence(wordKey, Number(e.target.value))}
                            className="h-10 w-4 appearance-none rounded-full cursor-pointer confidence-slider"
                            style={{
                              writingMode: "vertical-lr",
                              direction: "rtl",
                              background: `linear-gradient(to top, ${colors.track} ${(confidence / 3) * 100}%, #374151 ${(confidence / 3) * 100}%)`,
                              // @ts-expect-error CSS custom property
                              "--thumb-color": colors.thumb,
                            }}
                          />
                          <span className={`text-xs font-bold mt-1 ${confidence === 0 ? "text-gray-400" : confidence === 1 ? "text-green-400" : confidence === 2 ? "text-orange-400" : "text-red-400"}`}>
                            {confidence}
                          </span>
                        </div>
                      );
                    })()}

                    {/* Testing mode buttons */}
                    {!isRevealed && (
                      <>
                        {/* Hints Remaining */}
                        <div
                          className={`w-8 h-8 rounded-full border-2 flex items-center justify-center text-sm font-bold ${
                            hintsRemaining > 0
                              ? "border-gray-500 text-gray-400"
                              : "border-gray-700 text-gray-600"
                          }`}
                        >
                          {hintsRemaining > 0 ? hintsRemaining : "–"}
                        </div>

                        {/* Reset Button */}
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

                        {/* Reveal Full Word Button */}
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

                    {/* TTS Button - disabled when any TTS is playing */}
                    <button
                      onClick={() => playTTS(originalIndex, word.answer)}
                      disabled={isTTSDisabled}
                      className={`${isRevealed ? "w-10 h-10" : "w-12 h-12"} rounded-full flex items-center justify-center transition-colors ${
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
                        className={isRevealed ? "w-5 h-5" : "w-6 h-6"}
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

      {/* Floating dragged card */}
      {draggedOrderIdx !== null && wordOrder && theme && (
        <div
          className="fixed pointer-events-none z-50"
          style={{
            left: mousePos.x - dragOffset.current.x,
            top: mousePos.y - dragOffset.current.y,
            width: containerRef.current?.offsetWidth,
          }}
        >
          {(() => {
            const originalIndex = wordOrder[draggedOrderIdx];
            const word = theme.words[originalIndex];
            const wordKey = `${themeId}-${originalIndex}`;
            const isTTSDisabled = playingWordIndex !== null;
            const isThisPlaying = playingWordIndex === originalIndex;

            return (
              <div
                className={`bg-gray-800 border-2 border-blue-500 rounded-xl ${
                  isRevealed ? "p-2.5" : "p-4"
                } shadow-2xl shadow-blue-500/20`}
              >
                <div className="flex items-stretch justify-between">
                  {/* Word & Answer Section */}
                  <div className="flex-1">
                    <div
                      className={`font-medium text-white ${
                        isRevealed ? "text-base mb-0.5 leading-tight" : "text-lg mb-1"
                      }`}
                    >
                      {word.word}
                    </div>
                    {isRevealed && (
                      <div className="font-bold text-green-400 text-base leading-tight">
                        {word.answer}
                      </div>
                    )}
                  </div>

                  {/* Buttons Section (simplified for drag preview) */}
                  <div className={`flex items-center ${isRevealed ? "gap-1.5 ml-3" : "gap-2 ml-4"}`}>
                    {isRevealed && (() => {
                      const confidence = getConfidence(wordKey);
                      const colors = getConfidenceColor(confidence);
                      return (
                        <div className="flex flex-col items-center h-12 mr-1.5">
                          <input
                            type="range"
                            min={0}
                            max={3}
                            step={1}
                            value={confidence}
                            readOnly
                            className="h-10 w-4 appearance-none rounded-full confidence-slider"
                            style={{
                              writingMode: "vertical-lr",
                              direction: "rtl",
                              background: `linear-gradient(to top, ${colors.track} ${(confidence / 3) * 100}%, #374151 ${(confidence / 3) * 100}%)`,
                              // @ts-expect-error CSS custom property
                              "--thumb-color": colors.thumb,
                            }}
                          />
                          <span className={`text-xs font-bold mt-1 ${confidence === 0 ? "text-gray-400" : confidence === 1 ? "text-green-400" : confidence === 2 ? "text-orange-400" : "text-red-400"}`}>
                            {confidence}
                          </span>
                        </div>
                      );
                    })()}
                    <div
                      className={`${isRevealed ? "w-10 h-10" : "w-12 h-12"} rounded-full flex items-center justify-center ${
                        isThisPlaying
                          ? "bg-green-500 text-white"
                          : isTTSDisabled
                          ? "bg-gray-800 text-gray-600"
                          : "bg-gray-700 text-gray-300"
                      }`}
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                        strokeWidth={2}
                        stroke="currentColor"
                        className={isRevealed ? "w-5 h-5" : "w-6 h-6"}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M19.114 5.636a9 9 0 010 12.728M16.463 8.288a5.25 5.25 0 010 7.424M6.75 8.25l4.72-4.72a.75.75 0 011.28.53v15.88a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.01 9.01 0 012.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75z"
                        />
                      </svg>
                    </div>
                  </div>
                </div>
              </div>
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
