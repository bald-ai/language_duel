"use client";

import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import type { JSX } from "react";
import type { Doc } from "@/convex/_generated/dataModel";

// Normalize accented characters for comparison
const normalizeAccents = (str: string): string => {
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
};

// Generate a shuffled anagram for a word/phrase (spaces are preserved by caller)
const generateAnagramLetters = (answer: string): string[] => {
  const letters = answer.replace(/\s+/g, "").split("");
  if (letters.length <= 1) return letters;

  const shuffle = (arr: string[]) => [...arr].sort(() => Math.random() - 0.5);
  let shuffled = shuffle(letters);
  let attempts = 0;
  while (shuffled.join("") === letters.join("") && attempts < 5) {
    shuffled = shuffle(letters);
    attempts += 1;
  }
  return shuffled;
};

// Insert shuffled letters back into their spaced layout
const buildAnagramWithSpaces = (answer: string, shuffledLetters: string[]): string => {
  const withSpaces: string[] = [];
  let idx = 0;
  answer.split("").forEach((char) => {
    if (char === " ") {
      withSpaces.push(" ");
    } else {
      withSpaces.push(shuffledLetters[idx] || "");
      idx += 1;
    }
  });
  return withSpaces.join("");
};

// Types
interface WordEntry {
  word: string;
  answer: string;
  wrongAnswers: string[];
}

// Sabotage Effect Type
type SabotageEffect = "ink" | "bubbles" | "emojis" | "sticky" | "cards";

const SABOTAGE_DURATION = 7000;
const MAX_SABOTAGES = 5;

const SABOTAGE_OPTIONS: { effect: SabotageEffect; label: string; emoji: string }[] = [
  { effect: "ink", label: "Ink", emoji: "🖤" },
  { effect: "bubbles", label: "Bubbles", emoji: "🫧" },
  { effect: "emojis", label: "Emojis", emoji: "😈" },
  { effect: "sticky", label: "Sticky", emoji: "📝" },
  { effect: "cards", label: "Cards", emoji: "🃏" },
];

// ============= Sabotage Effect Components =============
function InkSplatter({ phase }: { phase: "wind-up" | "full" | "wind-down" }) {
  const splatters = useMemo(
    () =>
      Array.from({ length: 25 }, (_, i) => ({
        id: i,
        top: 5 + Math.random() * 90,
        left: 2 + Math.random() * 96,
        scale: 1.5 + Math.random() * 2.5,
        delay: Math.random() * 1.5,
        rotation: Math.random() * 360,
      })),
    []
  );

  const opacity = phase === "wind-up" ? 0.4 : phase === "wind-down" ? 0.2 : 1;

  return (
    <div
      className="fixed inset-0 pointer-events-none z-40 transition-opacity duration-700"
      style={{ opacity }}
    >
      {splatters.map((splatter) => (
        <div
          key={splatter.id}
          className="absolute w-20 h-20 bg-black rounded-full"
          style={{
            top: `${splatter.top}%`,
            left: `${splatter.left}%`,
            transform: `scale(${splatter.scale}) rotate(${splatter.rotation}deg)`,
            filter: "blur(2px)",
          }}
        />
      ))}
    </div>
  );
}

function FloatingBubbles({ phase }: { phase: "wind-up" | "full" | "wind-down" }) {
  const bubbles = useMemo(
    () =>
      Array.from({ length: 40 }, (_, i) => ({
        id: i,
        left: Math.random() * 100,
        size: 40 + Math.random() * 80,
        duration: 2 + Math.random() * 2,
        delay: Math.random() * 2,
      })),
    []
  );

  const opacity = phase === "wind-up" ? 0.4 : phase === "wind-down" ? 0.3 : 0.9;

  return (
    <div
      className="fixed inset-0 pointer-events-none overflow-hidden z-40 transition-opacity duration-500"
      style={{ opacity }}
    >
      {bubbles.map((bubble) => (
        <div
          key={bubble.id}
          className="absolute rounded-full border-2 border-blue-300 bg-blue-200/30"
          style={{
            left: `${bubble.left}%`,
            bottom: "-100px",
            width: bubble.size,
            height: bubble.size,
            animation: `float-up ${bubble.duration}s linear infinite`,
            animationDelay: `${bubble.delay}s`,
          }}
        />
      ))}
      <style jsx>{`
        @keyframes float-up {
          0% { transform: translateY(0); }
          100% { transform: translateY(-120vh); }
        }
      `}</style>
    </div>
  );
}

function FallingEmojis({ phase }: { phase: "wind-up" | "full" | "wind-down" }) {
  const emojis = useMemo(() => {
    const emojiList = ["💀", "👻", "🔥", "💣", "⚡", "🌀", "👀", "😈"];
    return Array.from({ length: 50 }, (_, i) => ({
      id: i,
      emoji: emojiList[Math.floor(Math.random() * emojiList.length)],
      left: Math.random() * 100,
      duration: 1.5 + Math.random() * 1.5,
      delay: Math.random() * 2,
      size: 30 + Math.random() * 40,
    }));
  }, []);

  const opacity = phase === "wind-up" ? 0.5 : phase === "wind-down" ? 0.3 : 1;

  return (
    <div
      className="fixed inset-0 pointer-events-none overflow-hidden z-40 transition-opacity duration-500"
      style={{ opacity }}
    >
      {emojis.map((item) => (
        <div
          key={item.id}
          className="absolute"
          style={{
            left: `${item.left}%`,
            top: "-50px",
            fontSize: item.size,
            animation: `fall-down ${item.duration}s linear infinite`,
            animationDelay: `${item.delay}s`,
          }}
        >
          {item.emoji}
        </div>
      ))}
      <style jsx>{`
        @keyframes fall-down {
          0% { transform: translateY(0) rotate(0deg); }
          100% { transform: translateY(120vh) rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

function StickyNotes({ phase }: { phase: "wind-up" | "full" | "wind-down" }) {
  const notes = useMemo(
    () =>
      Array.from({ length: 15 }, (_, i) => ({
        id: i,
        top: 5 + Math.random() * 80,
        left: 5 + Math.random() * 80,
        rotation: -20 + Math.random() * 40,
        color: ["#fff740", "#ff7eb9", "#7afcff", "#feff9c"][Math.floor(Math.random() * 4)],
        text: ["LOL", "Oops!", "Nope!", "Ha!", "???", "RIP"][Math.floor(Math.random() * 6)],
      })),
    []
  );

  const opacity = phase === "wind-up" ? 0.5 : phase === "wind-down" ? 0.3 : 1;

  return (
    <div
      className="fixed inset-0 pointer-events-none z-40 transition-opacity duration-700"
      style={{ opacity }}
    >
      {notes.map((note) => (
        <div
          key={note.id}
          className="absolute w-24 h-24 shadow-lg flex items-center justify-center text-black font-bold text-lg"
          style={{
            top: `${note.top}%`,
            left: `${note.left}%`,
            backgroundColor: note.color,
            transform: `rotate(${note.rotation}deg)`,
          }}
        >
          {note.text}
        </div>
      ))}
    </div>
  );
}

function FlyingCards({ phase }: { phase: "wind-up" | "full" | "wind-down" }) {
  const cards = useMemo(() => {
    const suits = ["♠", "♥", "♦", "♣"];
    const values = ["A", "K", "Q", "J"];
    return Array.from({ length: 30 }, (_, i) => ({
      id: i,
      suit: suits[Math.floor(Math.random() * 4)],
      value: values[Math.floor(Math.random() * 4)],
      startY: Math.random() * 100,
      duration: 1 + Math.random() * 1,
      delay: Math.random() * 2,
      fromLeft: Math.random() > 0.5,
    }));
  }, []);

  const opacity = phase === "wind-up" ? 0.5 : phase === "wind-down" ? 0.3 : 1;

  return (
    <div
      className="fixed inset-0 pointer-events-none overflow-hidden z-40 transition-opacity duration-500"
      style={{ opacity }}
    >
      {cards.map((card) => (
        <div
          key={card.id}
          className="absolute bg-white rounded-lg shadow-xl w-12 h-16 flex flex-col items-center justify-center"
          style={{
            top: `${card.startY}%`,
            left: card.fromLeft ? "-50px" : "auto",
            right: card.fromLeft ? "auto" : "-50px",
            animation: `fly-${card.fromLeft ? "right" : "left"} ${card.duration}s linear infinite`,
            animationDelay: `${card.delay}s`,
          }}
        >
          <span className={card.suit === "♥" || card.suit === "♦" ? "text-red-600" : "text-black"}>
            {card.value}
            {card.suit}
          </span>
        </div>
      ))}
      <style jsx>{`
        @keyframes fly-right {
          0% { transform: translateX(0) rotate(0deg); }
          100% { transform: translateX(120vw) rotate(360deg); }
        }
        @keyframes fly-left {
          0% { transform: translateX(0) rotate(0deg); }
          100% { transform: translateX(-120vw) rotate(-360deg); }
        }
      `}</style>
    </div>
  );
}

function SabotageRenderer({ effect, phase }: { effect: SabotageEffect | null; phase: "wind-up" | "full" | "wind-down" }) {
  if (!effect) return null;
  switch (effect) {
    case "ink": return <InkSplatter phase={phase} />;
    case "bubbles": return <FloatingBubbles phase={phase} />;
    case "emojis": return <FallingEmojis phase={phase} />;
    case "sticky": return <StickyNotes phase={phase} />;
    case "cards": return <FlyingCards phase={phase} />;
    default: return null;
  }
}

// ============= Hint Selector Component =============
type HintOption = {
  id: string;
  label: string;
  description: string;
  icon: string;
};

// Global hints available on all levels
const GLOBAL_HINT_OPTIONS: HintOption[] = [
  { id: "flash", label: "Flash Answer", description: "Brief glimpse (0.5s)", icon: "⚡" },
  { id: "tts", label: "Play Sound", description: "Pronounce the word", icon: "🔊" },
];

// L1-specific hints (letters reveal only makes sense for typing)
const L1_HINT_OPTIONS: HintOption[] = [
  { id: "letters", label: "Reveal Letters", description: "Show up to 3 letters", icon: "🔤" },
  ...GLOBAL_HINT_OPTIONS,
];

// L2 multiple choice specific hints
const L2_MC_HINT_OPTIONS: HintOption[] = [
  { id: "eliminate", label: "Eliminate Options", description: "Remove 2 wrong answers", icon: "❌" },
  ...GLOBAL_HINT_OPTIONS,
];

// L2 typing and L3 only get global hints
const TYPING_HINT_OPTIONS: HintOption[] = [
  { id: "anagram", label: "Anagram", description: "Scrambled letters to rearrange", icon: "🔀" },
  ...GLOBAL_HINT_OPTIONS,
];

function HintSelector({
  requesterName,
  word,
  hintOptions,
  onSelectHint,
  onDismiss,
}: {
  requesterName: string;
  word: string;
  hintOptions: HintOption[];
  onSelectHint: (hintType: string) => void;
  onDismiss: () => void;
}) {
  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-gray-800 rounded-2xl p-6 max-w-sm w-full border border-purple-500/50 shadow-2xl shadow-purple-500/20 relative">
        {/* Close button */}
        <button
          onClick={onDismiss}
          className="absolute top-3 right-3 text-gray-400 hover:text-white text-xl w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-700"
        >
          ✕
        </button>
        
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-purple-500/20 rounded-full mb-3">
            <span className="text-2xl">🆘</span>
          </div>
          <h3 className="text-lg font-bold text-white mb-1">
            {requesterName} needs help!
          </h3>
          <p className="text-sm text-gray-400">
            Choose how to help with: <span className="text-purple-300 font-medium">{word}</span>
          </p>
        </div>
        <div className="space-y-3">
          {hintOptions.map((option) => (
            <button
              key={option.id}
              onClick={() => onSelectHint(option.id)}
              className="w-full p-4 rounded-xl border border-gray-600 bg-gray-700/50 hover:bg-purple-500/20 hover:border-purple-500 transition-all group"
            >
              <div className="flex items-center gap-4">
                <div className="text-3xl group-hover:scale-110 transition-transform">
                  {option.icon}
                </div>
                <div className="text-left">
                  <div className="font-semibold text-white group-hover:text-purple-300 transition-colors">
                    {option.label}
                  </div>
                  <div className="text-sm text-gray-400">
                    {option.description}
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>
        
        <button
          onClick={onDismiss}
          className="w-full mt-4 py-2 text-sm text-gray-500 hover:text-gray-300 transition-colors"
        >
          Maybe later
        </button>
      </div>
    </div>
  );
}

// ============= Level Input Components =============

// Level 1 - Guided typing with hints
function Level1Input({
  answer,
  onCorrect,
  onSkip,
  // Hint system props
  canRequestHint,
  hintRequested,
  hintAccepted,
  hintType,
  hintRevealedPositions,
  onRequestHint,
  onCancelHint,
  onUpdateHintState,
}: {
  answer: string;
  onCorrect: () => void;
  onSkip: () => void;
  // Hint system props
  canRequestHint?: boolean;
  hintRequested?: boolean;
  hintAccepted?: boolean;
  hintType?: string;
  hintRevealedPositions?: number[];
  onRequestHint?: (typedLetters: string[], revealedPositions: number[]) => void;
  onCancelHint?: () => void;
  onUpdateHintState?: (typedLetters: string[], revealedPositions: number[]) => void;
}) {
  const [typedLetters, setTypedLetters] = useState<string[]>([]);
  const [revealedPositions, setRevealedPositions] = useState<Set<number>>(new Set());
  const [cursorPosition, setCursorPosition] = useState(0);
  const [hasCompleted, setHasCompleted] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const letterSlots = useMemo(() => {
    const slots: { char: string; originalIndex: number }[] = [];
    answer.split("").forEach((char, idx) => {
      if (char !== " ") {
        slots.push({ char: char.toLowerCase(), originalIndex: idx });
      }
    });
    return slots;
  }, [answer]);

  // Check if answer is all filled and correct
  const isAnswerCorrect = letterSlots.every((slot, idx) => {
    const typedChar = normalizeAccents(typedLetters[idx] || "");
    const expectedChar = normalizeAccents(slot.char);
    return typedChar === expectedChar;
  }) && typedLetters.length >= letterSlots.length;

  // Manual confirm handler
  const handleConfirm = () => {
    if (hasCompleted) return;
    if (isAnswerCorrect) {
      setHasCompleted(true);
      onCorrect();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleConfirm();
    } else if (e.key === "Backspace") {
      e.preventDefault();
      if (cursorPosition > 0) {
        const newTyped = [...typedLetters];
        newTyped.splice(cursorPosition - 1, 1);
        setTypedLetters(newTyped);
        setCursorPosition(cursorPosition - 1);
      }
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      if (cursorPosition > 0) setCursorPosition(cursorPosition - 1);
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      if (cursorPosition < typedLetters.length) setCursorPosition(cursorPosition + 1);
    } else if (e.key.length === 1 && /[a-zA-ZáéíóúüñÁÉÍÓÚÜÑ]/.test(e.key)) {
      e.preventDefault();
      if (cursorPosition < letterSlots.length) {
        const newTyped = [...typedLetters];
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

  const revealHint = (slotIndex: number) => {
    setRevealedPositions((prev) => new Set([...prev, slotIndex]));
    setTypedLetters((prev) => {
      const newTyped = [...prev];
      while (newTyped.length <= slotIndex) newTyped.push("");
      newTyped[slotIndex] = letterSlots[slotIndex].char;
      return newTyped;
    });
  };

  // Apply hints received from opponent
  useEffect(() => {
    if (hintRevealedPositions && hintRevealedPositions.length > 0) {
      hintRevealedPositions.forEach((pos) => {
        if (!revealedPositions.has(pos)) {
          setRevealedPositions((prev) => new Set([...prev, pos]));
          setTypedLetters((prev) => {
            const newTyped = [...prev];
            while (newTyped.length <= pos) newTyped.push("");
            newTyped[pos] = letterSlots[pos]?.char || "";
            return newTyped;
          });
        }
      });
    }
  }, [hintRevealedPositions, letterSlots]);

  // Sync hint state when typing changes (if hint is requested)
  useEffect(() => {
    if (hintRequested && onUpdateHintState) {
      onUpdateHintState(typedLetters, Array.from(revealedPositions));
    }
  }, [typedLetters, revealedPositions, hintRequested, onUpdateHintState]);

  // Handle requesting hint
  const handleRequestHint = () => {
    if (onRequestHint) {
      onRequestHint(typedLetters, Array.from(revealedPositions));
    }
  };

  const renderSlots = () => {
    const elements: JSX.Element[] = [];
    let currentWordSlots: JSX.Element[] = [];
    let lastOriginalIndex = -1;

    letterSlots.forEach((slot, slotIdx) => {
      if (lastOriginalIndex !== -1 && slot.originalIndex - lastOriginalIndex > 1) {
        if (currentWordSlots.length > 0) {
          elements.push(<div key={`word-${elements.length}`} className="flex gap-1">{currentWordSlots}</div>);
          currentWordSlots = [];
        }
        elements.push(<div key={`space-${slotIdx}`} className="w-6 flex items-end justify-center pb-2"><span className="text-gray-600">•</span></div>);
      }

      const typedChar = typedLetters[slotIdx] || "";
      const isRevealed = revealedPositions.has(slotIdx);
      const isCorrect = normalizeAccents(typedChar) === normalizeAccents(slot.char);
      const isCursor = cursorPosition === slotIdx;

      let letterColor = "text-gray-400";
      if (isRevealed) letterColor = "text-white";
      else if (typedChar) letterColor = isCorrect ? "text-green-400" : "text-red-400";

      currentWordSlots.push(
        <div key={slotIdx} className="flex flex-col items-center">
          <button
            onClick={(e) => { e.stopPropagation(); revealHint(slotIdx); }}
            disabled={isRevealed}
            className={`text-xs px-1.5 py-0.5 rounded mb-1 ${isRevealed ? "bg-gray-600 text-gray-500" : "bg-gray-700 text-gray-300 hover:bg-gray-600"}`}
          >
            H
          </button>
          <div
            className={`w-8 h-10 flex items-center justify-center border-b-2 ${isCursor ? "border-blue-400" : "border-gray-500"}`}
          >
            <span className={`text-xl font-bold ${letterColor}`}>
              {isRevealed ? slot.char.toUpperCase() : typedChar.toUpperCase()}
            </span>
          </div>
        </div>
      );
      lastOriginalIndex = slot.originalIndex;
    });

    if (currentWordSlots.length > 0) {
      elements.push(<div key={`word-${elements.length}`} className="flex gap-1">{currentWordSlots}</div>);
    }
    return elements;
  };

  return (
    <div className="flex flex-col items-center gap-4">
      <div
        onClick={() => inputRef.current?.focus()}
        className="flex flex-wrap gap-4 justify-center items-end p-4 bg-gray-800 rounded-lg cursor-text min-h-[120px]"
      >
        {renderSlots()}
        <input ref={inputRef} type="text" className="absolute opacity-0 pointer-events-none" onKeyDown={handleKeyDown} autoFocus />
      </div>
      
      {/* Hint System UI */}
      <div className="flex flex-col items-center gap-2">
        {/* Help button - request hint */}
        {canRequestHint && !hintRequested && (
          <button
            onClick={handleRequestHint}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-medium flex items-center gap-2"
          >
            <span>🆘</span> Ask for Help
          </button>
        )}
        
        {/* Waiting for hint acceptance */}
        {hintRequested && !hintAccepted && (
          <div className="flex flex-col items-center gap-2">
            <div className="text-purple-400 text-sm animate-pulse">
              Waiting for opponent to help...
            </div>
            {onRequestHint && (
              <button
                onClick={handleRequestHint}
                className="px-3 py-1 bg-purple-600 hover:bg-purple-700 text-white rounded text-xs"
              >
                Request another hint
              </button>
            )}
            <button
              onClick={onCancelHint}
              className="px-3 py-1 bg-gray-600 hover:bg-gray-500 text-gray-300 rounded text-xs"
            >
              Cancel
            </button>
          </div>
        )}
        
        {/* Hint accepted - receiving hints (only show for letters type) */}
        {hintRequested && hintAccepted && hintType === "letters" && (
          <div className="flex flex-col items-center gap-2 text-purple-400 text-sm">
            <div>🎯 Opponent is giving you hints ({hintRevealedPositions?.length || 0}/3)</div>
            {onRequestHint && (
              <button
                onClick={handleRequestHint}
                className="px-3 py-1 bg-purple-600 hover:bg-purple-700 text-white rounded text-xs"
              >
                Request another hint
              </button>
            )}
          </div>
        )}
      </div>
      
      {/* Manual Confirm Button */}
      <button
        onClick={handleConfirm}
        disabled={!isAnswerCorrect || hasCompleted}
        className={`px-6 py-3 rounded-lg text-lg font-bold transition-colors ${
          isAnswerCorrect && !hasCompleted
            ? "bg-green-600 hover:bg-green-700 text-white"
            : "bg-gray-700 text-gray-500 cursor-not-allowed"
        }`}
      >
        ✓ Confirm Answer
      </button>
      
      <button onClick={onSkip} className="px-4 py-2 bg-gray-600 hover:bg-gray-500 text-gray-300 rounded-lg text-sm">
        Don't Know
      </button>
    </div>
  );
}

// HintGiverView - Shown to opponent when they accept hint request
function HintGiverView({
  word,
  answer,
  typedLetters,
  requesterRevealedPositions,
  hintRevealedPositions,
  hintsRemaining,
  onProvideHint,
  requesterName,
  onDismiss,
}: {
  word: string;
  answer: string;
  typedLetters: string[];
  requesterRevealedPositions: number[];
  hintRevealedPositions: number[];
  hintsRemaining: number;
  onProvideHint: (position: number) => void;
  requesterName: string;
  onDismiss: () => void;
}) {
  const letterSlots = useMemo(() => {
    const slots: { char: string; originalIndex: number }[] = [];
    answer.split("").forEach((char, idx) => {
      if (char !== " ") {
        slots.push({ char: char.toLowerCase(), originalIndex: idx });
      }
    });
    return slots;
  }, [answer]);

  const renderSlots = () => {
    const elements: JSX.Element[] = [];
    let currentWordSlots: JSX.Element[] = [];
    let lastOriginalIndex = -1;

    letterSlots.forEach((slot, slotIdx) => {
      if (lastOriginalIndex !== -1 && slot.originalIndex - lastOriginalIndex > 1) {
        if (currentWordSlots.length > 0) {
          elements.push(<div key={`word-${elements.length}`} className="flex gap-1">{currentWordSlots}</div>);
          currentWordSlots = [];
        }
        elements.push(<div key={`space-${slotIdx}`} className="w-6 flex items-end justify-center pb-2"><span className="text-gray-600">•</span></div>);
      }

      const typedChar = typedLetters[slotIdx] || "";
      const isRequesterRevealed = requesterRevealedPositions.includes(slotIdx);
      const isHintRevealed = hintRevealedPositions.includes(slotIdx);
      const isRevealed = isRequesterRevealed || isHintRevealed;
      const isCorrect = normalizeAccents(typedChar) === normalizeAccents(slot.char);
      
      // Can click to reveal if: not already revealed and hints remaining
      const canClick = !isRevealed && hintsRemaining > 0;

      let letterColor = "text-gray-400";
      if (isHintRevealed) letterColor = "text-purple-400"; // Hint we provided
      else if (isRequesterRevealed) letterColor = "text-white"; // Already revealed by requester
      else if (typedChar) letterColor = isCorrect ? "text-green-400" : "text-red-400";

      currentWordSlots.push(
        <div key={slotIdx} className="flex flex-col items-center">
          <button
            onClick={() => canClick && onProvideHint(slotIdx)}
            disabled={!canClick}
            className={`text-xs px-1.5 py-0.5 rounded mb-1 ${
              isHintRevealed 
                ? "bg-purple-600 text-white" 
                : isRequesterRevealed 
                  ? "bg-gray-600 text-gray-500" 
                  : canClick 
                    ? "bg-purple-700 text-purple-200 hover:bg-purple-600 cursor-pointer"
                    : "bg-gray-700 text-gray-500"
            }`}
          >
            {isHintRevealed ? "✓" : "H"}
          </button>
          <div
            className={`w-8 h-10 flex items-center justify-center border-b-2 ${
              canClick ? "border-purple-500 cursor-pointer" : "border-gray-500"
            }`}
            onClick={() => canClick && onProvideHint(slotIdx)}
          >
            <span className={`text-xl font-bold ${letterColor}`}>
              {isRevealed ? slot.char.toUpperCase() : typedChar.toUpperCase()}
            </span>
          </div>
        </div>
      );
      lastOriginalIndex = slot.originalIndex;
    });

    if (currentWordSlots.length > 0) {
      elements.push(<div key={`word-${elements.length}`} className="flex gap-1">{currentWordSlots}</div>);
    }
    return elements;
  };

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
      <div className="bg-gray-800 rounded-xl p-6 max-w-lg w-full border-2 border-purple-500">
        <div className="text-center mb-4">
          <div className="text-purple-400 text-sm font-medium mb-1">
            🆘 {requesterName} needs help!
          </div>
          <div className="text-3xl font-bold text-white mb-2">{word}</div>
          <div className="text-sm text-gray-400">Click on letters to reveal (up to 3)</div>
        </div>

        <div className="flex flex-wrap gap-4 justify-center items-end p-4 bg-gray-900 rounded-lg min-h-[120px] mb-4">
          {renderSlots()}
        </div>

        <div className="flex justify-center items-center gap-4">
          <div className="text-purple-400 font-medium">
            Hints remaining: {hintsRemaining}/3
          </div>
        </div>
        
        <button
          onClick={onDismiss}
          className="w-full mt-4 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg text-sm"
        >
          Minimize (continue your game)
        </button>
      </div>
    </div>
  );
}

// L2HintGiverView - Shown to opponent when they accept L2 multiple choice hint request
function L2HintGiverView({
  word,
  answer,
  options,
  eliminatedOptions,
  onEliminateOption,
  requesterName,
  onDismiss,
}: {
  word: string;
  answer: string;
  options: string[];
  eliminatedOptions: string[];
  onEliminateOption: (option: string) => void;
  requesterName: string;
  onDismiss: () => void;
}) {
  const eliminationsRemaining = 2 - eliminatedOptions.length;
  
  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
      <div className="bg-gray-800 rounded-xl p-6 max-w-lg w-full border-2 border-purple-500">
        <div className="text-center mb-4">
          <div className="text-purple-400 text-sm font-medium mb-1">
            🆘 {requesterName} needs help!
          </div>
          <div className="text-3xl font-bold text-white mb-2">{word}</div>
          <div className="text-sm text-gray-400">Click on 2 wrong options to eliminate them</div>
        </div>

        <div className="grid grid-cols-1 gap-3 w-full mb-4">
          {options.map((option, idx) => {
            const isCorrect = option === answer;
            const isEliminated = eliminatedOptions.includes(option);
            const canEliminate = !isCorrect && !isEliminated && eliminationsRemaining > 0;

            let buttonClass = "border-gray-600 bg-gray-800";
            if (isCorrect) {
              buttonClass = "border-green-500 bg-green-500/20 text-green-400 cursor-not-allowed";
            } else if (isEliminated) {
              buttonClass = "border-red-500 bg-red-500/20 text-red-400 line-through opacity-50";
            } else if (canEliminate) {
              buttonClass = "border-gray-600 bg-gray-800 hover:border-red-500 hover:bg-red-500/10 cursor-pointer";
            } else {
              buttonClass = "border-gray-600 bg-gray-800 opacity-50 cursor-not-allowed";
            }

            return (
              <button
                key={idx}
                onClick={() => canEliminate && onEliminateOption(option)}
                disabled={!canEliminate}
                className={`p-4 rounded-lg border-2 text-lg font-medium transition-all ${buttonClass}`}
              >
                {isCorrect && <span className="mr-2">✓</span>}
                {isEliminated && <span className="mr-2">✗</span>}
                {option}
              </button>
            );
          })}
        </div>

        <div className="flex justify-center items-center gap-4">
          <div className="text-purple-400 font-medium">
            Eliminations remaining: {eliminationsRemaining}/2
          </div>
        </div>
        
        <button
          onClick={onDismiss}
          className="w-full mt-4 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg text-sm"
        >
          Minimize (continue your game)
        </button>
      </div>
    </div>
  );
}

// Level 2 - Typing with dashes
function Level2TypingInput({
  answer,
  onCorrect,
  onWrong,
  onSkip,
  // Hint system props
  canRequestHint,
  hintRequested,
  hintAccepted,
  hintType,
  onRequestHint,
  onCancelHint,
}: {
  answer: string;
  onCorrect: () => void;
  onWrong: () => void;
  onSkip: () => void;
  // Hint system props
  canRequestHint?: boolean;
  hintRequested?: boolean;
  hintAccepted?: boolean;
  hintType?: string;
  onRequestHint?: () => void;
  onCancelHint?: () => void;
}) {
  const [inputValue, setInputValue] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [anagramLetters, setAnagramLetters] = useState<string[]>([]);
  const [anagramResult, setAnagramResult] = useState<"correct" | "wrong" | null>(null);
  const dragIndexRef = useRef<number | null>(null);

  const hintIsAnagram = hintAccepted && hintType === "anagram";

  const letterSlots = useMemo(() => {
    const slots: { char: string; originalIndex: number }[] = [];
    answer.split("").forEach((char, idx) => {
      if (char !== " ") {
        slots.push({ char: char.toLowerCase(), originalIndex: idx });
      }
    });
    return slots;
  }, [answer]);

  useEffect(() => {
    if (hintIsAnagram) {
      setAnagramLetters(generateAnagramLetters(answer));
    } else {
      setAnagramLetters([]);
    }
  }, [answer, hintIsAnagram]);

  const handleSubmit = () => {
    setSubmitted(true);
    setAnagramResult(null);
    if (normalizeAccents(inputValue) === normalizeAccents(answer)) {
      onCorrect();
    } else {
      onWrong();
    }
  };

  const handleSubmitAnagram = () => {
    const reconstructed = answer.split("");
    anagramLetters.forEach((char, idx) => {
      const slot = letterSlots[idx];
      if (slot) {
        reconstructed[slot.originalIndex] = char || "";
      }
    });
    const candidate = reconstructed.join("");
    const isCorrect = normalizeAccents(candidate) === normalizeAccents(answer);
    setSubmitted(true);
    setAnagramResult(isCorrect ? "correct" : "wrong");
    if (isCorrect) {
      onCorrect();
    } else {
      onWrong();
    }
  };

  const handleDragStart = (idx: number) => {
    if (submitted) return;
    dragIndexRef.current = idx;
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (idx: number) => {
    if (submitted) return;
    const from = dragIndexRef.current;
    if (from === null || from === idx) return;
    setAnagramLetters((prev) => {
      const next = [...prev];
      [next[from], next[idx]] = [next[idx], next[from]];
      return next;
    });
    dragIndexRef.current = null;
  };

  const handleDragEnd = () => {
    dragIndexRef.current = null;
  };

  const handleShuffleAnagram = () => {
    if (submitted) return;
    setAnagramLetters(generateAnagramLetters(answer));
  };

  const words = answer.split(" ");

  return (
    <div className="flex flex-col items-center gap-4">
      {hintIsAnagram ? (
        <>
          <div className="text-sm text-purple-300 text-center">
            Anagram hint: drag letters to rearrange them into the answer.
          </div>
          <div className="text-2xl font-mono tracking-widest flex flex-wrap justify-center">
            {words.map((word, wordIdx) => (
              <span key={wordIdx} className="inline-flex gap-1">
                {word.split("").map((_, charIdx) => (
                  <span key={charIdx} className="text-gray-400">_</span>
                ))}
                {wordIdx < words.length - 1 && <span className="mx-3 text-gray-600">•</span>}
              </span>
            ))}
          </div>
          <div className="flex flex-wrap gap-3 justify-center w-full">
            {anagramLetters.length === letterSlots.length ? (
              (() => {
                const elements: JSX.Element[] = [];
                let currentWord: JSX.Element[] = [];
                let lastIdx = -1;

                letterSlots.forEach((slot, idx) => {
                  const isNewWord = lastIdx >= 0 && slot.originalIndex > lastIdx + 1;
                  if (isNewWord && currentWord.length > 0) {
                    elements.push(
                      <div key={`word-${elements.length}`} className="flex gap-2">
                        {currentWord}
                      </div>
                    );
                    currentWord = [];
                  }

                  currentWord.push(
                    <div
                      key={`slot-${idx}`}
                      draggable={!submitted}
                      onDragStart={() => handleDragStart(idx)}
                      onDragOver={handleDragOver}
                      onDrop={(e) => {
                        e.preventDefault();
                        handleDrop(idx);
                      }}
                      onDragEnd={handleDragEnd}
                      className={`w-12 h-14 flex items-center justify-center rounded-lg border-2 bg-gray-800 text-white text-xl font-bold select-none ${
                        submitted ? "opacity-70" : "hover:border-blue-500 cursor-move"
                      }`}
                    >
                      {anagramLetters[idx]?.toUpperCase()}
                    </div>
                  );
                  lastIdx = slot.originalIndex;
                });

                if (currentWord.length > 0) {
                  elements.push(
                    <div key={`word-${elements.length}`} className="flex gap-2">
                      {currentWord}
                    </div>
                  );
                }

                return elements;
              })()
            ) : (
              <div className="text-gray-400 text-sm">Preparing anagram...</div>
            )}
          </div>
          <div className="flex gap-3">
            <button
              onClick={handleShuffleAnagram}
              disabled={submitted}
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-200 rounded-lg text-sm disabled:opacity-50"
            >
              Shuffle again
            </button>
            <button
              onClick={handleSubmitAnagram}
              disabled={submitted}
              className="px-6 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 rounded-lg font-medium"
            >
              Submit
            </button>
            <button
              onClick={onSkip}
              className="px-4 py-2 bg-gray-600 hover:bg-gray-500 text-gray-300 rounded-lg text-sm"
            >
              Don't Know
            </button>
          </div>
          {submitted && anagramResult === "wrong" && (
            <div className="text-red-400">
              Wrong! The answer was: <span className="font-bold">{answer}</span>
            </div>
          )}
        </>
      ) : (
        <>
          <div className="text-2xl font-mono tracking-widest flex flex-wrap justify-center">
            {words.map((word, wordIdx) => (
              <span key={wordIdx} className="inline-flex gap-1">
                {word.split("").map((_, charIdx) => (
                  <span key={charIdx} className="text-gray-400">_</span>
                ))}
                {wordIdx < words.length - 1 && <span className="mx-3 text-gray-600">•</span>}
              </span>
            ))}
          </div>
          <div className="text-sm text-gray-500">({answer.length} characters)</div>
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
              <button onClick={handleSubmit} disabled={!inputValue.trim()} className="px-6 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 rounded-lg font-medium">
                Submit
              </button>
              <button onClick={onSkip} className="px-4 py-2 bg-gray-600 hover:bg-gray-500 text-gray-300 rounded-lg text-sm">
                Don't Know
              </button>
            </div>
          )}
          {submitted && normalizeAccents(inputValue) !== normalizeAccents(answer) && (
            <div className="text-red-400">Wrong! The answer was: <span className="font-bold">{answer}</span></div>
          )}
        </>
      )}
      
      {/* Hint System UI */}
      {!hintIsAnagram && (
        <div className="flex flex-col items-center gap-2">
          {canRequestHint && !hintRequested && !submitted && (
            <button
              onClick={onRequestHint}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-medium flex items-center gap-2"
            >
              <span>🆘</span> Ask for Help
            </button>
          )}
          
          {hintRequested && !hintAccepted && (
            <div className="flex flex-col items-center gap-2">
              <div className="text-purple-400 text-sm animate-pulse">
                Waiting for opponent to help...
              </div>
            {onRequestHint && (
              <button
                onClick={onRequestHint}
                className="px-3 py-1 bg-purple-600 hover:bg-purple-700 text-white rounded text-xs"
              >
                Request another hint
              </button>
            )}
              <button
                onClick={onCancelHint}
                className="px-3 py-1 bg-gray-600 hover:bg-gray-500 text-gray-300 rounded text-xs"
              >
                Cancel
              </button>
            </div>
          )}
        {hintRequested && hintAccepted && onRequestHint && (
          <button
            onClick={onRequestHint}
            className="px-3 py-1 bg-purple-600 hover:bg-purple-700 text-white rounded text-xs"
          >
            Request another hint
          </button>
        )}
        </div>
      )}
    </div>
  );
}

// Level 2 - Multiple choice
function Level2MultipleChoice({
  answer,
  wrongAnswers,
  onCorrect,
  onWrong,
  onSkip,
  // Hint system props
  canRequestHint,
  hintRequested,
  hintAccepted,
  eliminatedOptions,
  onRequestHint,
  onCancelHint,
}: {
  answer: string;
  wrongAnswers: string[];
  onCorrect: () => void;
  onWrong: () => void;
  onSkip: () => void;
  // Hint system props
  canRequestHint?: boolean;
  hintRequested?: boolean;
  hintAccepted?: boolean;
  eliminatedOptions?: string[];
  onRequestHint?: (options: string[]) => void;
  onCancelHint?: () => void;
}) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const options = useMemo(() => {
    const shuffledWrong = [...wrongAnswers].sort(() => Math.random() - 0.5).slice(0, 4);
    return [answer, ...shuffledWrong].sort(() => Math.random() - 0.5);
  }, [answer, wrongAnswers]);

  // Handle option click - immediately submit
  const handleOptionClick = (idx: number) => {
    if (submitted) return;
    // Don't allow clicking eliminated options
    if (eliminatedOptions?.includes(options[idx])) return;
    
    setSelectedIndex(idx);
    setSubmitted(true);
    if (options[idx] === answer) {
      onCorrect();
    } else {
      onWrong();
    }
  };

  // Handle "Don't Know" - show correct answer briefly then skip
  const handleDontKnow = () => {
    if (submitted) return;
    setSubmitted(true);
    // Find and highlight correct answer
    const correctIdx = options.findIndex(opt => opt === answer);
    setSelectedIndex(correctIdx);
    // Call onSkip after a brief delay to show the correct answer
    setTimeout(() => {
      onSkip();
    }, 1500);
  };
  
  // Handle requesting hint
  const handleRequestHint = () => {
    if (onRequestHint) {
      onRequestHint(options);
    }
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (submitted) return;
      const numKey = parseInt(e.key);
      if (numKey >= 1 && numKey <= options.length) {
        e.preventDefault();
        // Don't allow selecting eliminated options
        if (eliminatedOptions?.includes(options[numKey - 1])) return;
        handleOptionClick(numKey - 1);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [submitted, options, eliminatedOptions]);

  return (
    <div className="flex flex-col items-center gap-4 w-full max-w-md">
      <div className="grid grid-cols-1 gap-3 w-full">
        {options.map((option, idx) => {
          const isSelected = selectedIndex === idx;
          const isCorrect = option === answer;
          const showResult = submitted;
          const isEliminated = eliminatedOptions?.includes(option);

          let buttonClass = "border-gray-600 bg-gray-800 hover:border-gray-500 cursor-pointer";
          if (isEliminated && !showResult) {
            buttonClass = "border-gray-700 bg-gray-900 text-gray-600 line-through cursor-not-allowed opacity-50";
          } else if (showResult) {
            if (isCorrect) buttonClass = "border-green-500 bg-green-500/20 text-green-400";
            else if (isSelected && !isCorrect) buttonClass = "border-red-500 bg-red-500/20 text-red-400";
            else buttonClass = "border-gray-600 bg-gray-800 opacity-50";
          }

          return (
            <button
              key={idx}
              onClick={() => handleOptionClick(idx)}
              disabled={submitted || isEliminated}
              className={`p-4 rounded-lg border-2 text-lg font-medium transition-all ${buttonClass}`}
            >
              {option}
            </button>
          );
        })}
      </div>
      
      {/* Hint System UI */}
      <div className="flex flex-col items-center gap-2">
        {/* Help button - request hint */}
        {canRequestHint && !hintRequested && !submitted && (
          <button
            onClick={handleRequestHint}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-medium flex items-center gap-2"
          >
            <span>🆘</span> Ask for Help
          </button>
        )}
        
        {/* Waiting for hint acceptance */}
        {hintRequested && !hintAccepted && (
          <div className="flex flex-col items-center gap-2">
            <div className="text-purple-400 text-sm animate-pulse">
              Waiting for opponent to help...
            </div>
            <button
              onClick={onCancelHint}
              className="px-3 py-1 bg-gray-600 hover:bg-gray-500 text-gray-300 rounded text-xs"
            >
              Cancel
            </button>
          </div>
        )}
        
        {/* Hint accepted - receiving hints */}
        {hintRequested && hintAccepted && (
          <div className="text-purple-400 text-sm">
            🎯 Opponent is eliminating options ({eliminatedOptions?.length || 0}/2)
          </div>
        )}
      </div>
      
      {!submitted && (
        <button onClick={handleDontKnow} className="px-4 py-2 bg-gray-600 hover:bg-gray-500 text-gray-300 rounded-lg text-sm">
          Don't Know
        </button>
      )}
    </div>
  );
}

// Level 3 - Pure typing
function Level3Input({
  answer,
  onCorrect,
  onWrong,
  onSkip,
  // Hint system props
  canRequestHint,
  hintRequested,
  hintAccepted,
  hintType,
  onRequestHint,
  onCancelHint,
}: {
  answer: string;
  onCorrect: () => void;
  onWrong: () => void;
  onSkip: () => void;
  // Hint system props
  canRequestHint?: boolean;
  hintRequested?: boolean;
  hintAccepted?: boolean;
  hintType?: string;
  onRequestHint?: () => void;
  onCancelHint?: () => void;
}) {
  const [inputValue, setInputValue] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [isCorrectAnswer, setIsCorrectAnswer] = useState(false);
  const showAnagramHint = hintAccepted && hintType === "anagram";
  const anagramHint = useMemo(() => {
    if (!showAnagramHint) return "";
    const shuffled = generateAnagramLetters(answer);
    return buildAnagramWithSpaces(answer, shuffled);
  }, [answer, showAnagramHint]);

  const handleSubmit = () => {
    setSubmitted(true);
    if (normalizeAccents(inputValue) === normalizeAccents(answer)) {
      setIsCorrectAnswer(true);
      setTimeout(() => onCorrect(), 1000);
    } else {
      onWrong();
    }
  };

  return (
    <div className="flex flex-col items-center gap-4">
      <input
        type="text"
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && !submitted && handleSubmit()}
        disabled={submitted}
        className="w-full max-w-xs px-4 py-3 text-lg text-center bg-gray-800 border-2 border-gray-600 rounded-lg focus:border-blue-500 focus:outline-none"
      placeholder={showAnagramHint ? `Anagram: ${anagramHint}` : "Type your answer..."}
        autoFocus
      />
      {showAnagramHint && (
        <div className="text-sm text-purple-300">Hint (anagram): {anagramHint}</div>
      )}
      
      {/* Hint System UI */}
      <div className="flex flex-col items-center gap-2">
        {canRequestHint && !hintRequested && !submitted && (
          <button
            onClick={onRequestHint}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-medium flex items-center gap-2"
          >
            <span>🆘</span> Ask for Help
          </button>
        )}
        
        {hintRequested && !hintAccepted && (
          <div className="flex flex-col items-center gap-2">
            <div className="text-purple-400 text-sm animate-pulse">
              Waiting for opponent to help...
            </div>
            {onRequestHint && (
              <button
                onClick={onRequestHint}
                className="px-3 py-1 bg-purple-600 hover:bg-purple-700 text-white rounded text-xs"
              >
                Request another hint
              </button>
            )}
            <button
              onClick={onCancelHint}
              className="px-3 py-1 bg-gray-600 hover:bg-gray-500 text-gray-300 rounded text-xs"
            >
              Cancel
            </button>
          </div>
        )}

        {hintRequested && hintAccepted && onRequestHint && (
          <button
            onClick={onRequestHint}
            className="px-3 py-1 bg-purple-600 hover:bg-purple-700 text-white rounded text-xs"
          >
            Request another hint
          </button>
        )}
      </div>
      
      {!submitted && (
        <div className="flex gap-3">
          <button onClick={handleSubmit} disabled={!inputValue.trim()} className="px-6 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 rounded-lg font-medium">
            Submit
          </button>
          <button onClick={onSkip} className="px-4 py-2 bg-gray-600 hover:bg-gray-500 text-gray-300 rounded-lg text-sm">
            Don't Know
          </button>
        </div>
      )}
      {submitted && isCorrectAnswer && (
        <div className="text-green-400 text-xl font-bold">✓ Correct!</div>
      )}
      {submitted && !isCorrectAnswer && (
        <div className="text-red-400">Wrong! The answer was: <span className="font-bold">{answer}</span></div>
      )}
    </div>
  );
}

// ============= Main Component =============

interface SoloStyleChallengeProps {
  duelId: string;
  duel: Doc<"duels">;
  theme: Doc<"themes">;
  challenger: Doc<"users"> | null;
  opponent: Doc<"users"> | null;
}

export default function SoloStyleChallenge({
  duelId,
  duel,
  theme,
  challenger,
  opponent,
}: SoloStyleChallengeProps) {
  const router = useRouter();
  const { user } = useUser();

  // Mutations
  const submitAnswer = useMutation(api.duel.submitSoloAnswer);
  const sendSabotage = useMutation(api.duel.sendSabotage);
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

  // State
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedbackCorrect, setFeedbackCorrect] = useState(false);
  const [feedbackAnswer, setFeedbackAnswer] = useState<string | null>(null);

  // Sabotage state
  const [activeSabotage, setActiveSabotage] = useState<SabotageEffect | null>(null);
  const [sabotagePhase, setSabotagePhase] = useState<"wind-up" | "full" | "wind-down">("wind-up");
  const [showSabotageMenu, setShowSabotageMenu] = useState(false);
  const lastSabotageTimestampRef = useRef<number | null>(null);
  const sabotageTimersRef = useRef<NodeJS.Timeout[]>([]);

  // Opponent status tracking
  const [opponentAnswerFeedback, setOpponentAnswerFeedback] = useState<"correct" | "wrong" | null>(null);
  const [opponentLastAnsweredWord, setOpponentLastAnsweredWord] = useState<string | null>(null);
  const [opponentFeedbackMessage, setOpponentFeedbackMessage] = useState<string | null>(null);
  const opponentWordFailCountsRef = useRef<Record<number, number>>({});
  const prevOpponentStatsRef = useRef<{ questionsAnswered: number; correctAnswers: number; wordIndex: number; level: number } | null>(null);

  // Hint giver view visibility
  const [showHintGiverView, setShowHintGiverView] = useState(false);
  const [showL2HintGiverView, setShowL2HintGiverView] = useState(false);
  
  // Hint selector visibility (can be dismissed)
  const [hintSelectorDismissed, setHintSelectorDismissed] = useState(false);
  const [hintL2SelectorDismissed, setHintL2SelectorDismissed] = useState(false);
  
  // TTS playback state for hints
  const [isPlayingTTS, setIsPlayingTTS] = useState(false);
  const ttsAudioRef = useRef<HTMLAudioElement | null>(null);
  const ttsPlayedForHintRef = useRef<string | null>(null); // Track which hint we already played TTS for
  const isPlayingTTSRef = useRef(false); // Ref version for stable callback
  
  // Flash hint state
  const [showFlashHint, setShowFlashHint] = useState(false);
  const [flashHintAnswer, setFlashHintAnswer] = useState<string | null>(null);
  const flashHintShownRef = useRef<string | null>(null); // Track which flash hint we already showed
  // Temporary "hint sent" banners
  const [showHintSentBanner, setShowHintSentBanner] = useState(false);
  const [showHintSentBannerL2, setShowHintSentBannerL2] = useState(false);

  // Determine if current user is challenger or opponent
  const isChallenger = challenger?.clerkId === user?.id;

  // Get player-specific state
  const myWordStates = isChallenger ? duel.challengerWordStates : duel.opponentWordStates;
  const myActivePool = isChallenger ? duel.challengerActivePool : duel.opponentActivePool;
  const myCurrentWordIndex = isChallenger ? duel.challengerCurrentWordIndex : duel.opponentCurrentWordIndex;
  const myCurrentLevel = isChallenger ? duel.challengerCurrentLevel : duel.opponentCurrentLevel;
  const myLevel2Mode = isChallenger ? duel.challengerLevel2Mode : duel.opponentLevel2Mode;
  const myCompleted = isChallenger ? duel.challengerCompleted : duel.opponentCompleted;
  const myStats = isChallenger ? duel.challengerStats : duel.opponentStats;

  const theirCompleted = isChallenger ? duel.opponentCompleted : duel.challengerCompleted;
  const theirStats = isChallenger ? duel.opponentStats : duel.challengerStats;
  const theirWordStates = isChallenger ? duel.opponentWordStates : duel.challengerWordStates;
  const theirCurrentWordIndex = isChallenger ? duel.opponentCurrentWordIndex : duel.challengerCurrentWordIndex;
  const theirCurrentLevel = isChallenger ? duel.opponentCurrentLevel : duel.challengerCurrentLevel;

  const myName = isChallenger ? challenger?.name : opponent?.name;
  const theirName = isChallenger ? opponent?.name : challenger?.name;

  // Sabotage usage
  const mySabotagesUsed = isChallenger ? (duel.challengerSabotagesUsed || 0) : (duel.opponentSabotagesUsed || 0);
  const sabotagesRemaining = MAX_SABOTAGES - mySabotagesUsed;

  // Current word
  const currentWord = myCurrentWordIndex !== undefined ? theme.words[myCurrentWordIndex] : null;

  // === Hint system state ===
  const myRole = isChallenger ? "challenger" : "opponent";
  const theirRole = isChallenger ? "opponent" : "challenger";
  
  // Who requested a hint
  const hintRequestedBy = duel.soloHintRequestedBy;
  const hintAccepted = duel.soloHintAccepted;
  const hintRequesterState = duel.soloHintRequesterState;
  const hintRevealedPositions = duel.soloHintRevealedPositions || [];
  const hintType = duel.soloHintType; // "letters" | "tts" | "flash"
  const hintRequesterLevel = hintRequesterState?.level;
  
  // Can I request a hint? (available on all levels now, no hint currently requested)
  const canRequestHint = !hintRequestedBy;
  
  // Did I request a hint?
  const iRequestedHint = hintRequestedBy === myRole;
  
  // Did they request a hint from me?
  const theyRequestedHint = hintRequestedBy === theirRole;
  
  // Should I show accept button? (they requested and hint not yet accepted)
  const canAcceptHint = theyRequestedHint && !hintAccepted;
  
  // Am I the hint giver? (they requested and I accepted)
  const isHintGiver = theyRequestedHint && hintAccepted;
  
  // Get the word they're asking about (for hint giver view)
  const hintRequesterWord = hintRequesterState 
    ? theme.words[hintRequesterState.wordIndex] 
    : null;

  // === L2 Multiple Choice Hint system state ===
  const hintL2RequestedBy = duel.soloHintL2RequestedBy;
  const hintL2Accepted = duel.soloHintL2Accepted;
  const hintL2WordIndex = duel.soloHintL2WordIndex;
  const hintL2Options = duel.soloHintL2Options || [];
  const hintL2EliminatedOptions = duel.soloHintL2EliminatedOptions || [];
  const hintL2Type = duel.soloHintL2Type; // "eliminate" or "tts"
  
  // Can I request an L2 hint? (I'm on Level 2 multiple choice and no L2 hint is currently requested)
  const canRequestHintL2 = myCurrentLevel === 2 && myLevel2Mode === "multiple_choice" && !hintL2RequestedBy;
  
  // Did I request an L2 hint?
  const iRequestedHintL2 = hintL2RequestedBy === myRole;
  
  // Did they request an L2 hint from me?
  const theyRequestedHintL2 = hintL2RequestedBy === theirRole;
  
  // Should I show accept button for L2 hint? (they requested and hint not yet accepted)
  const canAcceptHintL2 = theyRequestedHintL2 && !hintL2Accepted;
  
  // Am I the L2 hint giver? (they requested and I accepted)
  const isHintGiverL2 = theyRequestedHintL2 && hintL2Accepted;
  
  // Get the word they're asking about (for L2 hint giver view)
  const hintL2RequesterWord = hintL2WordIndex !== undefined 
    ? theme.words[hintL2WordIndex] 
    : null;

  // Progress calculation
  const myMastered = myWordStates?.filter((ws) => ws.completedLevel3).length || 0;
  const theirMastered = theirWordStates?.filter((ws) => ws.completedLevel3).length || 0;
  const totalWords = theme.words.length;

  // Clear sabotage effect
  const clearSabotageEffect = useCallback(() => {
    sabotageTimersRef.current.forEach((timer) => clearTimeout(timer));
    sabotageTimersRef.current = [];
    setActiveSabotage(null);
    setSabotagePhase("wind-up");
  }, []);

  // Sabotage effect listener
  useEffect(() => {
    const mySabotage = isChallenger ? duel.challengerSabotage : duel.opponentSabotage;

    if (mySabotage && mySabotage.timestamp !== lastSabotageTimestampRef.current) {
      lastSabotageTimestampRef.current = mySabotage.timestamp;
      clearSabotageEffect();

      setSabotagePhase("wind-up");
      setActiveSabotage(mySabotage.effect as SabotageEffect);

      const fullTimer = setTimeout(() => setSabotagePhase("full"), 2000);
      const windDownTimer = setTimeout(() => setSabotagePhase("wind-down"), 5000);
      const clearTimer = setTimeout(() => {
        setActiveSabotage(null);
        setSabotagePhase("wind-up");
      }, SABOTAGE_DURATION);

      sabotageTimersRef.current = [fullTimer, windDownTimer, clearTimer];
    }
  }, [duel.challengerSabotage, duel.opponentSabotage, isChallenger, clearSabotageEffect]);

  // Opponent answer feedback effect - detect when opponent answers
  useEffect(() => {
    if (!theirStats || theirCurrentWordIndex === undefined || theirCurrentLevel === undefined) {
      prevOpponentStatsRef.current = null;
      return;
    }

    const prev = prevOpponentStatsRef.current;
    
    // Check if opponent answered a new question
    if (prev && theirStats.questionsAnswered > prev.questionsAnswered) {
      // Capture the word they just answered (in English) - use the previous word index
      const answeredWord = theme.words[prev.wordIndex]?.word || "...";
      setOpponentLastAnsweredWord(answeredWord);
      
      // Determine if they answered correctly by comparing correctAnswers
      const wasCorrect = theirStats.correctAnswers > prev.correctAnswers;
      setOpponentAnswerFeedback(wasCorrect ? "correct" : "wrong");
      
      // Set feedback message based on result
      if (!wasCorrect) {
        // Increment fail count for this word
        const currentCount = opponentWordFailCountsRef.current[prev.wordIndex] || 0;
        opponentWordFailCountsRef.current[prev.wordIndex] = currentCount + 1;
        const failCount = currentCount + 1;
        setOpponentFeedbackMessage(`Failed ${failCount} time${failCount > 1 ? 's' : ''}`);
      } else if (prev.level === 3) {
        // L3 success = word completed
        setOpponentFeedbackMessage("Word completed!");
      } else {
        setOpponentFeedbackMessage(null);
      }
      
      // Clear feedback after animation
      setTimeout(() => {
        setOpponentAnswerFeedback(null);
        setOpponentLastAnsweredWord(null);
        setOpponentFeedbackMessage(null);
      }, 1500);
    }
    
    // Update ref with current stats, word index, and level
    prevOpponentStatsRef.current = { 
      questionsAnswered: theirStats.questionsAnswered, 
      correctAnswers: theirStats.correctAnswers,
      wordIndex: theirCurrentWordIndex,
      level: theirCurrentLevel
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
      const timer = setTimeout(() => setShowHintSentBanner(false), 3000);
      return () => clearTimeout(timer);
    }
    setShowHintSentBanner(false);
  }, [isHintGiver, hintAccepted, hintType]);

  // Auto-hide hint sent banners for L2 multiple choice
  useEffect(() => {
    const shouldShowL2 = isHintGiverL2 && hintL2Accepted && ["tts", "flash"].includes(hintL2Type || "");
    if (shouldShowL2) {
      setShowHintSentBannerL2(true);
      const timer = setTimeout(() => setShowHintSentBannerL2(false), 3000);
      return () => clearTimeout(timer);
    }
    setShowHintSentBannerL2(false);
  }, [isHintGiverL2, hintL2Accepted, hintL2Type]);

  // Handle answer submission
  const handleCorrect = useCallback(() => {
    setFeedbackCorrect(true);
    setShowFeedback(true);
    setFeedbackAnswer(null);

    submitAnswer({ duelId: duel._id, isCorrect: true }).catch(console.error);

    setTimeout(() => {
      setShowFeedback(false);
    }, 1500);
  }, [duel._id, submitAnswer]);

  const handleWrong = useCallback(() => {
    setFeedbackCorrect(false);
    setShowFeedback(true);
    setFeedbackAnswer(currentWord?.answer || null);

    submitAnswer({ duelId: duel._id, isCorrect: false }).catch(console.error);

    setTimeout(() => {
      setShowFeedback(false);
    }, 2500);
  }, [duel._id, currentWord?.answer, submitAnswer]);

  const handleSkip = useCallback(() => {
    setFeedbackCorrect(false);
    setShowFeedback(true);
    setFeedbackAnswer(currentWord?.answer || null);

    submitAnswer({ duelId: duel._id, isCorrect: false }).catch(console.error);

    setTimeout(() => {
      setShowFeedback(false);
    }, 2500);
  }, [duel._id, currentWord?.answer, submitAnswer]);

  // === Hint system handlers ===
  const handleRequestHint = useCallback(async (typedLetters: string[], revealedPositions: number[]) => {
    try {
      await requestSoloHint({ duelId: duel._id, typedLetters, revealedPositions });
    } catch (error) {
      console.error("Failed to request hint:", error);
    }
  }, [duel._id, requestSoloHint]);

  // Simple hint request for L2 typing and L3 (no typed state needed)
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

  const handleAcceptHint = useCallback(async (hintType: string) => {
    try {
      await acceptSoloHint({ duelId: duel._id, hintType });
    } catch (error) {
      console.error("Failed to accept hint:", error);
    }
  }, [duel._id, acceptSoloHint]);

  const handleProvideHint = useCallback(async (position: number) => {
    try {
      await provideSoloHint({ duelId: duel._id, position });
    } catch (error) {
      console.error("Failed to provide hint:", error);
    }
  }, [duel._id, provideSoloHint]);

  const handleUpdateHintState = useCallback(async (typedLetters: string[], revealedPositions: number[]) => {
    try {
      await updateSoloHintState({ duelId: duel._id, typedLetters, revealedPositions });
    } catch (error) {
      console.error("Failed to update hint state:", error);
    }
  }, [duel._id, updateSoloHintState]);

  // === L2 Hint system handlers ===
  const handleRequestHintL2 = useCallback(async (options: string[]) => {
    try {
      await requestSoloHintL2({ duelId: duel._id, options });
    } catch (error) {
      console.error("Failed to request L2 hint:", error);
    }
  }, [duel._id, requestSoloHintL2]);

  const handleCancelHintL2 = useCallback(async () => {
    try {
      await cancelSoloHintL2({ duelId: duel._id });
    } catch (error) {
      console.error("Failed to cancel L2 hint:", error);
    }
  }, [duel._id, cancelSoloHintL2]);

  const handleAcceptHintL2 = useCallback(async (hintType: string) => {
    try {
      await acceptSoloHintL2({ duelId: duel._id, hintType });
    } catch (error) {
      console.error("Failed to accept L2 hint:", error);
    }
  }, [duel._id, acceptSoloHintL2]);

  const handleEliminateL2Option = useCallback(async (option: string) => {
    try {
      await eliminateSoloHintL2Option({ duelId: duel._id, option });
    } catch (error) {
      console.error("Failed to eliminate L2 option:", error);
    }
  }, [duel._id, eliminateSoloHintL2Option]);

  // Play TTS for hint
  const playTTSHint = useCallback(async (word: string) => {
    if (isPlayingTTSRef.current || !word) return;
    isPlayingTTSRef.current = true;
    setIsPlayingTTS(true);
    try {
      const response = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: word, lang: 'es' }),
      });
      if (!response.ok) throw new Error('TTS request failed');
      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);
      if (ttsAudioRef.current) {
        ttsAudioRef.current.pause();
        ttsAudioRef.current = null;
      }
      const audio = new Audio(audioUrl);
      ttsAudioRef.current = audio;
      audio.onended = () => {
        isPlayingTTSRef.current = false;
        setIsPlayingTTS(false);
        URL.revokeObjectURL(audioUrl);
      };
      audio.onerror = () => {
        isPlayingTTSRef.current = false;
        setIsPlayingTTS(false);
        URL.revokeObjectURL(audioUrl);
      };
      await audio.play();
    } catch (error) {
      console.error('Failed to play TTS:', error);
      isPlayingTTSRef.current = false;
      setIsPlayingTTS(false);
    }
  }, []); // No dependencies - uses refs for stability

  // Auto-play TTS when I requested a hint and helper chose TTS type (L1)
  useEffect(() => {
    const hintKey = `L1-${myCurrentWordIndex}`;
    if (iRequestedHint && hintAccepted && hintType === "tts" && currentWord && ttsPlayedForHintRef.current !== hintKey) {
      ttsPlayedForHintRef.current = hintKey;
      playTTSHint(currentWord.answer);
    }
    // Reset ref when hint is cleared
    if (!iRequestedHint) {
      ttsPlayedForHintRef.current = null;
    }
  }, [iRequestedHint, hintAccepted, hintType, currentWord?.answer, myCurrentWordIndex]);

  // Auto-play TTS when I requested a hint and helper chose TTS type (L2)
  useEffect(() => {
    const hintKey = `L2-${hintL2WordIndex}`;
    if (iRequestedHintL2 && hintL2Accepted && hintL2Type === "tts" && hintL2RequesterWord && ttsPlayedForHintRef.current !== hintKey) {
      ttsPlayedForHintRef.current = hintKey;
      playTTSHint(hintL2RequesterWord.answer);
    }
    // Reset ref when hint is cleared
    if (!iRequestedHintL2) {
      ttsPlayedForHintRef.current = null;
    }
  }, [iRequestedHintL2, hintL2Accepted, hintL2Type, hintL2RequesterWord?.answer, hintL2WordIndex]);

  // Show flash hint when I requested a hint and helper chose flash type
  useEffect(() => {
    const hintKey = `flash-${myCurrentWordIndex}`;
    if (iRequestedHint && hintAccepted && hintType === "flash" && currentWord && flashHintShownRef.current !== hintKey) {
      flashHintShownRef.current = hintKey;
      setFlashHintAnswer(currentWord.answer);
      setShowFlashHint(true);
      // Auto-hide after 0.5 seconds
      setTimeout(() => {
        setShowFlashHint(false);
        setFlashHintAnswer(null);
      }, 500);
    }
    // Reset ref when hint is cleared
    if (!iRequestedHint) {
      flashHintShownRef.current = null;
    }
  }, [iRequestedHint, hintAccepted, hintType, currentWord?.answer, myCurrentWordIndex]);

  // Show flash hint for L2 hints
  useEffect(() => {
    const hintKey = `flash-L2-${hintL2WordIndex}`;
    if (iRequestedHintL2 && hintL2Accepted && hintL2Type === "flash" && hintL2RequesterWord && flashHintShownRef.current !== hintKey) {
      flashHintShownRef.current = hintKey;
      setFlashHintAnswer(hintL2RequesterWord.answer);
      setShowFlashHint(true);
      // Auto-hide after 0.5 seconds
      setTimeout(() => {
        setShowFlashHint(false);
        setFlashHintAnswer(null);
      }, 500);
    }
    // Reset ref when hint is cleared
    if (!iRequestedHintL2) {
      flashHintShownRef.current = null;
    }
  }, [iRequestedHintL2, hintL2Accepted, hintL2Type, hintL2RequesterWord?.answer, hintL2WordIndex]);

  // Handle sabotage
  const handleSendSabotage = async (effect: SabotageEffect) => {
    setShowSabotageMenu(false);
    try {
      await sendSabotage({ duelId: duel._id, effect });
    } catch (error) {
      console.error("Failed to send sabotage:", error);
    }
  };

  // Handle exit
  const handleExit = async () => {
    await stopDuel({ duelId: duel._id });
    router.push("/");
  };

  // Level colors
  const levelColors: Record<number, string> = {
    1: "text-green-400 bg-green-500/20 border-green-500",
    2: "text-yellow-400 bg-yellow-500/20 border-yellow-500",
    3: "text-red-400 bg-red-500/20 border-red-500",
  };

  // Completion screen
  if (duel.status === "completed" || (myCompleted && theirCompleted)) {
    const myAccuracy = myStats && myStats.questionsAnswered > 0
      ? Math.round((myStats.correctAnswers / myStats.questionsAnswered) * 100)
      : 0;
    const theirAccuracy = theirStats && theirStats.questionsAnswered > 0
      ? Math.round((theirStats.correctAnswers / theirStats.questionsAnswered) * 100)
      : 0;

    return (
      <main className="min-h-screen bg-gray-900 flex flex-col items-center justify-center p-4">
        <div className="bg-gray-800 rounded-xl p-8 max-w-md w-full text-center border-2 border-yellow-500">
          <div className="text-4xl mb-4">🎉</div>
          <h1 className="text-2xl font-bold text-yellow-400 mb-6">Duel Complete!</h1>

          {/* Comparison */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            {/* My stats */}
            <div className="bg-gray-900 rounded-lg p-4">
              <div className="text-green-400 font-bold mb-2">{myName?.split(" ")[0] || "You"}</div>
              <div className="text-3xl font-bold text-white mb-1">{myMastered}/{totalWords}</div>
              <div className="text-sm text-gray-400">words mastered</div>
              <div className="text-lg font-bold text-green-400 mt-2">{myAccuracy}%</div>
              <div className="text-xs text-gray-500">accuracy</div>
            </div>

            {/* Their stats */}
            <div className="bg-gray-900 rounded-lg p-4">
              <div className="text-blue-400 font-bold mb-2">{theirName?.split(" ")[0] || "Opponent"}</div>
              <div className="text-3xl font-bold text-white mb-1">{theirMastered}/{totalWords}</div>
              <div className="text-sm text-gray-400">words mastered</div>
              <div className="text-lg font-bold text-blue-400 mt-2">{theirAccuracy}%</div>
              <div className="text-xs text-gray-500">accuracy</div>
            </div>
          </div>

          <button
            onClick={() => router.push("/")}
            className="w-full bg-blue-500 hover:bg-blue-600 text-white font-bold py-3 px-6 rounded-lg text-lg"
          >
            Back to Home
          </button>
        </div>
      </main>
    );
  }

  // Waiting for opponent
  if (myCompleted && !theirCompleted) {
    return (
      <main className="min-h-screen bg-gray-900 flex flex-col items-center justify-center p-4">
        <div className="bg-gray-800 rounded-xl p-8 max-w-md w-full text-center">
          <div className="text-4xl mb-4">🏆</div>
          <h1 className="text-2xl font-bold text-green-400 mb-4">You finished!</h1>
          <p className="text-gray-400 mb-6">Waiting for {theirName?.split(" ")[0] || "opponent"} to complete...</p>

          {/* Progress comparison */}
          <div className="bg-gray-900 rounded-lg p-4 mb-4">
            <div className="flex justify-between items-center mb-2">
              <span className="text-green-400">{myName?.split(" ")[0] || "You"}</span>
              <span className="text-green-400 font-bold">{myMastered}/{totalWords} ✓</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-blue-400">{theirName?.split(" ")[0] || "Opponent"}</span>
              <span className="text-blue-400 font-bold">{theirMastered}/{totalWords}</span>
            </div>
          </div>

          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-500 mx-auto"></div>
        </div>
      </main>
    );
  }

  // Main challenge UI
  return (
    <main className="min-h-screen bg-gray-900 flex flex-col items-center p-4 relative">
      {/* Sabotage Effect Overlay */}
      <SabotageRenderer effect={activeSabotage} phase={sabotagePhase} />

      {/* Hint Giver View - shows when I'm providing hints to opponent */}
      {isHintGiver && hintRequesterWord && hintRequesterState && showHintGiverView && (
        <HintGiverView
          word={hintRequesterWord.word}
          answer={hintRequesterWord.answer}
          typedLetters={hintRequesterState.typedLetters}
          requesterRevealedPositions={hintRequesterState.revealedPositions}
          hintRevealedPositions={hintRevealedPositions}
          hintsRemaining={3 - hintRevealedPositions.length}
          onProvideHint={handleProvideHint}
          requesterName={theirName?.split(" ")[0] || "Opponent"}
          onDismiss={() => setShowHintGiverView(false)}
        />
      )}
      
      {/* Minimized hint giver button - shows when hint view is minimized but still active (letters type) */}
      {isHintGiver && hintType === "letters" && hintRequesterWord && hintRequesterState && !showHintGiverView && (
        <button
          onClick={() => setShowHintGiverView(true)}
          className="fixed bottom-20 left-4 z-40 bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2"
        >
          <span>🆘</span>
          <span>Help {theirName?.split(" ")[0] || "Opponent"}</span>
          <span className="bg-white/20 px-2 py-0.5 rounded text-sm">{3 - hintRevealedPositions.length}/3</span>
        </button>
      )}
      
      {/* TTS hint sent confirmation - shows when giver chose TTS for L1 */}
      {showHintSentBanner && isHintGiver && hintType === "tts" && (
        <div className="fixed bottom-20 left-4 z-40 bg-green-600 text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2">
          <span>🔊</span>
          <span>Sound sent to {theirName?.split(" ")[0] || "Opponent"}!</span>
        </div>
      )}
      
      {/* Anagram hint sent confirmation */}
      {showHintSentBanner && isHintGiver && hintType === "anagram" && (
        <div className="fixed bottom-20 left-4 z-40 bg-purple-700 text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2">
          <span>🔀</span>
          <span>Anagram sent to {theirName?.split(" ")[0] || "Opponent"}!</span>
        </div>
      )}

      {/* Flash hint sent confirmation - shows when giver chose flash */}
      {showHintSentBanner && isHintGiver && hintType === "flash" && (
        <div className="fixed bottom-20 left-4 z-40 bg-purple-600 text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2">
          <span>⚡</span>
          <span>Answer flashed to {theirName?.split(" ")[0] || "Opponent"}!</span>
        </div>
      )}

      {/* Hint Type Selector - shows when opponent requests help */}
      {canAcceptHint && hintRequesterWord && !hintSelectorDismissed && (
        <HintSelector
          requesterName={theirName?.split(" ")[0] || "Opponent"}
          word={hintRequesterWord.word}
          hintOptions={hintRequesterLevel === 1 ? L1_HINT_OPTIONS : TYPING_HINT_OPTIONS}
          onSelectHint={handleAcceptHint}
          onDismiss={() => setHintSelectorDismissed(true)}
        />
      )}
      
      {/* Minimized hint selector button - shows when selector was dismissed but request still active */}
      {canAcceptHint && hintRequesterWord && hintSelectorDismissed && (
        <button
          onClick={() => setHintSelectorDismissed(false)}
          className="fixed bottom-20 right-4 z-40 bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2"
        >
          <span>🆘</span>
          <span>{theirName?.split(" ")[0] || "Opponent"} needs help</span>
        </button>
      )}

      {/* L2 Hint Giver View - shows when I'm providing L2 hints to opponent */}
      {isHintGiverL2 && hintL2RequesterWord && hintL2Options.length > 0 && showL2HintGiverView && (
        <L2HintGiverView
          word={hintL2RequesterWord.word}
          answer={hintL2RequesterWord.answer}
          options={hintL2Options}
          eliminatedOptions={hintL2EliminatedOptions}
          onEliminateOption={handleEliminateL2Option}
          requesterName={theirName?.split(" ")[0] || "Opponent"}
          onDismiss={() => setShowL2HintGiverView(false)}
        />
      )}
      
      {/* Minimized L2 hint giver button - shows when L2 hint view is minimized but still active (eliminate type) */}
      {isHintGiverL2 && hintL2Type === "eliminate" && hintL2RequesterWord && hintL2Options.length > 0 && !showL2HintGiverView && (
        <button
          onClick={() => setShowL2HintGiverView(true)}
          className="fixed bottom-20 left-4 z-40 bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2"
        >
          <span>🆘</span>
          <span>Help {theirName?.split(" ")[0] || "Opponent"}</span>
          <span className="bg-white/20 px-2 py-0.5 rounded text-sm">{2 - hintL2EliminatedOptions.length}/2</span>
        </button>
      )}
      
      {/* TTS hint sent confirmation - shows when giver chose TTS for L2 */}
      {showHintSentBannerL2 && isHintGiverL2 && hintL2Type === "tts" && (
        <div className="fixed bottom-20 left-4 z-40 bg-green-600 text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2">
          <span>🔊</span>
          <span>Sound sent to {theirName?.split(" ")[0] || "Opponent"}!</span>
        </div>
      )}
      
      {/* Flash hint sent confirmation - shows when giver chose flash for L2 */}
      {showHintSentBannerL2 && isHintGiverL2 && hintL2Type === "flash" && (
        <div className="fixed bottom-20 left-4 z-40 bg-purple-600 text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2">
          <span>⚡</span>
          <span>Answer flashed to {theirName?.split(" ")[0] || "Opponent"}!</span>
        </div>
      )}

      {/* Hint Type Selector - shows when opponent requests help (L2 multiple choice) */}
      {canAcceptHintL2 && hintL2RequesterWord && !hintL2SelectorDismissed && (
        <HintSelector
          requesterName={theirName?.split(" ")[0] || "Opponent"}
          word={hintL2RequesterWord.word}
          hintOptions={L2_MC_HINT_OPTIONS}
          onSelectHint={handleAcceptHintL2}
          onDismiss={() => setHintL2SelectorDismissed(true)}
        />
      )}
      
      {/* Minimized L2 hint selector button - shows when selector was dismissed but request still active */}
      {canAcceptHintL2 && hintL2RequesterWord && hintL2SelectorDismissed && (
        <button
          onClick={() => setHintL2SelectorDismissed(false)}
          className="fixed bottom-20 right-4 z-40 bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2"
        >
          <span>🆘</span>
          <span>{theirName?.split(" ")[0] || "Opponent"} needs help</span>
        </button>
      )}

      {/* Exit Button */}
      <button
        onClick={handleExit}
        className="absolute top-4 right-4 bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-4 rounded z-50"
      >
        Exit
      </button>

      {/* Opponent Status Indicator */}
      {theirCurrentWordIndex !== undefined && theirCurrentLevel !== undefined && !theirCompleted && (
        <div className="absolute top-4 left-4 z-50 flex flex-col items-start gap-1">
          <div 
            className={`rounded-full px-4 py-2 transition-all duration-300 ${
              opponentAnswerFeedback === "correct" 
                ? "bg-green-500/30 border-2 border-green-500 shadow-lg shadow-green-500/50" 
                : opponentAnswerFeedback === "wrong"
                  ? "bg-red-500/30 border-2 border-red-500 shadow-lg shadow-red-500/50"
                  : "bg-gray-800/90 border border-gray-700"
            }`}
          >
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400">{theirName?.split(" ")[0] || "Opponent"}:</span>
              <span className="text-blue-400 font-medium text-sm">
                {opponentLastAnsweredWord || theme.words[theirCurrentWordIndex]?.word || "..."}
              </span>
              <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                theirCurrentLevel === 1 
                  ? "bg-green-500/20 text-green-400 border border-green-500/50"
                  : theirCurrentLevel === 2
                    ? "bg-yellow-500/20 text-yellow-400 border border-yellow-500/50"
                    : "bg-red-500/20 text-red-400 border border-red-500/50"
              }`}>
                L{theirCurrentLevel}
              </span>
              {opponentAnswerFeedback && (
                <span className={`text-xs font-bold ${
                  opponentAnswerFeedback === "correct" ? "text-green-400" : "text-red-400"
                }`}>
                  {opponentAnswerFeedback === "correct" ? "✓" : "✗"}
                </span>
              )}
            </div>
          </div>
          {opponentFeedbackMessage && (
            <div className={`text-xs font-bold px-4 ${
              opponentFeedbackMessage === "Word completed!" ? "text-green-400" : "text-red-400"
            }`}>
              {opponentFeedbackMessage}
            </div>
          )}
        </div>
      )}

      {/* Progress Header */}
      <div className="w-full max-w-md mb-8 mt-16">
        <div className="text-center mb-4">
          <h1 className="text-xl font-bold text-gray-300">{theme.name}</h1>
        </div>

        {/* Dual progress bars */}
        <div className="space-y-2 mb-4">
          {/* My progress */}
          <div className="flex items-center gap-3">
            <span className="text-green-400 text-sm w-20 truncate">{myName?.split(" ")[0] || "You"}</span>
            <div className="flex-1 bg-gray-700 rounded-full h-3">
              <div
                className="bg-green-500 rounded-full h-3 transition-all duration-300"
                style={{ width: `${(myMastered / totalWords) * 100}%` }}
              />
            </div>
            <span className="text-green-400 text-sm w-20 text-right">
              {myMastered}/{totalWords} {myStats && myStats.questionsAnswered > 0 ? `${Math.round((myStats.correctAnswers / myStats.questionsAnswered) * 100)}%` : ''}
            </span>
          </div>

          {/* Their progress */}
          <div className="flex items-center gap-3">
            <span className="text-blue-400 text-sm w-20 truncate">{theirName?.split(" ")[0] || "Opponent"}</span>
            <div className="flex-1 bg-gray-700 rounded-full h-3">
              <div
                className="bg-blue-500 rounded-full h-3 transition-all duration-300"
                style={{ width: `${(theirMastered / totalWords) * 100}%` }}
              />
            </div>
            <span className="text-blue-400 text-sm w-20 text-right">
              {theirMastered}/{totalWords} {theirStats && theirStats.questionsAnswered > 0 ? `${Math.round((theirStats.correctAnswers / theirStats.questionsAnswered) * 100)}%` : ''}
            </span>
          </div>
        </div>

        {/* Stats */}
        <div className="text-center text-gray-500 text-sm">
          Questions: {myStats?.questionsAnswered || 0} | Correct: {myStats?.correctAnswers || 0}
        </div>
      </div>

      {/* Question Card */}
      {currentWord && (
        <div className="w-full max-w-md bg-gray-800/50 rounded-xl p-6 border border-gray-700">
          {/* Level indicator */}
          <div className="flex justify-center mb-4">
            <span className={`inline-block px-3 py-1 rounded-full border text-sm font-medium ${levelColors[myCurrentLevel || 1]}`}>
              Level {myCurrentLevel || 1}
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

          {/* Flash hint overlay - brief neutral answer flash */}
          {showFlashHint && flashHintAnswer && (
            <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none animate-pulse">
              <div className="bg-purple-600/90 backdrop-blur-sm text-white px-8 py-6 rounded-2xl shadow-2xl border-2 border-purple-400">
                <div className="text-sm text-purple-200 mb-1 text-center">⚡ Hint</div>
                <div className="text-4xl font-bold text-center">{flashHintAnswer}</div>
              </div>
            </div>
          )}

          {/* Input based on level */}
          {!showFeedback && (
            <>
              {myCurrentLevel === 1 && (
                <Level1Input
                  key={`${myCurrentWordIndex}-${myStats?.questionsAnswered}`}
                  answer={currentWord.answer}
                  onCorrect={handleCorrect}
                  onSkip={handleSkip}
                  // Hint system props
                  canRequestHint={canRequestHint}
                  hintRequested={iRequestedHint}
                  hintAccepted={hintAccepted}
                  hintType={hintType}
                  hintRevealedPositions={hintRevealedPositions}
                  onRequestHint={handleRequestHint}
                  onCancelHint={handleCancelHint}
                  onUpdateHintState={handleUpdateHintState}
                />
              )}

              {myCurrentLevel === 2 && myLevel2Mode === "typing" && (
                <Level2TypingInput
                  key={`${myCurrentWordIndex}-${myStats?.questionsAnswered}`}
                  answer={currentWord.answer}
                  onCorrect={handleCorrect}
                  onWrong={handleWrong}
                  onSkip={handleSkip}
                  // Hint system props
                  canRequestHint={canRequestHint}
                  hintRequested={iRequestedHint}
                  hintAccepted={hintAccepted}
                  hintType={hintType}
                  onRequestHint={handleRequestSimpleHint}
                  onCancelHint={handleCancelHint}
                />
              )}

              {myCurrentLevel === 2 && myLevel2Mode === "multiple_choice" && (
                <Level2MultipleChoice
                  key={`${myCurrentWordIndex}-${myStats?.questionsAnswered}`}
                  answer={currentWord.answer}
                  wrongAnswers={currentWord.wrongAnswers}
                  onCorrect={handleCorrect}
                  onWrong={handleWrong}
                  onSkip={handleSkip}
                  // L2 hint props
                  canRequestHint={canRequestHintL2}
                  hintRequested={iRequestedHintL2}
                  hintAccepted={hintL2Accepted}
                  eliminatedOptions={hintL2EliminatedOptions}
                  onRequestHint={handleRequestHintL2}
                  onCancelHint={handleCancelHintL2}
                />
              )}

              {myCurrentLevel === 3 && (
                <Level3Input
                  key={`${myCurrentWordIndex}-${myStats?.questionsAnswered}`}
                  answer={currentWord.answer}
                  onCorrect={handleCorrect}
                  onWrong={handleWrong}
                  onSkip={handleSkip}
                  // Hint system props
                  canRequestHint={canRequestHint}
                  hintRequested={iRequestedHint}
                  hintAccepted={hintAccepted}
                  hintType={hintType}
                  onRequestHint={handleRequestSimpleHint}
                  onCancelHint={handleCancelHint}
                />
              )}
            </>
          )}
        </div>
      )}

      {/* Sabotage Button */}
      <div className="fixed bottom-4 right-4 z-30">
        {showSabotageMenu && sabotagesRemaining > 0 && (
          <div className="absolute bottom-16 right-0 bg-gray-800 rounded-lg p-3 shadow-xl border border-gray-700 mb-2">
            <div className="text-xs text-gray-400 mb-2 text-center">Send to opponent</div>
            <div className="grid grid-cols-3 gap-2">
              {SABOTAGE_OPTIONS.map((option) => (
                <button
                  key={option.effect}
                  onClick={() => handleSendSabotage(option.effect)}
                  className="flex flex-col items-center p-2 rounded-lg bg-gray-700 hover:bg-gray-600"
                >
                  <span className="text-2xl">{option.emoji}</span>
                  <span className="text-xs text-gray-300 mt-1">{option.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        <button
          onClick={() => setShowSabotageMenu(!showSabotageMenu)}
          disabled={sabotagesRemaining <= 0}
          className={`flex items-center gap-2 px-4 py-3 rounded-lg font-medium transition-all ${
            sabotagesRemaining > 0
              ? "bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white shadow-lg"
              : "bg-gray-700 text-gray-500 cursor-not-allowed"
          }`}
        >
          <span className="text-xl">💥</span>
          <span>Sabotage</span>
          <span className={`px-2 py-0.5 rounded-full text-sm ${sabotagesRemaining > 0 ? "bg-white/20" : "bg-gray-600"}`}>
            {sabotagesRemaining}/{MAX_SABOTAGES}
          </span>
        </button>
      </div>
    </main>
  );
}
