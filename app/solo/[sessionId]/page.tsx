"use client";

import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { Id } from "@/convex/_generated/dataModel";

// Normalize accented characters for comparison (í→i, ü→u, ñ→n, etc.)
const normalizeAccents = (str: string): string => {
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Remove diacritical marks
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
};

// Types
interface WordEntry {
  word: string;
  answer: string;
  wrongAnswers: string[];
}

interface WordState {
  wordIndex: number;
  currentLevel: 1 | 2 | 3;
  completedLevel3: boolean;
  answeredLevel2Plus: boolean;
}

interface SessionState {
  initialized: boolean;
  activePool: number[];
  remainingPool: number[];
  wordStates: Map<number, WordState>;
  lastQuestionIndex: number | null;
  currentWordIndex: number | null;
  currentLevel: 1 | 2 | 3;
  level2Mode: "typing" | "multiple_choice";
  questionsAnswered: number;
  correctAnswers: number;
}

// Level 1 Component - Guided Typing with letter slots
function Level1Input({
  answer,
  onCorrect,
  onSkip,
}: {
  answer: string;
  onCorrect: () => void;
  onSkip: () => void;
}) {
  const [typedLetters, setTypedLetters] = useState<string[]>([]);
  const [revealedPositions, setRevealedPositions] = useState<Set<number>>(new Set());
  const [cursorPosition, setCursorPosition] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Parse answer into letter slots (excluding spaces)
  const letterSlots = useMemo(() => {
    const slots: { char: string; originalIndex: number }[] = [];
    answer.split("").forEach((char, idx) => {
      if (char !== " ") {
        slots.push({ char: char.toLowerCase(), originalIndex: idx });
      }
    });
    return slots;
  }, [answer]);

  // Check if all letters are filled correctly (with or without hints = success)
  // Use accent-normalized comparison
  useEffect(() => {
    const allFilled = letterSlots.every((slot, idx) => {
      const typedChar = normalizeAccents(typedLetters[idx] || "");
      const expectedChar = normalizeAccents(slot.char);
      return typedChar === expectedChar;
    });
    
    if (allFilled && typedLetters.length >= letterSlots.length) {
      // All letters correct - count as success regardless of hints used
      onCorrect();
    }
  }, [typedLetters, letterSlots, onCorrect]);

  // Focus on container click
  const handleContainerClick = () => {
    inputRef.current?.focus();
  };

  // Handle keyboard input
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Backspace") {
      e.preventDefault();
      if (cursorPosition > 0) {
        const newTyped = [...typedLetters];
        newTyped.splice(cursorPosition - 1, 1);
        setTypedLetters(newTyped);
        setCursorPosition(cursorPosition - 1);
      }
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      if (cursorPosition > 0) {
        setCursorPosition(cursorPosition - 1);
      }
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      if (cursorPosition < typedLetters.length) {
        setCursorPosition(cursorPosition + 1);
      }
    } else if (e.key.length === 1 && /[a-zA-ZáéíóúüñÁÉÍÓÚÜÑ]/.test(e.key)) {
      e.preventDefault();
      if (cursorPosition < letterSlots.length) {
        const newTyped = [...typedLetters];
        // Insert at cursor position
        if (cursorPosition < newTyped.length) {
          newTyped[cursorPosition] = e.key;
        } else {
          newTyped.push(e.key);
        }
        setTypedLetters(newTyped);
        setCursorPosition(Math.min(cursorPosition + 1, letterSlots.length));
      }
    }
  };

  // Handle double-click on slot to position cursor
  const handleSlotDoubleClick = (slotIndex: number) => {
    setCursorPosition(slotIndex);
    inputRef.current?.focus();
  };

  // Reveal hint for a specific position
  const revealHint = (slotIndex: number) => {
    if (!revealedPositions.has(slotIndex)) {
      const newRevealed = new Set([...revealedPositions, slotIndex]);
      setRevealedPositions(newRevealed);
      
      // Also set the typed letter to the correct one
      const newTyped = [...typedLetters];
      while (newTyped.length <= slotIndex) {
        newTyped.push("");
      }
      newTyped[slotIndex] = letterSlots[slotIndex].char;
      setTypedLetters(newTyped);
      
      // Move cursor to next unfilled position
      let nextUnfilled = -1;
      for (let i = 0; i < letterSlots.length; i++) {
        const isRevealed = newRevealed.has(i);
        const hasTyped = newTyped[i] && newTyped[i].toLowerCase() === letterSlots[i].char;
        if (!isRevealed && !hasTyped) {
          nextUnfilled = i;
          break;
        }
      }
      
      if (nextUnfilled !== -1) {
        setCursorPosition(nextUnfilled);
      }
    }
  };

  // Render with word grouping (spaces between words) - visual gaps
  const renderSlots = () => {
    const elements: JSX.Element[] = [];
    let currentWordSlots: JSX.Element[] = [];
    let lastOriginalIndex = -1;

    letterSlots.forEach((slot, slotIdx) => {
      // Check if there's a space gap (new word)
      if (lastOriginalIndex !== -1 && slot.originalIndex - lastOriginalIndex > 1) {
        // Push current word group
        if (currentWordSlots.length > 0) {
          elements.push(
            <div key={`word-${elements.length}`} className="flex gap-1">
              {currentWordSlots}
            </div>
          );
          currentWordSlots = [];
        }
        // Add visible spacer with gap indicator
        elements.push(
          <div key={`space-${slotIdx}`} className="w-8 flex items-end justify-center pb-2">
            <span className="text-gray-600 text-lg">•</span>
          </div>
        );
      }

      const typedChar = typedLetters[slotIdx] || "";
      const isRevealed = revealedPositions.has(slotIdx);
      const isCorrect = normalizeAccents(typedChar) === normalizeAccents(slot.char);
      const isCursor = cursorPosition === slotIdx;

      let letterColor = "text-gray-400"; // empty
      if (isRevealed) {
        letterColor = "text-white";
      } else if (typedChar) {
        letterColor = isCorrect ? "text-green-400" : "text-red-400";
      }

      currentWordSlots.push(
        <div key={slotIdx} className="flex flex-col items-center">
          {/* Hint button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              revealHint(slotIdx);
            }}
            disabled={isRevealed}
            className={`text-xs px-1.5 py-0.5 rounded mb-1 transition-colors ${
              isRevealed
                ? "bg-gray-600 text-gray-500 cursor-not-allowed"
                : "bg-gray-700 text-gray-300 hover:bg-gray-600"
            }`}
          >
            H
          </button>
          {/* Letter slot */}
          <div
            onDoubleClick={() => handleSlotDoubleClick(slotIdx)}
            className={`w-8 h-10 flex items-center justify-center border-b-2 ${
              isCursor ? "border-blue-400" : "border-gray-500"
            } cursor-text`}
          >
            <span className={`text-xl font-bold ${letterColor}`}>
              {isRevealed ? slot.char.toUpperCase() : typedChar.toUpperCase()}
            </span>
          </div>
        </div>
      );

      lastOriginalIndex = slot.originalIndex;
    });

    // Push remaining word
    if (currentWordSlots.length > 0) {
      elements.push(
        <div key={`word-${elements.length}`} className="flex gap-1">
          {currentWordSlots}
        </div>
      );
    }

    return elements;
  };

  return (
    <div className="flex flex-col items-center gap-4">
      <div
        ref={containerRef}
        onClick={handleContainerClick}
        className="flex flex-wrap gap-4 justify-center items-end p-4 bg-gray-800 rounded-lg cursor-text min-h-[120px]"
      >
        {renderSlots()}
        {/* Hidden input for keyboard capture */}
        <input
          ref={inputRef}
          type="text"
          className="absolute opacity-0 pointer-events-none"
          onKeyDown={handleKeyDown}
          autoFocus
        />
      </div>
      {/* Don't Know button */}
      <button
        onClick={onSkip}
        className="px-4 py-2 bg-gray-600 hover:bg-gray-500 text-gray-300 rounded-lg text-sm font-medium transition-colors"
      >
        Don't Know
      </button>
    </div>
  );
}

// Level 2 Typing Component - Dashes visible, no per-letter hints
function Level2TypingInput({
  answer,
  onCorrect,
  onWrong,
  onSkip,
}: {
  answer: string;
  onCorrect: () => void;
  onWrong: () => void;
  onSkip: () => void;
}) {
  const [inputValue, setInputValue] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = () => {
    setSubmitted(true);
    if (normalizeAccents(inputValue) === normalizeAccents(answer)) {
      onCorrect();
    } else {
      onWrong();
    }
  };

  // Count words and show structure
  const words = answer.split(" ");
  const hasMultipleWords = words.length > 1;

  // Show dashes grouped by words with clear spacing
  const renderDashes = () => {
    return words.map((word, wordIdx) => (
      <span key={wordIdx} className="inline-flex gap-1">
        {word.split("").map((_, charIdx) => (
          <span key={charIdx} className="text-gray-400">_</span>
        ))}
        {wordIdx < words.length - 1 && <span className="mx-3 text-gray-600">•</span>}
      </span>
    ));
  };

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="text-2xl font-mono tracking-widest flex flex-wrap justify-center">
        {renderDashes()}
      </div>
      <div className="text-sm text-gray-500">
        ({answer.length} characters{hasMultipleWords ? " including spaces" : ""})
      </div>
      {hasMultipleWords && (
        <div className="text-xs text-yellow-500/80">
          Include spaces between words
        </div>
      )}
      <input
        type="text"
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && !submitted && handleSubmit()}
        disabled={submitted}
        className="w-full max-w-xs px-4 py-3 text-lg text-center bg-gray-800 border-2 border-gray-600 rounded-lg focus:border-blue-500 focus:outline-none"
        placeholder="Type your answer..."
        autoFocus
      />
      {!submitted && (
        <div className="flex gap-3">
          <button
            onClick={handleSubmit}
            disabled={!inputValue.trim()}
            className="px-6 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg font-medium transition-colors"
          >
            Submit
          </button>
          <button
            onClick={onSkip}
            className="px-4 py-2 bg-gray-600 hover:bg-gray-500 text-gray-300 rounded-lg text-sm font-medium transition-colors"
          >
            Don't Know
          </button>
        </div>
      )}
      {submitted && normalizeAccents(inputValue) !== normalizeAccents(answer) && (
        <div className="text-red-400">
          Wrong! The answer was: <span className="font-bold">{answer}</span>
        </div>
      )}
    </div>
  );
}

// Level 2 Multiple Choice Component - No "None of the above"
function Level2MultipleChoice({
  answer,
  wrongAnswers,
  onCorrect,
  onWrong,
  onSkip,
}: {
  answer: string;
  wrongAnswers: string[];
  onCorrect: () => void;
  onWrong: () => void;
  onSkip: () => void;
}) {
  const [selectedIndex, setSelectedIndex] = useState<number>(0);
  const [submitted, setSubmitted] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Shuffle options: 4 wrong + 1 correct
  const options = useMemo(() => {
    const shuffledWrong = [...wrongAnswers].sort(() => Math.random() - 0.5).slice(0, 4);
    return [answer, ...shuffledWrong].sort(() => Math.random() - 0.5);
  }, [answer, wrongAnswers]);

  const selectedAnswer = options[selectedIndex];

  // Use ref to track current selectedIndex for keyboard handler
  const selectedIndexRef = useRef(selectedIndex);
  selectedIndexRef.current = selectedIndex;

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (submitted) return;
      
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % options.length);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + options.length) % options.length);
      } else if (e.key === "Enter") {
        e.preventDefault();
        const currentAnswer = options[selectedIndexRef.current];
        setSubmitted(true);
        // Defer callback to avoid setState during render
        setTimeout(() => {
          if (currentAnswer === answer) {
            onCorrect();
          } else {
            onWrong();
          }
        }, 0);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [submitted, options, answer, onCorrect, onWrong]);

  const handleSelect = (idx: number) => {
    if (submitted) return;
    setSelectedIndex(idx);
  };

  const handleSubmit = () => {
    if (submitted) return;
    setSubmitted(true);
    if (selectedAnswer === answer) {
      onCorrect();
    } else {
      onWrong();
    }
  };

  // Focus container on mount for keyboard events
  useEffect(() => {
    containerRef.current?.focus();
  }, []);

  return (
    <div 
      ref={containerRef}
      tabIndex={0}
      className="flex flex-col items-center gap-4 w-full max-w-md outline-none"
    >
      <div className="grid grid-cols-1 gap-3 w-full">
        {options.map((option, idx) => {
          const isSelected = selectedIndex === idx;
          const isCorrect = option === answer;
          const showResult = submitted;

          let buttonClass = "border-gray-600 bg-gray-800 hover:border-gray-500";
          if (showResult) {
            if (isCorrect) {
              buttonClass = "border-green-500 bg-green-500/20 text-green-400";
            } else if (isSelected && !isCorrect) {
              buttonClass = "border-red-500 bg-red-500/20 text-red-400";
            } else {
              buttonClass = "border-gray-600 bg-gray-800 opacity-50";
            }
          } else if (isSelected) {
            buttonClass = "border-blue-500 bg-blue-500/20 text-blue-400";
          }

          return (
            <button
              key={idx}
              onClick={() => handleSelect(idx)}
              disabled={submitted}
              className={`p-4 rounded-lg border-2 text-lg font-medium transition-all ${buttonClass}`}
            >
              {option}
            </button>
          );
        })}
      </div>
      <div className="text-xs text-gray-500">↑↓ to navigate, Enter to confirm</div>
      {!submitted && (
        <div className="flex gap-3">
          <button
            onClick={handleSubmit}
            className="px-6 py-2 bg-green-600 hover:bg-green-700 rounded-lg font-medium transition-colors"
          >
            Confirm
          </button>
          <button
            onClick={onSkip}
            className="px-4 py-2 bg-gray-600 hover:bg-gray-500 text-gray-300 rounded-lg text-sm font-medium transition-colors"
          >
            Don't Know
          </button>
        </div>
      )}
      {submitted && selectedAnswer !== answer && (
        <div className="text-center text-gray-400 mt-2">
          Correct answer: <span className="font-bold text-green-400">{answer}</span>
        </div>
      )}
    </div>
  );
}

// Level 3 Component - Pure text input, no hints, with TTS option on correct
function Level3Input({
  answer,
  onCorrect,
  onWrong,
  onSkip,
}: {
  answer: string;
  onCorrect: () => void;
  onWrong: () => void;
  onSkip: () => void;
}) {
  const [inputValue, setInputValue] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [isCorrectAnswer, setIsCorrectAnswer] = useState(false);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [selectedOption, setSelectedOption] = useState<"listen" | "continue">("continue");
  const [canNavigate, setCanNavigate] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  
  const hasMultipleWords = answer.split(" ").length > 1;

  const handleSubmit = () => {
    setSubmitted(true);
    if (normalizeAccents(inputValue) === normalizeAccents(answer)) {
      setIsCorrectAnswer(true);
      // Small delay before allowing keyboard navigation to prevent Enter from triggering Listen
      setTimeout(() => setCanNavigate(true), 100);
    } else {
      onWrong();
    }
  };

  // Play TTS for the answer
  const handlePlayAudio = async () => {
    if (isPlayingAudio) return;
    
    setIsPlayingAudio(true);
    try {
      const response = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: answer }),
      });
      
      if (!response.ok) {
        throw new Error('TTS request failed');
      }
      
      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);
      
      if (audioRef.current) {
        audioRef.current.pause();
      }
      
      const audio = new Audio(audioUrl);
      audioRef.current = audio;
      
      audio.onended = () => {
        setIsPlayingAudio(false);
        URL.revokeObjectURL(audioUrl);
        // Return to selection - user can listen again or continue
      };
      
      audio.onerror = () => {
        setIsPlayingAudio(false);
        URL.revokeObjectURL(audioUrl);
      };
      
      await audio.play();
    } catch (error) {
      console.error('Failed to play audio:', error);
      setIsPlayingAudio(false);
    }
  };

  const handleContinue = () => {
    onCorrect();
  };

  // Keyboard navigation for Listen/Continue selection
  useEffect(() => {
    const shouldListen = isCorrectAnswer && !isPlayingAudio && canNavigate;
    if (!shouldListen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
        e.preventDefault();
        setSelectedOption((prev) => (prev === "listen" ? "continue" : "listen"));
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (selectedOption === "listen") {
          handlePlayAudio();
        } else {
          handleContinue();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  });

  return (
    <div className="flex flex-col items-center gap-4">
      {hasMultipleWords && !submitted && (
        <div className="text-xs text-yellow-500/80">
          Include spaces between words
        </div>
      )}
      <input
        type="text"
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && !submitted && handleSubmit()}
        disabled={submitted}
        className="w-full max-w-xs px-4 py-3 text-lg text-center bg-gray-800 border-2 border-gray-600 rounded-lg focus:border-blue-500 focus:outline-none"
        placeholder="Type your answer..."
        autoFocus
      />
      {!submitted && (
        <div className="flex gap-3">
          <button
            onClick={handleSubmit}
            disabled={!inputValue.trim()}
            className="px-6 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg font-medium transition-colors"
          >
            Submit
          </button>
          <button
            onClick={onSkip}
            className="px-4 py-2 bg-gray-600 hover:bg-gray-500 text-gray-300 rounded-lg text-sm font-medium transition-colors"
          >
            Don't Know
          </button>
        </div>
      )}
      {/* Show correct answer feedback with Listen/Continue options */}
      {submitted && isCorrectAnswer && (
        <div className="flex flex-col items-center gap-3">
          <div className="text-green-400 text-xl font-bold">✓ Correct!</div>
          <div className="flex gap-3">
            <button
              onClick={handlePlayAudio}
              disabled={isPlayingAudio}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg border-2 font-medium transition-all ${
                isPlayingAudio
                  ? 'border-green-500 bg-green-500/20 text-green-400 cursor-not-allowed'
                  : selectedOption === "listen"
                    ? 'border-blue-500 bg-blue-500/20 text-blue-400'
                    : 'border-gray-600 bg-gray-800 hover:border-gray-500'
              }`}
            >
              <span className="text-xl">{isPlayingAudio ? '🔊' : '🔈'}</span>
              <span>{isPlayingAudio ? 'Playing...' : 'Listen'}</span>
            </button>
            <button
              onClick={handleContinue}
              disabled={isPlayingAudio}
              className={`px-4 py-2 rounded-lg border-2 font-medium transition-all disabled:opacity-50 ${
                selectedOption === "continue"
                  ? 'border-blue-500 bg-blue-500/20 text-blue-400'
                  : 'border-gray-600 bg-gray-800 hover:border-gray-500'
              }`}
            >
              Continue →
            </button>
          </div>
          <div className="text-xs text-gray-500">← → to select, Enter to confirm</div>
        </div>
      )}
      {submitted && !isCorrectAnswer && (
        <div className="text-red-400">
          Wrong! The answer was: <span className="font-bold">{answer}</span>
        </div>
      )}
    </div>
  );
}

// Completion Screen Component
function CompletionScreen({
  questionsAnswered,
  correctAnswers,
  totalWords,
  onExit,
}: {
  questionsAnswered: number;
  correctAnswers: number;
  totalWords: number;
  onExit: () => void;
}) {
  const accuracy = questionsAnswered > 0 ? Math.round((correctAnswers / questionsAnswered) * 100) : 0;

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4">
      <div className="bg-gray-800 rounded-xl p-8 max-w-md w-full text-center border-2 border-green-500">
        <div className="text-4xl mb-4">🎉</div>
        <h1 className="text-2xl font-bold text-green-400 mb-6">Challenge Complete!</h1>
        
        <div className="space-y-4 mb-8">
          <div className="bg-gray-900 rounded-lg p-4">
            <div className="text-gray-400 text-sm">Words Mastered</div>
            <div className="text-3xl font-bold text-white">{totalWords}</div>
          </div>
          
          <div className="bg-gray-900 rounded-lg p-4">
            <div className="text-gray-400 text-sm">Questions Answered</div>
            <div className="text-3xl font-bold text-white">{questionsAnswered}</div>
          </div>
          
          <div className="bg-gray-900 rounded-lg p-4">
            <div className="text-gray-400 text-sm">Accuracy</div>
            <div className={`text-3xl font-bold ${accuracy >= 70 ? "text-green-400" : accuracy >= 50 ? "text-yellow-400" : "text-red-400"}`}>
              {accuracy}%
            </div>
          </div>
        </div>

        <button
          onClick={onExit}
          className="w-full bg-blue-500 hover:bg-blue-600 text-white font-bold py-3 px-6 rounded-lg text-lg transition-colors"
        >
          Back to Home
        </button>
      </div>
    </div>
  );
}

// Main Solo Challenge Page
export default function SoloChallengePage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const themeId = searchParams.get("themeId");

  // Fetch theme data
  const theme = useQuery(
    api.themes.getTheme,
    themeId ? { themeId: themeId as Id<"themes"> } : "skip"
  );

  // Session state
  const [session, setSession] = useState<SessionState>({
    initialized: false,
    activePool: [],
    remainingPool: [],
    wordStates: new Map(),
    lastQuestionIndex: null,
    currentWordIndex: null,
    currentLevel: 1,
    level2Mode: "typing",
    questionsAnswered: 0,
    correctAnswers: 0,
  });

  const [showFeedback, setShowFeedback] = useState(false);
  const [feedbackCorrect, setFeedbackCorrect] = useState(false);
  const [feedbackAnswer, setFeedbackAnswer] = useState<string | null>(null);
  const [isComplete, setIsComplete] = useState(false);

  // Initialize session when theme loads
  useEffect(() => {
    if (theme && !session.initialized) {
      const words = theme.words;
      const totalWords = words.length;
      
      // Initial pool: 40% rounded down, minimum 1
      const initialPoolSize = Math.max(1, Math.floor(totalWords * 0.4));
      
      // Shuffle all indices
      const allIndices = Array.from({ length: totalWords }, (_, i) => i);
      const shuffled = [...allIndices].sort(() => Math.random() - 0.5);
      
      const activePool = shuffled.slice(0, initialPoolSize);
      const remainingPool = shuffled.slice(initialPoolSize);
      
      // Initialize word states
      const wordStates = new Map<number, WordState>();
      allIndices.forEach((idx) => {
        wordStates.set(idx, {
          wordIndex: idx,
          currentLevel: 1,
          completedLevel3: false,
          answeredLevel2Plus: false,
        });
      });

      // Pick first question
      const firstWordIndex = activePool[Math.floor(Math.random() * activePool.length)];
      const firstLevel = Math.random() < 0.66 ? 1 : 2;
      const firstLevel2Mode = Math.random() < 0.5 ? "typing" : "multiple_choice";

      setSession({
        initialized: true,
        activePool,
        remainingPool,
        wordStates,
        lastQuestionIndex: null,
        currentWordIndex: firstWordIndex,
        currentLevel: firstLevel as 1 | 2 | 3,
        level2Mode: firstLevel2Mode,
        questionsAnswered: 0,
        correctAnswers: 0,
      });
    }
  }, [theme, session.initialized]);

  // Select next question - uses setSession callback to always read latest state
  const selectNextQuestion = useCallback(() => {
    setSession((prev) => {
      const { activePool, wordStates, lastQuestionIndex, remainingPool } = prev;
      
      // Check pool expansion: 65%+ of active pool has answeredLevel2Plus (slower expansion)
      const level2PlusCount = activePool.filter(
        (idx) => wordStates.get(idx)?.answeredLevel2Plus
      ).length;
      const shouldExpand = level2PlusCount >= Math.ceil(activePool.length * 0.65) && remainingPool.length > 0;

      let newActivePool = [...activePool];
      let newRemainingPool = [...remainingPool];

      if (shouldExpand) {
        // Add up to 2 random words from remaining (slower expansion)
        const toAdd = Math.min(2, remainingPool.length);
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
        // Defer setIsComplete to avoid setState during render
        setTimeout(() => setIsComplete(true), 0);
        return prev;
      }

      // Pick random word, avoiding last question if possible
      let candidates = incompleteWords.filter((idx) => idx !== lastQuestionIndex);
      if (candidates.length === 0) {
        candidates = incompleteWords;
      }
      const nextWordIndex = candidates[Math.floor(Math.random() * candidates.length)];

      // Determine level based on word state
      const wordState = wordStates.get(nextWordIndex)!;
      let nextLevel: 1 | 2 | 3;

      if (wordState.currentLevel === 1) {
        // First time or still at level 1: 66% level 1, 33% level 2
        nextLevel = Math.random() < 0.66 ? 1 : 2;
      } else if (wordState.currentLevel === 2) {
        // At level 2: 66% level 2, 33% level 3
        nextLevel = Math.random() < 0.66 ? 2 : 3;
      } else {
        // At level 3
        nextLevel = 3;
      }

      const nextLevel2Mode = Math.random() < 0.5 ? "typing" : "multiple_choice";

      return {
        ...prev,
        activePool: newActivePool,
        remainingPool: newRemainingPool,
        currentWordIndex: nextWordIndex,
        currentLevel: nextLevel,
        level2Mode: nextLevel2Mode,
        lastQuestionIndex: nextWordIndex,
      };
    });
    setShowFeedback(false);
    setFeedbackAnswer(null);
  }, []);

  // Handle correct answer
  const handleCorrect = useCallback(() => {
    setFeedbackCorrect(true);
    setShowFeedback(true);
    setFeedbackAnswer(null);

    setSession((prev) => {
      const newWordStates = new Map(prev.wordStates);
      const wordState = newWordStates.get(prev.currentWordIndex!)!;

      // Progress level
      let newLevel = wordState.currentLevel;
      let completedLevel3 = wordState.completedLevel3;
      let answeredLevel2Plus = wordState.answeredLevel2Plus;

      if (prev.currentLevel === 1) {
        // After correct at L1: 66% L2, 33% L3
        newLevel = Math.random() < 0.66 ? 2 : 3;
      } else if (prev.currentLevel === 2) {
        newLevel = 3;
        answeredLevel2Plus = true;
      } else if (prev.currentLevel === 3) {
        completedLevel3 = true;
        answeredLevel2Plus = true;
      }

      newWordStates.set(prev.currentWordIndex!, {
        ...wordState,
        currentLevel: newLevel as 1 | 2 | 3,
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

  // Handle wrong answer - drop level by 1 if possible
  const handleWrong = useCallback(() => {
    if (!theme || session.currentWordIndex === null) return;
    
    const currentWord = theme.words[session.currentWordIndex];
    setFeedbackCorrect(false);
    setShowFeedback(true);
    setFeedbackAnswer(currentWord.answer);

    setSession((prev) => {
      const newWordStates = new Map(prev.wordStates);
      const wordState = newWordStates.get(prev.currentWordIndex!)!;

      // Lower level by 1 if possible
      let newLevel = wordState.currentLevel;
      if (newLevel > 1) {
        newLevel = (newLevel - 1) as 1 | 2 | 3;
      }

      newWordStates.set(prev.currentWordIndex!, {
        ...wordState,
        currentLevel: newLevel,
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
  }, [selectNextQuestion, theme, session.currentWordIndex]);

  // Handle skip/don't know - lower level by 1 if possible, show answer
  const handleSkip = useCallback(() => {
    if (!theme || session.currentWordIndex === null) return;
    
    const currentWord = theme.words[session.currentWordIndex];
    setFeedbackCorrect(false);
    setShowFeedback(true);
    setFeedbackAnswer(currentWord.answer);

    setSession((prev) => {
      const newWordStates = new Map(prev.wordStates);
      const wordState = newWordStates.get(prev.currentWordIndex!)!;

      // Lower level by 1 if possible
      let newLevel = wordState.currentLevel;
      if (newLevel > 1) {
        newLevel = (newLevel - 1) as 1 | 2 | 3;
      }
      // If already level 1, stay at level 1 (will be shown answer and returned to pool)

      newWordStates.set(prev.currentWordIndex!, {
        ...wordState,
        currentLevel: newLevel,
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
  }, [selectNextQuestion, theme, session.currentWordIndex]);

  // Handle exit
  const handleExit = () => {
    router.push("/");
  };

  // Loading states
  if (!themeId) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-red-400">No theme selected</div>
      </div>
    );
  }

  if (!theme) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
      </div>
    );
  }

  if (!session.initialized || session.currentWordIndex === null) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
      </div>
    );
  }

  // Completion screen
  if (isComplete) {
    return (
      <CompletionScreen
        questionsAnswered={session.questionsAnswered}
        correctAnswers={session.correctAnswers}
        totalWords={theme.words.length}
        onExit={handleExit}
      />
    );
  }

  const currentWord = theme.words[session.currentWordIndex];
  const masteredCount = Array.from(session.wordStates.values()).filter(
    (ws) => ws.completedLevel3
  ).length;

  // Level indicator colors
  const levelColors = {
    1: "text-green-400 bg-green-500/20 border-green-500",
    2: "text-yellow-400 bg-yellow-500/20 border-yellow-500",
    3: "text-red-400 bg-red-500/20 border-red-500",
  };

  return (
    <main className="min-h-screen flex flex-col items-center p-4 relative">
      {/* Exit Button */}
      <button
        onClick={handleExit}
        className="absolute top-4 right-4 bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-4 rounded"
      >
        Exit Challenge
      </button>

      {/* Progress Header */}
      <div className="w-full max-w-md mb-8 mt-16">
        <div className="text-center mb-4">
          <h1 className="text-xl font-bold text-gray-300">{theme.name}</h1>
        </div>
        
        {/* Progress bar */}
        <div className="bg-gray-700 rounded-full h-4 mb-2">
          <div
            className="bg-green-500 rounded-full h-4 transition-all duration-300"
            style={{ width: `${(masteredCount / theme.words.length) * 100}%` }}
          />
        </div>
        <div className="flex justify-between text-sm text-gray-400">
          <span>{masteredCount} / {theme.words.length} words mastered</span>
          <span>Pool: {session.activePool.length} active</span>
        </div>
      </div>

      {/* Question Card */}
      <div className="w-full max-w-md bg-gray-800/50 rounded-xl p-6 border border-gray-700">
        {/* Level indicator */}
        <div className="flex justify-center mb-4">
          <span className={`inline-block px-3 py-1 rounded-full border text-sm font-medium ${levelColors[session.currentLevel]}`}>
            Level {session.currentLevel}
          </span>
        </div>

        {/* Word to translate */}
        <div className="text-center mb-6">
          <div className="text-3xl font-bold text-white mb-2">{currentWord.word}</div>
          <div className="text-sm text-gray-400">Translate to Spanish</div>
        </div>

        {/* Feedback overlay */}
        {showFeedback && (
          <div className={`text-center py-4 mb-4 rounded-lg ${feedbackCorrect ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"}`}>
            <div className="text-2xl font-bold mb-2">
              {feedbackCorrect ? "✓ Correct!" : "✗ Wrong"}
            </div>
            {feedbackAnswer && (
              <div className="text-lg">
                Answer: <span className="font-bold text-white">{feedbackAnswer}</span>
              </div>
            )}
          </div>
        )}

        {/* Input based on level */}
        {!showFeedback && (
          <>
            {session.currentLevel === 1 && (
              <Level1Input
                key={`${session.currentWordIndex}-${session.questionsAnswered}`}
                answer={currentWord.answer}
                onCorrect={handleCorrect}
                onSkip={handleSkip}
              />
            )}

            {session.currentLevel === 2 && session.level2Mode === "typing" && (
              <Level2TypingInput
                key={`${session.currentWordIndex}-${session.questionsAnswered}`}
                answer={currentWord.answer}
                onCorrect={handleCorrect}
                onWrong={handleWrong}
                onSkip={handleSkip}
              />
            )}

            {session.currentLevel === 2 && session.level2Mode === "multiple_choice" && (
              <Level2MultipleChoice
                key={`${session.currentWordIndex}-${session.questionsAnswered}`}
                answer={currentWord.answer}
                wrongAnswers={currentWord.wrongAnswers}
                onCorrect={handleCorrect}
                onWrong={handleWrong}
                onSkip={handleSkip}
              />
            )}

            {session.currentLevel === 3 && (
              <Level3Input
                key={`${session.currentWordIndex}-${session.questionsAnswered}`}
                answer={currentWord.answer}
                onCorrect={handleCorrect}
                onWrong={handleWrong}
                onSkip={handleSkip}
              />
            )}
          </>
        )}
      </div>

      {/* Stats footer */}
      <div className="mt-8 text-center text-gray-500 text-sm">
        Questions: {session.questionsAnswered} | Correct: {session.correctAnswers}
      </div>
    </main>
  );
}
