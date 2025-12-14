"use client";

import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useEffect, useState, useMemo, useRef, useCallback } from "react";
import {
  calculateClassicDifficultyDistribution,
  getDifficultyForIndex,
  type ClassicDifficultyPreset,
} from "@/lib/difficultyUtils";
import type { Doc, Id } from "@/convex/_generated/dataModel";

// Sabotage Effect Type
type SabotageEffect = "sticky" | "bounce" | "trampoline" | "reverse";

const SABOTAGE_DURATION = 7000; // 7 seconds total (2s wind-up, 3s full, 2s wind-down)
const MAX_SABOTAGES = 5;

// Pre-generate random layouts at module scope so we don't call Math.random in render
const INK_SPLATTERS = Array.from({ length: 25 }, (_, i) => ({
  id: i,
  top: 5 + Math.random() * 90,
  left: 2 + Math.random() * 96,
  scale: 1.5 + Math.random() * 2.5,
  delay: Math.random() * 1.5,
  rotation: Math.random() * 360,
  pulseSpeed: 0.5 + Math.random() * 0.5,
}));

const FLOATING_BUBBLES = Array.from({ length: 60 }, (_, i) => ({
  id: i,
  left: Math.random() * 100,
  size: 80 + Math.random() * 150,
  duration: 1.5 + Math.random() * 1.5,
  delay: Math.random() * 1,
  wobbleAmount: 40 + Math.random() * 60,
  hue: Math.floor(Math.random() * 60) + 180,
}));

const FALLING_EMOJIS = (() => {
  const emojiList = ["💀", "👻", "🔥", "💣", "⚡", "🌀", "👀", "🎭", "🤯", "😈", "💥", "🌪️", "☠️", "👹", "🤡", "💢"];
  return Array.from({ length: 80 }, (_, i) => ({
    id: i,
    emoji: emojiList[Math.floor(Math.random() * emojiList.length)],
    left: Math.random() * 100,
    duration: 0.8 + Math.random() * 1.2,
    delay: Math.random() * 1,
    size: 50 + Math.random() * 60,
    spinDirection: Math.random() > 0.5 ? 1 : -1,
    wobble: 30 + Math.random() * 50,
  }));
})();

const STICKY_NOTES = Array.from({ length: 20 }, (_, i) => ({
  id: i,
  top: 2 + Math.random() * 85,
  left: 2 + Math.random() * 85,
  rotation: -25 + Math.random() * 50,
  delay: Math.random() * 1,
  wobbleSpeed: 0.3 + Math.random() * 0.4,
  color: ["#fff740", "#ff7eb9", "#7afcff", "#feff9c", "#ff65a3", "#a8f0c6", "#ffb347", "#ff6961"][
    Math.floor(Math.random() * 8)
  ],
  text: [
    "You buffoon!",
    "LOL nice try",
    "Too slow!",
    "Really?!",
    "Haha NOPE",
    "Good luck!",
    "Think faster!",
    "Oopsie!",
    "Clown move",
    "Big brain?",
    "Try harder",
    "Yikes...",
    "LMAOOO",
    "Panic mode!",
    "Uh oh...",
    "RIP",
  ][Math.floor(Math.random() * 16)],
  size: 100 + Math.random() * 50,
}));

const FLYING_CARDS = (() => {
  const suits = ["♠", "♥", "♦", "♣"] as const;
  const values = ["A", "K", "Q", "J", "10", "9", "8"] as const;
  return Array.from({ length: 50 }, (_, i) => ({
    id: i,
    suit: suits[Math.floor(Math.random() * 4)],
    value: values[Math.floor(Math.random() * 7)],
    startY: Math.random() * 100,
    duration: 0.6 + Math.random() * 0.8,
    delay: Math.random() * 1.5,
    fromLeft: Math.random() > 0.5,
    size: 0.8 + Math.random() * 0.6,
    verticalWobble: 20 + Math.random() * 40,
  }));
})();

// Format duration as MM:SS or H:MM:SS
function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  
  if (hours > 0) {
    return `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function reverseText(text: string): string {
  return Array.from(text).reverse().join("");
}

function scrambleTextKeepSpaces(text: string): string {
  const chars = Array.from(text);
  const letters = chars.filter((c) => c !== " ");
  for (let i = letters.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [letters[i], letters[j]] = [letters[j], letters[i]];
  }
  let letterIndex = 0;
  return chars.map((c) => (c === " " ? " " : (letters[letterIndex++] ?? ""))).join("");
}

// Sabotage Effect Components
function InkSplatter({ phase }: { phase: 'wind-up' | 'full' | 'wind-down' }) {
  const splatters = INK_SPLATTERS;

  const opacity = phase === 'wind-up' ? 0.4 : phase === 'wind-down' ? 0.2 : 1;

  return (
    <div 
      className="fixed inset-0 pointer-events-none z-40 transition-opacity duration-700"
      style={{ opacity }}
    >
      {splatters.map((splatter) => (
        <div
          key={splatter.id}
          className="absolute"
          style={{
            top: `${splatter.top}%`,
            left: `${splatter.left}%`,
            transform: `scale(${splatter.scale}) rotate(${splatter.rotation}deg)`,
            animationDelay: `${splatter.delay}s`,
            animation: `splat 0.4s ease-out forwards, ink-pulse ${splatter.pulseSpeed}s ease-in-out infinite`,
          }}
        >
          <svg width="200" height="200" viewBox="0 0 120 120">
            <path
              d="M60 10 Q80 30 90 60 Q85 90 60 100 Q30 95 20 60 Q25 25 60 10 M45 20 Q30 40 35 50 M75 25 Q90 35 85 55 M50 85 Q40 70 45 60"
              fill="rgba(0,0,0,0.95)"
              style={{ filter: 'blur(1px)' }}
            />
            <path
              d="M30 30 Q45 20 50 40 Q40 55 30 30"
              fill="rgba(0,0,0,0.9)"
            />
            <path
              d="M80 70 Q95 65 90 85 Q75 90 80 70"
              fill="rgba(0,0,0,0.9)"
            />
          </svg>
        </div>
      ))}
      {/* Dripping ink from top */}
      {Array.from({ length: 8 }, (_, i) => (
        <div
          key={`drip-${i}`}
          className="absolute top-0"
          style={{
            left: `${10 + i * 12}%`,
            width: '30px',
            height: '200px',
            background: 'linear-gradient(to bottom, rgba(0,0,0,0.9), transparent)',
            animation: `ink-drip 2s ease-in infinite`,
            animationDelay: `${i * 0.2}s`,
          }}
        />
      ))}
      <style jsx>{`
        @keyframes splat {
          0% { transform: scale(0) rotate(0deg); opacity: 0; }
          60% { transform: scale(1.3) rotate(10deg); opacity: 1; }
          100% { transform: scale(1) rotate(0deg); opacity: 1; }
        }
        @keyframes ink-pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.15); }
        }
        @keyframes ink-drip {
          0% { transform: translateY(-100%); opacity: 0; }
          20% { opacity: 1; }
          100% { transform: translateY(100vh); opacity: 0.5; }
        }
      `}</style>
    </div>
  );
}

function FloatingBubbles({ phase }: { phase: 'wind-up' | 'full' | 'wind-down' }) {
  const bubbles = FLOATING_BUBBLES;

  const opacity = phase === 'wind-up' ? 0.4 : phase === 'wind-down' ? 0.3 : 0.95;
  const scale = phase === 'wind-up' ? 0.5 : phase === 'wind-down' ? 0.6 : 1;

  return (
    <div 
      className="fixed inset-0 pointer-events-none overflow-hidden z-40 transition-all duration-500"
      style={{ opacity, transform: `scale(${scale})` }}
    >
      {bubbles.map((bubble) => (
        <div
          key={bubble.id}
          className="absolute rounded-full"
          style={{
            left: `${bubble.left}%`,
            bottom: "-200px",
            width: bubble.size,
            height: bubble.size,
            background: `radial-gradient(circle at 30% 30%, 
              rgba(255,255,255,0.9), 
              hsla(${bubble.hue}, 80%, 60%, 0.6), 
              hsla(${bubble.hue}, 70%, 50%, 0.3))`,
            border: "3px solid rgba(255,255,255,0.6)",
            boxShadow: `inset 0 0 30px rgba(255,255,255,0.4), 0 0 20px hsla(${bubble.hue}, 80%, 60%, 0.3)`,
            animation: `bubble-float-${bubble.id % 3} ${bubble.duration}s ease-in-out infinite`,
            animationDelay: `${bubble.delay}s`,
          }}
        />
      ))}
      <style jsx>{`
        @keyframes bubble-float-0 {
          0% { transform: translateY(0) translateX(0) scale(1); }
          25% { transform: translateY(-30vh) translateX(50px) scale(1.2); }
          50% { transform: translateY(-55vh) translateX(-40px) scale(0.9); }
          75% { transform: translateY(-80vh) translateX(60px) scale(1.1); }
          100% { transform: translateY(-115vh) translateX(-30px) scale(1); }
        }
        @keyframes bubble-float-1 {
          0% { transform: translateY(0) translateX(0) scale(1) rotate(0deg); }
          25% { transform: translateY(-28vh) translateX(-60px) scale(1.3) rotate(5deg); }
          50% { transform: translateY(-52vh) translateX(50px) scale(0.85) rotate(-5deg); }
          75% { transform: translateY(-78vh) translateX(-55px) scale(1.15) rotate(3deg); }
          100% { transform: translateY(-112vh) translateX(40px) scale(0.95) rotate(0deg); }
        }
        @keyframes bubble-float-2 {
          0% { transform: translateY(0) translateX(0) scale(1); }
          20% { transform: translateY(-22vh) translateX(70px) scale(1.25); }
          40% { transform: translateY(-45vh) translateX(-50px) scale(0.8); }
          60% { transform: translateY(-68vh) translateX(45px) scale(1.2); }
          80% { transform: translateY(-90vh) translateX(-60px) scale(0.9); }
          100% { transform: translateY(-115vh) translateX(20px) scale(1.05); }
        }
      `}</style>
    </div>
  );
}

function FallingEmojis({ phase }: { phase: 'wind-up' | 'full' | 'wind-down' }) {
  const emojis = FALLING_EMOJIS;

  const opacity = phase === 'wind-up' ? 0.5 : phase === 'wind-down' ? 0.3 : 1;
  const scale = phase === 'wind-up' ? 0.6 : phase === 'wind-down' ? 0.5 : 1;

  return (
    <div 
      className="fixed inset-0 pointer-events-none overflow-hidden z-40 transition-all duration-500"
      style={{ opacity, transform: `scale(${scale})` }}
    >
      {emojis.map((item) => (
        <div
          key={item.id}
          className="absolute"
          style={{
            left: `${item.left}%`,
            top: "-80px",
            fontSize: item.size,
            animation: `emoji-fall-${item.id % 4} ${item.duration}s linear infinite`,
            animationDelay: `${item.delay}s`,
            filter: 'drop-shadow(0 0 10px rgba(255,100,0,0.5))',
          }}
        >
          {item.emoji}
        </div>
      ))}
      <style jsx>{`
        @keyframes emoji-fall-0 {
          0% { transform: translateY(0) rotate(0deg) scale(1); }
          25% { transform: translateY(28vh) rotate(180deg) translateX(40px) scale(1.3); }
          50% { transform: translateY(55vh) rotate(360deg) translateX(-30px) scale(0.8); }
          75% { transform: translateY(82vh) rotate(540deg) translateX(35px) scale(1.2); }
          100% { transform: translateY(110vh) rotate(720deg) translateX(0) scale(1); }
        }
        @keyframes emoji-fall-1 {
          0% { transform: translateY(0) rotate(0deg) scale(1); }
          25% { transform: translateY(28vh) rotate(-90deg) translateX(-50px) scale(1.4); }
          50% { transform: translateY(55vh) rotate(-180deg) translateX(40px) scale(0.7); }
          75% { transform: translateY(82vh) rotate(-270deg) translateX(-45px) scale(1.25); }
          100% { transform: translateY(110vh) rotate(-360deg) translateX(0) scale(1); }
        }
        @keyframes emoji-fall-2 {
          0% { transform: translateY(0) rotate(0deg) scale(1); }
          20% { transform: translateY(22vh) rotate(144deg) translateX(60px) scale(1.5); }
          40% { transform: translateY(44vh) rotate(288deg) translateX(-50px) scale(0.6); }
          60% { transform: translateY(66vh) rotate(432deg) translateX(55px) scale(1.35); }
          80% { transform: translateY(88vh) rotate(576deg) translateX(-40px) scale(0.85); }
          100% { transform: translateY(110vh) rotate(720deg) translateX(0) scale(1); }
        }
        @keyframes emoji-fall-3 {
          0% { transform: translateY(0) rotate(0deg) scale(1.2); }
          33% { transform: translateY(37vh) rotate(-240deg) translateX(-70px) scale(0.6); }
          66% { transform: translateY(73vh) rotate(-480deg) translateX(65px) scale(1.4); }
          100% { transform: translateY(110vh) rotate(-720deg) translateX(0) scale(1); }
        }
      `}</style>
    </div>
  );
}

function StickyNotes({ phase }: { phase: 'wind-up' | 'full' | 'wind-down' }) {
  const notes = STICKY_NOTES;

  const opacity = phase === 'wind-up' ? 0.5 : phase === 'wind-down' ? 0.3 : 1;

  return (
    <div 
      className="fixed inset-0 pointer-events-none z-40 transition-opacity duration-700"
      style={{ opacity }}
    >
      {notes.map((note) => (
        <div
          key={note.id}
          className="absolute shadow-2xl"
          style={{
            top: `${note.top}%`,
            left: `${note.left}%`,
            width: `${note.size}px`,
            height: `${note.size}px`,
            backgroundColor: note.color,
            animationDelay: `${note.delay}s`,
            animation: `stick 0.5s ease-out forwards, note-wobble ${note.wobbleSpeed}s ease-in-out infinite`,
            boxShadow: `5px 5px 15px rgba(0,0,0,0.4)`,
          }}
        >
          <div className="w-full h-full flex items-center justify-center text-black font-extrabold text-base text-center p-3">
            {note.text}
          </div>
        </div>
      ))}
      <style jsx>{`
        @keyframes stick {
          0% { transform: scale(0) rotate(-180deg); opacity: 0; }
          50% { transform: scale(1.3) rotate(10deg); opacity: 1; }
          70% { transform: scale(0.9) rotate(-5deg); }
          100% { transform: scale(1) rotate(0deg); opacity: 1; }
        }
        @keyframes note-wobble {
          0%, 100% { transform: rotate(-3deg) translateY(0); }
          25% { transform: rotate(3deg) translateY(-5px); }
          50% { transform: rotate(-2deg) translateY(3px); }
          75% { transform: rotate(4deg) translateY(-3px); }
        }
      `}</style>
    </div>
  );
}

function FlyingCards({ phase }: { phase: 'wind-up' | 'full' | 'wind-down' }) {
  const cards = FLYING_CARDS;

  const opacity = phase === 'wind-up' ? 0.5 : phase === 'wind-down' ? 0.3 : 1;
  const scale = phase === 'wind-up' ? 0.6 : phase === 'wind-down' ? 0.5 : 1;

  return (
    <div 
      className="fixed inset-0 pointer-events-none overflow-hidden z-40 transition-all duration-500"
      style={{ opacity, transform: `scale(${scale})` }}
    >
      {cards.map((card) => (
        <div
          key={card.id}
          className="absolute bg-white rounded-lg shadow-2xl flex flex-col items-center justify-center"
          style={{
            top: `${card.startY}%`,
            left: card.fromLeft ? "-100px" : "auto",
            right: card.fromLeft ? "auto" : "-100px",
            width: `${70 * card.size}px`,
            height: `${98 * card.size}px`,
            animation: `card-fly-${card.fromLeft ? 'right' : 'left'}-${card.id % 3} ${card.duration}s linear infinite`,
            animationDelay: `${card.delay}s`,
            boxShadow: '0 10px 30px rgba(0,0,0,0.4)',
          }}
        >
          <span className={`text-2xl font-bold ${card.suit === "♥" || card.suit === "♦" ? "text-red-600" : "text-black"}`}
            style={{ fontSize: `${24 * card.size}px` }}>
            {card.value}
          </span>
          <span className={`text-3xl ${card.suit === "♥" || card.suit === "♦" ? "text-red-600" : "text-black"}`}
            style={{ fontSize: `${30 * card.size}px` }}>
            {card.suit}
          </span>
        </div>
      ))}
      <style jsx>{`
        @keyframes card-fly-right-0 {
          0% { transform: translateX(0) translateY(0) rotate(0deg); }
          25% { transform: translateX(30vw) translateY(-30px) rotate(180deg); }
          50% { transform: translateX(60vw) translateY(25px) rotate(360deg); }
          75% { transform: translateX(90vw) translateY(-20px) rotate(540deg); }
          100% { transform: translateX(120vw) translateY(0) rotate(720deg); }
        }
        @keyframes card-fly-right-1 {
          0% { transform: translateX(0) translateY(0) rotate(0deg) scale(1); }
          25% { transform: translateX(30vw) translateY(40px) rotate(-90deg) scale(1.2); }
          50% { transform: translateX(60vw) translateY(-35px) rotate(-180deg) scale(0.8); }
          75% { transform: translateX(90vw) translateY(30px) rotate(-270deg) scale(1.1); }
          100% { transform: translateX(120vw) translateY(0) rotate(-360deg) scale(1); }
        }
        @keyframes card-fly-right-2 {
          0% { transform: translateX(0) translateY(0) rotate(0deg); }
          20% { transform: translateX(24vw) translateY(-50px) rotate(144deg); }
          40% { transform: translateX(48vw) translateY(45px) rotate(288deg); }
          60% { transform: translateX(72vw) translateY(-40px) rotate(432deg); }
          80% { transform: translateX(96vw) translateY(35px) rotate(576deg); }
          100% { transform: translateX(120vw) translateY(0) rotate(720deg); }
        }
        @keyframes card-fly-left-0 {
          0% { transform: translateX(0) translateY(0) rotate(0deg); }
          25% { transform: translateX(-30vw) translateY(35px) rotate(-180deg); }
          50% { transform: translateX(-60vw) translateY(-30px) rotate(-360deg); }
          75% { transform: translateX(-90vw) translateY(25px) rotate(-540deg); }
          100% { transform: translateX(-120vw) translateY(0) rotate(-720deg); }
        }
        @keyframes card-fly-left-1 {
          0% { transform: translateX(0) translateY(0) rotate(0deg) scale(1); }
          25% { transform: translateX(-30vw) translateY(-45px) rotate(90deg) scale(1.15); }
          50% { transform: translateX(-60vw) translateY(40px) rotate(180deg) scale(0.85); }
          75% { transform: translateX(-90vw) translateY(-35px) rotate(270deg) scale(1.2); }
          100% { transform: translateX(-120vw) translateY(0) rotate(360deg) scale(1); }
        }
        @keyframes card-fly-left-2 {
          0% { transform: translateX(0) translateY(0) rotate(0deg); }
          20% { transform: translateX(-24vw) translateY(50px) rotate(-144deg); }
          40% { transform: translateX(-48vw) translateY(-45px) rotate(-288deg); }
          60% { transform: translateX(-72vw) translateY(40px) rotate(-432deg); }
          80% { transform: translateX(-96vw) translateY(-35px) rotate(-576deg); }
          100% { transform: translateX(-120vw) translateY(0) rotate(-720deg); }
        }
      `}</style>
    </div>
  );
}

// Sabotage effect renderer with phase support
function SabotageRenderer({ effect, phase }: { effect: SabotageEffect | null; phase: 'wind-up' | 'full' | 'wind-down' }) {
  if (!effect) return null;
  
  switch (effect) {
    case "sticky": return <StickyNotes phase={phase} />;
    default: return null;
  }
}

// Sabotage button data
const SABOTAGE_OPTIONS: { effect: SabotageEffect; label: string; emoji: string }[] = [
  { effect: "sticky", label: "Sticky", emoji: "📝" },
  { effect: "bounce", label: "Bounce", emoji: "🏓" },
  { effect: "trampoline", label: "Trampoline", emoji: "🤸" },
  { effect: "reverse", label: "Reverse", emoji: "🔄" },
];

// Props interface
interface ClassicDuelChallengeProps {
  duelId: string;
  duel: Doc<"challenges">;
  theme: Doc<"themes">;
  challenger: Doc<"users"> | null;
  opponent: Doc<"users"> | null;
}

export default function ClassicDuelChallenge({
  duelId,
  duel,
  theme,
  challenger,
  opponent,
}: ClassicDuelChallengeProps) {
  const router = useRouter();
  const { user } = useUser();
  
  const [selectedAnswerRaw, setSelectedAnswerRaw] = useState<string | null>(null);
  // Track which question index the selectedAnswer belongs to
  const selectedAnswerIndexRef = useRef<number | null>(null);
  const setSelectedAnswer = useCallback((val: string | null, forIndex?: number) => {
    selectedAnswerIndexRef.current = val === null ? null : (forIndex ?? activeQuestionIndexRef.current);
    setSelectedAnswerRaw(val);
  }, []);
  const [isLockedRaw, setIsLockedRaw] = useState(false);
  // Track which question index isLocked belongs to (same pattern as selectedAnswer)
  const isLockedIndexRef = useRef<number | null>(null);
  const setIsLocked = useCallback((val: boolean) => {
    isLockedIndexRef.current = val ? activeQuestionIndexRef.current : null;
    setIsLockedRaw(val);
  }, []);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [frozenData, setFrozenData] = useState<{
    word: string;
    correctAnswer: string;
    shuffledAnswers: string[];
    selectedAnswer: string | null;
    opponentAnswer: string | null;
    wordIndex: number;
    hasNoneOption: boolean;
    difficulty: { level: "easy" | "medium" | "hard"; points: number };
  } | null>(null);

  // Type reveal effect state for "None of the above" correct answer
  const [isRevealing, setIsRevealing] = useState(false);
  const [typedText, setTypedText] = useState("");
  const [revealComplete, setRevealComplete] = useState(false);

  // TTS audio playback state
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Sabotage effect state
  const [activeSabotage, setActiveSabotage] = useState<SabotageEffect | null>(null);
  const [sabotagePhase, setSabotagePhase] = useState<'wind-up' | 'full' | 'wind-down'>('wind-up');
  const lastSabotageTimestampRef = useRef<number | null>(null);
  const sabotageTimersRef = useRef<NodeJS.Timeout[]>([]);
  const reverseAnimationTimersRef = useRef<NodeJS.Timeout[]>([]);
  const [reverseAnimatedAnswers, setReverseAnimatedAnswers] = useState<string[] | null>(null);

  // Bouncing options state for "bounce" sabotage
  type BouncingOption = { id: number; x: number; y: number; vx: number; vy: number };
  const [bouncingOptions, setBouncingOptions] = useState<BouncingOption[]>([]);
  const bouncingPositionsRef = useRef<BouncingOption[]>([]);
  const bounceAnimationRef = useRef<number | null>(null);
  const BUTTON_WIDTH = 240;
  const BUTTON_HEIGHT = 80;
  const TRAMPOLINE_BUTTON_WIDTH = 240;
  const TRAMPOLINE_BUTTON_HEIGHT = 80;
  const TRAMPOLINE_FLY_SCALE = 1.2;

  // Trampoline options state for "trampoline" sabotage
  type TrampolineOption = {
    id: number;
    x: number;
    y: number;
    vx: number;
    vy: number;
    shakeOffset: { x: number; y: number };
    phase: 'shaking' | 'flying';
  };
  const [trampolineOptions, setTrampolineOptions] = useState<TrampolineOption[]>([]);
  const trampolinePositionsRef = useRef<TrampolineOption[]>([]);
  const trampolineAnimationRef = useRef<number | null>(null);
  
  // Helper to clear all sabotage timers and effect
  const clearSabotageEffect = useCallback(() => {
    sabotageTimersRef.current.forEach(timer => clearTimeout(timer));
    sabotageTimersRef.current = [];
    setActiveSabotage(null);
    setSabotagePhase('wind-up');
    // Clear bouncing animation
    if (bounceAnimationRef.current) {
      cancelAnimationFrame(bounceAnimationRef.current);
      bounceAnimationRef.current = null;
    }
    setBouncingOptions([]);
    bouncingPositionsRef.current = [];

    if (trampolineAnimationRef.current) {
      cancelAnimationFrame(trampolineAnimationRef.current);
      trampolineAnimationRef.current = null;
    }
    setTrampolineOptions([]);
    trampolinePositionsRef.current = [];
  }, []);

  const clearReverseAnimation = useCallback(() => {
    reverseAnimationTimersRef.current.forEach((timer) => clearTimeout(timer));
    reverseAnimationTimersRef.current = [];
    setReverseAnimatedAnswers(null);
  }, []);

  // Mutations
  const answer = useMutation(api.duel.answerDuel);
  const stopDuel = useMutation(api.duel.stopDuel);
  const requestHint = useMutation(api.duel.requestHint);
  const acceptHint = useMutation(api.duel.acceptHint);
  const eliminateOption = useMutation(api.duel.eliminateOption);
  const timeoutAnswer = useMutation(api.duel.timeoutAnswer);
  const sendSabotage = useMutation(api.duel.sendSabotage);
  const pauseCountdown = useMutation(api.duel.pauseCountdown);
  const requestUnpauseCountdown = useMutation(api.duel.requestUnpauseCountdown);
  const confirmUnpauseCountdown = useMutation(api.duel.confirmUnpauseCountdown);
  const skipCountdown = useMutation(api.duel.skipCountdown);
  
  // Question timer state (21 seconds total, display shows 20)
  const TIMER_DURATION = 21;
  const TRANSITION_DURATION = 5; // seconds; matches between-rounds countdown
  const [questionTimer, setQuestionTimer] = useState<number | null>(null);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const hasTimedOutRef = useRef(false);

  // Duel start time tracking for total duration
  const duelStartTimeRef = useRef<number | null>(null);
  const [duelDuration, setDuelDuration] = useState<number>(0);
  
  // Phase-based state machine for question flow
  const [phase, setPhase] = useState<'idle' | 'answering' | 'transition'>('idle');
  const activeQuestionIndexRef = useRef<number | null>(null);
  const lockedAnswerRef = useRef<string | null>(null);
  
  // Extract values
  const wordOrder = duel.wordOrder;
  const words = theme.words || [];
  const isCompleted = duel.status === "completed";
  const rawIndex = duel.currentWordIndex ?? 0;
  const index = isCompleted && words.length > 0 ? words.length - 1 : rawIndex;
  // Computed selectedAnswer that's only valid for the current question (prevents race condition)
  const selectedAnswer = (selectedAnswerIndexRef.current === index) ? selectedAnswerRaw : null;
  // Computed isLocked that's only valid for the current question (prevents race condition)
  const isLocked = (isLockedIndexRef.current === index) ? isLockedRaw : false;
  const actualWordIndex = wordOrder ? wordOrder[index] : index;
  const currentWord = words[actualWordIndex] || { word: "done", answer: "done", wrongAnswers: [] };
  const word = currentWord.word;
  
  // Calculate dynamic difficulty distribution
  const classicPreset = (duel.classicDifficultyPreset ?? "progressive") as ClassicDifficultyPreset;
  const difficultyDistribution = useMemo(() => 
    calculateClassicDifficultyDistribution(words.length, classicPreset), 
    [words.length, classicPreset]
  );

  const currentWordIndex = duel.currentWordIndex;
  
  // Unified transition effect
  useEffect(() => {
    if (currentWordIndex === undefined || !words.length) return;
    
    if (activeQuestionIndexRef.current === null) {
      activeQuestionIndexRef.current = currentWordIndex;
      setPhase('answering');
      return;
    }
    
    if (activeQuestionIndexRef.current === currentWordIndex) return;
    
    const prevIndex = activeQuestionIndexRef.current;
    const shouldShowTransition = isLocked || lockedAnswerRef.current || hasTimedOutRef.current;
    
    if (shouldShowTransition) {
      const prevActualIndex = wordOrder ? wordOrder[prevIndex] : prevIndex;
      const prevWord = words[prevActualIndex] || { word: "", answer: "", wrongAnswers: [] };
      
      const prevDistribution = calculateClassicDifficultyDistribution(words.length, classicPreset);
      const prevDifficultyData = getDifficultyForIndex(prevIndex, prevDistribution);
      const prevDifficulty = {
        level: prevDifficultyData.level,
        points: prevDifficultyData.points,
        wrongCount: prevDifficultyData.wrongCount,
      };
      
      let seed = prevWord.word.split('').reduce((acc: number, char: string, idx: number) => 
        acc + char.charCodeAt(0) * (idx + 1), 0);
      seed = seed + prevIndex * 7919;
      const random = () => {
        seed = (seed * 1103515245 + 12345) & 0x7fffffff;
        return seed / 0x7fffffff;
      };
      
      const allWrong = [...prevWord.wrongAnswers];
      for (let i = allWrong.length - 1; i > 0; i--) {
        const j = Math.floor(random() * (i + 1));
        [allWrong[i], allWrong[j]] = [allWrong[j], allWrong[i]];
      }
      const selectedWrong = allWrong.slice(0, prevDifficulty.wrongCount);
      
      let prevShuffled: string[];
      let prevHasNone = false;
      
      if (prevDifficulty.level === "hard") {
        const noneIsCorrect = random() < 0.5;
        if (noneIsCorrect) {
          prevShuffled = [...selectedWrong, "None of the above"];
          prevHasNone = true;
        } else {
          const fewerWrong = selectedWrong.slice(0, 3);
          prevShuffled = [prevWord.answer, ...fewerWrong, "None of the above"];
          prevHasNone = false;
        }
      } else {
        prevShuffled = [prevWord.answer, ...selectedWrong];
      }
      
      for (let i = prevShuffled.length - 1; i > 0; i--) {
        const j = Math.floor(random() * (i + 1));
        [prevShuffled[i], prevShuffled[j]] = [prevShuffled[j], prevShuffled[i]];
      }
      
      const userIsChallenger = challenger?.clerkId === user?.id;
      const opponentLastAnswer = userIsChallenger 
        ? duel.opponentLastAnswer 
        : duel.challengerLastAnswer;
      
      setPhase('transition');
      setFrozenData({
        word: prevWord.word,
        correctAnswer: prevWord.answer,
        shuffledAnswers: prevShuffled,
        selectedAnswer: lockedAnswerRef.current,
        opponentAnswer: opponentLastAnswer || null,
        wordIndex: prevIndex,
        hasNoneOption: prevHasNone,
        difficulty: prevDifficulty,
      });
      
      const isLastQuestion = prevIndex >= words.length - 1;
      if (!isLastQuestion) {
        setCountdown(5);
      }
    } else {
      setPhase('answering');
      setSelectedAnswer(null);
      setIsLocked(false);
      lockedAnswerRef.current = null;
      hasTimedOutRef.current = false;
    }
    
    activeQuestionIndexRef.current = currentWordIndex;
  }, [currentWordIndex, words, wordOrder, challenger?.clerkId, user?.id, duel.opponentLastAnswer, duel.challengerLastAnswer, isLocked, classicPreset]);
  
  // Countdown timer
  const countdownPausedBy = duel.countdownPausedBy;
  const countdownUnpauseRequestedBy = duel.countdownUnpauseRequestedBy;
  const countdownSkipRequestedBy = duel.countdownSkipRequestedBy || [];
  const prevCountdownPausedByRef = useRef<string | undefined>(countdownPausedBy);
  
  // Detect when unpause is confirmed (countdownPausedBy goes from truthy to undefined)
  // Reset countdown to 1 second when this happens
  useEffect(() => {
    const wasPaused = prevCountdownPausedByRef.current;
    const isNowUnpaused = !countdownPausedBy;
    
    if (wasPaused && isNowUnpaused && countdown !== null && phase === 'transition') {
      // Unpause confirmed - reset countdown to 1 second
      setCountdown(1);
    }
    
    prevCountdownPausedByRef.current = countdownPausedBy;
  }, [countdownPausedBy, countdown, phase]);
  
  useEffect(() => {
    if (countdown === null || phase !== 'transition') return;
    if (countdownPausedBy) return;
    
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    } else {
      if (duel.status !== "completed") {
        setPhase('answering');
        setFrozenData(null);
        setSelectedAnswer(null);
        setIsLocked(false);
        lockedAnswerRef.current = null;
        hasTimedOutRef.current = false;
        setIsRevealing(false);
        setTypedText("");
        setRevealComplete(false);
      }
      setCountdown(null);
    }
  }, [countdown, duel.status, countdownPausedBy, phase]);

  // Detect when both players have skipped - immediately proceed to next question
  useEffect(() => {
    if (countdown === null || phase !== 'transition') return;
    if (countdownSkipRequestedBy.includes("challenger") && countdownSkipRequestedBy.includes("opponent")) {
      // Both players skipped - immediately go to 0
      setCountdown(0);
    }
  }, [countdownSkipRequestedBy, countdown, phase]);

  // Type reveal effect
  useEffect(() => {
    if (!frozenData || !frozenData.hasNoneOption) return;
    const startDelay = setTimeout(() => setIsRevealing(true), 300);
    return () => clearTimeout(startDelay);
  }, [frozenData]);

  useEffect(() => {
    if (!isRevealing || !frozenData) return;
    
    const correctAnswer = frozenData.correctAnswer;
    setTypedText("");
    setRevealComplete(false);
    
    let i = 0;
    const interval = setInterval(() => {
      if (i < correctAnswer.length) {
        setTypedText(correctAnswer.slice(0, i + 1));
        i++;
      } else {
        setRevealComplete(true);
        clearInterval(interval);
      }
    }, 50);
    
    return () => clearInterval(interval);
  }, [isRevealing, frozenData]);

  // Monitor status for redirects
  useEffect(() => {
    const status = duel.status || "accepted";
    if (status === "stopped" || status === "rejected") {
      router.push('/');
    }
  }, [duel.status, router]);

  // Sabotage effect listener
  useEffect(() => {
    if (!challenger || !user) return;
    
    const isChallenger = challenger.clerkId === user.id;
    const mySabotage = isChallenger 
      ? duel.challengerSabotage 
      : duel.opponentSabotage;
    
    if (mySabotage && mySabotage.timestamp !== lastSabotageTimestampRef.current) {
      lastSabotageTimestampRef.current = mySabotage.timestamp;
      clearSabotageEffect();
      
      setSabotagePhase('wind-up');
      setActiveSabotage(mySabotage.effect as SabotageEffect);
      
      const sabotageEffect = mySabotage.effect as SabotageEffect;
      
      // Bounce + trampoline + reverse last until question ends, not just 7 seconds
      if (sabotageEffect === 'bounce' || sabotageEffect === 'trampoline' || sabotageEffect === 'reverse') {
        // For bounce/trampoline/reverse, skip phase transitions and duration timer - it will clear when question ends
        setSabotagePhase('full');
        sabotageTimersRef.current = [];
      } else {
        // Other effects follow the standard 7-second duration with phases
        const fullTimer = setTimeout(() => setSabotagePhase('full'), 2000);
        const windDownTimer = setTimeout(() => setSabotagePhase('wind-down'), 5000);
        const clearTimer = setTimeout(() => {
          setActiveSabotage(null);
          setSabotagePhase('wind-up');
        }, SABOTAGE_DURATION);
        
        sabotageTimersRef.current = [fullTimer, windDownTimer, clearTimer];
      }
    }
  }, [duel.challengerSabotage, duel.opponentSabotage, challenger?.clerkId, user?.id, clearSabotageEffect]);

  // Clear sabotage when locked
  useEffect(() => {
    if (isLocked && activeSabotage !== 'bounce' && activeSabotage !== 'trampoline' && activeSabotage !== 'reverse') {
      clearSabotageEffect();
    }
  }, [isLocked, activeSabotage, clearSabotageEffect]);

  useEffect(() => {
    if (phase === 'transition') clearSabotageEffect();
  }, [phase, clearSabotageEffect]);

  // Clear selected if eliminated
  useEffect(() => {
    const eliminated = duel.eliminatedOptions || [];
    if (selectedAnswer && eliminated.includes(selectedAnswer)) {
      setSelectedAnswer(null);
    }
  }, [duel.eliminatedOptions, selectedAnswer]);

  // Question timer - synced from server questionStartTime; can be paused during hints
  const prevPhaseRef = useRef<typeof phase | null>(null);

  // Reset timeout flag ONLY when transitioning into 'answering' phase
  useEffect(() => {
    const wasNotAnswering = prevPhaseRef.current !== 'answering';
    const isNowAnswering = phase === 'answering';
    prevPhaseRef.current = phase;
    
    if (wasNotAnswering && isNowAnswering) {
      hasTimedOutRef.current = false;
      
      // Capture duel start time on first question
      if (duelStartTimeRef.current === null) {
        duelStartTimeRef.current = Date.now();
      }
    }
  }, [phase]);

  // Calculate duel duration when completed
  useEffect(() => {
    if (duel.status === "completed" && duelStartTimeRef.current !== null) {
      const duration = Math.floor((Date.now() - duelStartTimeRef.current) / 1000);
      setDuelDuration(duration);
    }
  }, [duel.status]);
  
  // Timer countdown effect (uses server start time; freezes when paused)
  useEffect(() => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    
    const status = duel.status;
    const questionStartTime = duel.questionStartTime;
    
    if (phase !== 'answering' || status !== "accepted" || !questionStartTime) {
      setQuestionTimer(null);
      return;
    }
    
    const updateTimer = () => {
      const isFirstQuestion = (duel.currentWordIndex ?? 0) === 0;
      const transitionOffset = isFirstQuestion ? 0 : TRANSITION_DURATION * 1000;
      const effectiveStartTime = questionStartTime + transitionOffset;
      const now = duel.questionTimerPausedAt ?? Date.now();
      const elapsed = (now - effectiveStartTime) / 1000;
      const remaining = Math.max(0, TIMER_DURATION - elapsed);
      setQuestionTimer(remaining);
      
      if (remaining <= 0 && !hasTimedOutRef.current) {
        hasTimedOutRef.current = true;
        const userIsChallenger = challenger?.clerkId === user?.id;
        const hasAnswered = userIsChallenger 
          ? duel.challengerAnswered 
          : duel.opponentAnswered;
        
        if (!hasAnswered && duel._id && user?.id) {
          timeoutAnswer({ duelId: duel._id as any }).catch(console.error);
        }
      }
    };
    
    updateTimer();
    timerIntervalRef.current = setInterval(updateTimer, 100);
    
    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
    };
  }, [
    phase,
    duel.status,
    duel._id,
    duel.questionStartTime,
    duel.questionTimerPausedAt,
    duel.currentWordIndex,
    duel.challengerAnswered,
    duel.opponentAnswered,
    challenger?.clerkId,
    user?.id,
    timeoutAnswer,
  ]);

  // Difficulty
  const difficulty = useMemo(() => 
    getDifficultyForIndex(index, difficultyDistribution),
    [index, difficultyDistribution]
  );

  // Shuffle answers
  const { shuffledAnswers, hasNoneOption } = useMemo(() => {
    if (word === "done" || !currentWord.wrongAnswers?.length) {
      return { shuffledAnswers: [], hasNoneOption: false, correctAnswerPresent: true };
    }
    
    let seed = currentWord.word.split('').reduce((acc, char, idx) => 
      acc + char.charCodeAt(0) * (idx + 1), 0);
    seed = seed + index * 7919;
    const random = () => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return seed / 0x7fffffff;
    };
    
    const allWrong = [...currentWord.wrongAnswers];
    for (let i = allWrong.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [allWrong[i], allWrong[j]] = [allWrong[j], allWrong[i]];
    }
    
    const selectedWrong = allWrong.slice(0, difficulty.wrongCount);
    
    let answers: string[];
    let hasNone = false;
    
    if (difficulty.level === "hard") {
      const noneIsCorrect = random() < 0.5;
      if (noneIsCorrect) {
        answers = [...selectedWrong, "None of the above"];
        hasNone = true;
      } else {
        const fewerWrong = selectedWrong.slice(0, 3);
        answers = [currentWord.answer, ...fewerWrong, "None of the above"];
        hasNone = false;
      }
    } else {
      answers = [currentWord.answer, ...selectedWrong];
    }
    
    for (let i = answers.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [answers[i], answers[j]] = [answers[j], answers[i]];
    }
    
    return { shuffledAnswers: answers, hasNoneOption: hasNone };
  }, [currentWord.word, currentWord.answer, currentWord.wrongAnswers, word, index, difficulty]);

  // Reverse sabotage animation: scramble then settle into reversed text (wrong options only)
  useEffect(() => {
    if (activeSabotage !== "reverse") {
      clearReverseAnimation();
      return;
    }

    const displayAnswers = frozenData ? frozenData.shuffledAnswers : shuffledAnswers;
    if (!displayAnswers.length) {
      clearReverseAnimation();
      return;
    }

    clearReverseAnimation();
    setReverseAnimatedAnswers([...displayAnswers]);

    const HOLD_MS = 140;
    const SCRAMBLE_MS = 420;
    const SCRAMBLE_TICK_MS = 50;

    let scrambleStartedAt: number | null = null;
    const tick = () => {
      if (scrambleStartedAt === null) scrambleStartedAt = Date.now();
      const elapsed = Date.now() - scrambleStartedAt;
      if (elapsed >= SCRAMBLE_MS) {
        setReverseAnimatedAnswers(displayAnswers.map((ans) => reverseText(ans)));
        return;
      }

      setReverseAnimatedAnswers(displayAnswers.map((ans) => scrambleTextKeepSpaces(ans)));
      const t = setTimeout(tick, SCRAMBLE_TICK_MS);
      reverseAnimationTimersRef.current.push(t);
    };

    const startScramble = setTimeout(tick, HOLD_MS);
    reverseAnimationTimersRef.current.push(startScramble);

    return () => clearReverseAnimation();
  }, [
    activeSabotage,
    frozenData,
    shuffledAnswers,
    clearReverseAnimation,
  ]);

  // Bounce animation effect - initialize and animate when bounce sabotage is active
  useEffect(() => {
    if (activeSabotage !== 'bounce') {
      // Clean up when bounce ends - only if there's something to clean
      if (bounceAnimationRef.current) {
        cancelAnimationFrame(bounceAnimationRef.current);
        bounceAnimationRef.current = null;
      }
      if (bouncingPositionsRef.current.length > 0) {
        setBouncingOptions([]);
        bouncingPositionsRef.current = [];
      }
      return;
    }

    // Initialize bouncing positions for each option
    const optionCount = (frozenData ? frozenData.shuffledAnswers : shuffledAnswers).length;
    if (optionCount === 0) return;

    const screenWidth = typeof window !== 'undefined' ? window.innerWidth : 800;
    const screenHeight = typeof window !== 'undefined' ? window.innerHeight : 600;

    // Initialize with random positions and velocities
    const initialPositions: BouncingOption[] = Array.from({ length: optionCount }, (_, i) => ({
      id: i,
      x: Math.random() * (screenWidth - BUTTON_WIDTH),
      y: 100 + Math.random() * (screenHeight - BUTTON_HEIGHT - 200),
      vx: (Math.random() - 0.5) * 8,
      vy: (Math.random() - 0.5) * 8,
    }));

    bouncingPositionsRef.current = initialPositions;
    setBouncingOptions(initialPositions);

    const animate = () => {
      const sw = window.innerWidth;
      const sh = window.innerHeight;

      bouncingPositionsRef.current = bouncingPositionsRef.current.map((opt) => {
        let { x, y, vx, vy } = opt;

        // Move by velocity each frame
        x += vx;
        y += vy;

        // Bounce off left/right edges
        if (x <= 0) {
          x = 0;
          vx = Math.abs(vx);
        } else if (x >= sw - BUTTON_WIDTH) {
          x = sw - BUTTON_WIDTH;
          vx = -Math.abs(vx);
        }

        // Bounce off top/bottom edges
        if (y <= 0) {
          y = 0;
          vy = Math.abs(vy);
        } else if (y >= sh - BUTTON_HEIGHT) {
          y = sh - BUTTON_HEIGHT;
          vy = -Math.abs(vy);
        }

        return { ...opt, x, y, vx, vy };
      });

      setBouncingOptions([...bouncingPositionsRef.current]);
      bounceAnimationRef.current = requestAnimationFrame(animate);
    };

    bounceAnimationRef.current = requestAnimationFrame(animate);

    return () => {
      if (bounceAnimationRef.current) {
        cancelAnimationFrame(bounceAnimationRef.current);
        bounceAnimationRef.current = null;
      }
    };
  }, [activeSabotage, frozenData, shuffledAnswers]);

  // Trampoline animation effect - shake, then gravity + bottom impulse bounce
  useEffect(() => {
    if (activeSabotage !== 'trampoline') {
      if (trampolineAnimationRef.current) {
        cancelAnimationFrame(trampolineAnimationRef.current);
        trampolineAnimationRef.current = null;
      }
      if (trampolinePositionsRef.current.length > 0) {
        setTrampolineOptions([]);
        trampolinePositionsRef.current = [];
      }
      return;
    }

    const optionCount = (frozenData ? frozenData.shuffledAnswers : shuffledAnswers).length;
    if (optionCount === 0) return;

    const screenWidth = typeof window !== 'undefined' ? window.innerWidth : 800;
    const screenHeight = typeof window !== 'undefined' ? window.innerHeight : 600;

    const cols = 2;
    const gapX = 12;
    const gapY = 12;
    const rows = Math.ceil(optionCount / cols);
    const gridWidth = cols * TRAMPOLINE_BUTTON_WIDTH + (cols - 1) * gapX;
    const gridHeight = rows * TRAMPOLINE_BUTTON_HEIGHT + (rows - 1) * gapY;
    const baseX = Math.max(10, (screenWidth - gridWidth) / 2);
    const baseY = Math.max(120, (screenHeight - gridHeight) / 2);

    const initialPositions: TrampolineOption[] = Array.from({ length: optionCount }, (_, i) => {
      const row = Math.floor(i / cols);
      const col = i % cols;
      return {
        id: i,
        x: baseX + col * (TRAMPOLINE_BUTTON_WIDTH + gapX),
        y: baseY + row * (TRAMPOLINE_BUTTON_HEIGHT + gapY),
        vx: 0,
        vy: 0,
        shakeOffset: { x: 0, y: 0 },
        phase: 'shaking',
      };
    });

    trampolinePositionsRef.current = initialPositions;
    setTrampolineOptions(initialPositions);

    const SHAKE_MS = 1000;
    const SHAKE_FREQ_HZ = 2.25;
    const SHAKE_AMPLITUDE_PX = 4;
    const GRAVITY = 0.35;
    const TIME_SCALE = 0.7;
    const AIR_DRAG = 0.99;
    const WALL_BOUNCE_DAMPING = 0.9;
    const shakeStartedAt = performance.now();
    let lastFrameAt = shakeStartedAt;

    const animate = (now: number) => {
      const sw = window.innerWidth;
      const sh = window.innerHeight;
      const elapsed = now - shakeStartedAt;
      const dt = Math.min(2, Math.max(0.5, (now - lastFrameAt) / 16.67));
      const simDt = dt * TIME_SCALE;
      lastFrameAt = now;

      trampolinePositionsRef.current = trampolinePositionsRef.current.map((opt) => {
        let { x, y, vx, vy, shakeOffset, phase } = opt;

        const effectiveWidth = TRAMPOLINE_BUTTON_WIDTH * (phase === 'flying' ? TRAMPOLINE_FLY_SCALE : 1);
        const effectiveHeight = TRAMPOLINE_BUTTON_HEIGHT * (phase === 'flying' ? TRAMPOLINE_FLY_SCALE : 1);

        if (phase === 'shaking') {
          const t = elapsed / 1000;
          const amp = SHAKE_AMPLITUDE_PX * Math.min(1, elapsed / SHAKE_MS);
          shakeOffset = {
            x: amp * Math.sin(2 * Math.PI * SHAKE_FREQ_HZ * t + opt.id * 0.9),
            y: amp * Math.cos(2 * Math.PI * SHAKE_FREQ_HZ * t + opt.id * 1.3),
          };

          if (elapsed >= SHAKE_MS) {
            phase = 'flying';
            shakeOffset = { x: 0, y: 0 };
            {
              const bigKick = Math.random() < 0.3;
              const mag = bigKick ? (6 + Math.random() * 8) : (2 + Math.random() * 5);
              vx = (Math.random() < 0.5 ? -1 : 1) * mag;
            }
            vy = -(7 + Math.random() * 8);
          }
        } else {
          vy += GRAVITY * simDt;
          x += vx * simDt;
          y += vy * simDt;
          vx *= Math.pow(AIR_DRAG, simDt);

          if (x <= 0) {
            x = 0;
            vx = Math.abs(vx) * WALL_BOUNCE_DAMPING;
          } else if (x >= sw - effectiveWidth) {
            x = sw - effectiveWidth;
            vx = -Math.abs(vx) * WALL_BOUNCE_DAMPING;
          }

          if (y >= sh - effectiveHeight) {
            y = sh - effectiveHeight;
            const targetHeight = sh * (0.55 + Math.random() * 0.35);
            const impulse = Math.sqrt(2 * GRAVITY * targetHeight) * (0.9 + Math.random() * 0.25);
            vy = -impulse;
            {
              const bigKick = Math.random() < 0.25;
              const mag = bigKick ? (5 + Math.random() * 9) : (1.5 + Math.random() * 4.5);
              vx += (Math.random() < 0.5 ? -1 : 1) * mag;
            }
          }
        }

        return { ...opt, x, y, vx, vy, shakeOffset, phase };
      });

      setTrampolineOptions([...trampolinePositionsRef.current]);
      trampolineAnimationRef.current = requestAnimationFrame(animate);
    };

    trampolineAnimationRef.current = requestAnimationFrame(animate);

    return () => {
      if (trampolineAnimationRef.current) {
        cancelAnimationFrame(trampolineAnimationRef.current);
        trampolineAnimationRef.current = null;
      }
    };
  }, [activeSabotage, frozenData, shuffledAnswers]);

  if (!user) return <div className="min-h-screen bg-gray-900 flex items-center justify-center text-white">Sign in first.</div>;

  const status = duel.status || "accepted";

  // Check role
  const isChallenger = challenger?.clerkId === user.id;
  const isOpponent = opponent?.clerkId === user.id;
  
  if (!isChallenger && !isOpponent) {
    return <div className="min-h-screen bg-gray-900 flex items-center justify-center text-white">You&apos;re not part of this duel</div>;
  }

  // Raw hasAnswered from server (may be stale during question transitions)
  const hasAnsweredRaw = (isChallenger && duel.challengerAnswered) || 
                     (isOpponent && duel.opponentAnswered);
  // Computed hasAnswered that's only valid for the current question (prevents race condition)
  // We already set isLockedIndexRef when user confirms answer, so hasAnswered should only be true
  // if the lock was set for the current question
  const hasAnswered = hasAnsweredRaw && (isLockedIndexRef.current === index);
  const opponentHasAnswered = (isChallenger && duel.opponentAnswered) || 
                              (isOpponent && duel.challengerAnswered);

  // Hint system state
  const myRole = isChallenger ? "challenger" : "opponent";
  const theirRole = isChallenger ? "opponent" : "challenger";
  const hintRequestedBy = duel.hintRequestedBy;
  const hintAccepted = duel.hintAccepted;
  const eliminatedOptions = duel.eliminatedOptions || [];
  
  const canRequestHint = !hasAnswered && opponentHasAnswered && !hintRequestedBy;
  const iRequestedHint = hintRequestedBy === myRole;
  const theyRequestedHint = hintRequestedBy === theirRole;
  const canAcceptHint = hasAnswered && theyRequestedHint && !hintAccepted;
  const isHintProvider = hasAnswered && theyRequestedHint && hintAccepted;
  const canEliminate = isHintProvider && eliminatedOptions.length < 2;

  const inTransition = phase === 'transition' && !!frozenData;
  const showListenButton = (hasAnswered || isLocked || inTransition) && ((frozenData?.word ?? word) !== 'done');
  const outgoingSabotage = isChallenger ? duel.opponentSabotage : duel.challengerSabotage;
  const isOutgoingSabotageActive = (() => {
    if (!outgoingSabotage) return false;
    if (outgoingSabotage.effect === "sticky") {
      return Date.now() - outgoingSabotage.timestamp < SABOTAGE_DURATION;
    }
    if (
      outgoingSabotage.effect === "bounce" ||
      outgoingSabotage.effect === "trampoline" ||
      outgoingSabotage.effect === "reverse"
    ) {
      return typeof duel.questionStartTime === "number"
        ? outgoingSabotage.timestamp >= duel.questionStartTime
        : Date.now() - outgoingSabotage.timestamp < 25000;
    }
    return false;
  })();

  const handleStopDuel = async () => {
    try {
      await stopDuel({ duelId: duel._id as any });
      router.push('/');
    } catch (error) {
      console.error("Failed to stop duel:", error);
    }
  };

  const handleConfirmAnswer = async () => {
    if (!selectedAnswer) return;
    lockedAnswerRef.current = selectedAnswer;
    setIsLocked(true);
    try {
      await answer({ duelId: duel._id as any, selectedAnswer });
    } catch (error) {
      console.error("Failed to submit answer:", error);
      setIsLocked(false);
      lockedAnswerRef.current = null;
    }
  };

  const handleRequestHint = async () => {
    try {
      await requestHint({ duelId: duel._id as any });
    } catch (error) {
      console.error("Failed to request hint:", error);
    }
  };

  const handleAcceptHint = async () => {
    try {
      await acceptHint({ duelId: duel._id as any });
    } catch (error) {
      console.error("Failed to accept hint:", error);
    }
  };

  const handleEliminateOption = async (option: string) => {
    try {
      await eliminateOption({ duelId: duel._id as any, option });
    } catch (error) {
      console.error("Failed to eliminate option:", error);
    }
  };

  const handleSendSabotage = async (effect: SabotageEffect) => {
    try {
      await sendSabotage({ duelId: duel._id as any, effect });
    } catch (error) {
      console.error("Failed to send sabotage:", error);
    }
  };

  const handlePlayAudio = async () => {
    const correctAnswer = frozenData ? frozenData.correctAnswer : currentWord.answer;
    if (isPlayingAudio || !correctAnswer || correctAnswer === "done") return;
    
    setIsPlayingAudio(true);
    try {
      const response = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: correctAnswer }),
      });
      
      if (!response.ok) throw new Error('TTS request failed');
      
      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);
      
      if (audioRef.current) audioRef.current.pause();
      
      const audio = new Audio(audioUrl);
      audioRef.current = audio;
      
      audio.onended = () => {
        setIsPlayingAudio(false);
        URL.revokeObjectURL(audioUrl);
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

  // Scores
  const challengerScore = duel.challengerScore || 0;
  const opponentScore = duel.opponentScore || 0;
  const myScore = isChallenger ? challengerScore : opponentScore;
  const theirScore = isChallenger ? opponentScore : challengerScore;
  const myName = isChallenger ? (challenger?.name || challenger?.email) : (opponent?.name || opponent?.email);
  const theirName = isChallenger ? (opponent?.name || opponent?.email) : (challenger?.name || challenger?.email);

  const mySabotagesUsed = isChallenger 
    ? (duel.challengerSabotagesUsed || 0) 
    : (duel.opponentSabotagesUsed || 0);
  const sabotagesRemaining = MAX_SABOTAGES - mySabotagesUsed;

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 relative p-4 pb-28 bg-gray-900 text-white">
      <SabotageRenderer effect={activeSabotage} phase={sabotagePhase} />
      
      {status !== "completed" && (
        <button
          onClick={handleStopDuel}
          className="absolute top-4 right-4 bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-4 rounded"
        >
          Exit Duel
        </button>
      )}
      
      {/* Scoreboard */}
      <div className="absolute top-4 left-4 bg-gray-800 rounded-lg p-4 min-w-[200px]">
        <div className="text-sm text-gray-400 mb-2">Scoreboard</div>
        <div className="flex justify-between items-center mb-1">
          <span className="text-green-400 font-medium">You ({myName?.split(' ')[0] || 'You'})</span>
          <span className="text-2xl font-bold text-green-400">{Number.isInteger(myScore) ? myScore : myScore.toFixed(1)}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-blue-400 font-medium">{theirName?.split(' ')[0] || 'Opponent'}</span>
          <span className="text-2xl font-bold text-blue-400">{Number.isInteger(theirScore) ? theirScore : theirScore.toFixed(1)}</span>
        </div>
      </div>

      <div className="text-center">
        <h1 className="text-2xl font-bold mb-2">Classic Duel</h1>
        <div className="mb-4">
          <div className="text-sm text-gray-400">
            {challenger?.name || challenger?.email} vs {opponent?.name || opponent?.email}
          </div>
        </div>
      </div>

      <div className="text-center">
        <div className="text-lg mb-2">Word #{(frozenData ? frozenData.wordIndex : index) + 1} of {words.length}</div>
        
        {/* Difficulty indicator */}
        <div className="mb-2">
          {(() => {
            const currentDifficulty = frozenData ? frozenData.difficulty : difficulty;
            const levelColors = {
              easy: "text-green-400 bg-green-500/20 border-green-500",
              medium: "text-yellow-400 bg-yellow-500/20 border-yellow-500",
              hard: "text-red-400 bg-red-500/20 border-red-500",
            };
            return (
              <span className={`inline-block px-3 py-1 rounded-full border text-sm font-medium ${levelColors[currentDifficulty.level]}`}>
                {currentDifficulty.level.toUpperCase()} (+{currentDifficulty.points === 1 ? "1" : currentDifficulty.points} pts)
              </span>
            );
          })()}
        </div>
        
        {/* Question Timer */}
        {questionTimer !== null && phase === 'answering' && (
          <div className="mb-3">
            <div className={`text-4xl font-bold tabular-nums ${
              questionTimer <= 4 ? 'text-red-500 animate-pulse' : 
              questionTimer <= 8 ? 'text-yellow-400' : 
              'text-white'
            }`}>
              {Math.max(0, Math.min(20, Math.ceil(questionTimer - 1)))}
            </div>
            <div className="text-xs text-gray-400 mt-1">
              seconds remaining
              {duel.questionTimerPausedAt && (
                <span className="ml-2 text-purple-400">Paused (hint)</span>
              )}
            </div>
          </div>
        )}
        <div className="text-3xl font-bold mb-2">{frozenData ? frozenData.word : word}</div>
        {phase === "answering" && activeSabotage === "reverse" && (
          <div className="mb-4 text-sm font-medium text-purple-300 tracking-wide">🔄 REVERSED</div>
        )}
      </div>

      {/* Countdown with pause and skip controls */}
      {countdown !== null && frozenData && (
        <div className="flex flex-col items-center gap-2 mb-2">
          <div className={`text-2xl font-bold ${countdownPausedBy ? 'text-orange-400' : 'text-yellow-400'}`}>
            {countdownPausedBy ? 'PAUSED' : `Next question in ${countdown}...`}
          </div>
          
          {(() => {
            const userRole = isChallenger ? "challenger" : "opponent";
            const opponentRole = isChallenger ? "opponent" : "challenger";
            const iHaveSkipped = countdownSkipRequestedBy.includes(userRole);
            const opponentHasSkipped = countdownSkipRequestedBy.includes(opponentRole);
            
            if (!countdownPausedBy) {
              return (
                <div className="flex flex-col items-center gap-2">
                  <div className="flex gap-2">
                    <button
                      onClick={() => pauseCountdown({ duelId: duel._id as any }).catch(console.error)}
                      className="px-4 py-2 rounded-lg bg-orange-500 hover:bg-orange-600 text-white font-medium transition-colors"
                    >
                      ⏸ Pause
                    </button>
                    <button
                      onClick={() => skipCountdown({ duelId: duel._id as any }).catch(console.error)}
                      disabled={iHaveSkipped}
                      className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                        iHaveSkipped 
                          ? 'bg-gray-600 text-gray-400 cursor-not-allowed' 
                          : opponentHasSkipped
                            ? 'bg-green-500 hover:bg-green-600 text-white animate-pulse'
                            : 'bg-blue-500 hover:bg-blue-600 text-white'
                      }`}
                    >
                      ⏭ Skip
                    </button>
                  </div>
                  {opponentHasSkipped && !iHaveSkipped && (
                    <div className="text-sm text-green-400 animate-pulse">Opponent wants to skip!</div>
                  )}
                  {iHaveSkipped && !opponentHasSkipped && (
                    <div className="text-sm text-gray-400">Waiting for opponent to skip...</div>
                  )}
                </div>
              );
            }
            
            if (countdownUnpauseRequestedBy) {
              if (countdownUnpauseRequestedBy === userRole) {
                return (
                  <div className="flex flex-col items-center gap-1">
                    <div className="text-sm text-gray-400">Waiting for opponent to confirm...</div>
                    <button disabled className="px-4 py-2 rounded-lg bg-gray-600 text-gray-400 font-medium cursor-not-allowed">
                      ▶ Unpause Requested
                    </button>
                  </div>
                );
              } else {
                return (
                  <div className="flex flex-col items-center gap-1">
                    <div className="text-sm text-yellow-400">Opponent wants to resume!</div>
                    <button
                      onClick={() => confirmUnpauseCountdown({ duelId: duel._id as any }).catch(console.error)}
                      className="px-4 py-2 rounded-lg bg-green-500 hover:bg-green-600 text-white font-medium transition-colors animate-pulse"
                    >
                      ✓ Confirm Unpause
                    </button>
                  </div>
                );
              }
            }
            
            return (
              <button
                onClick={() => requestUnpauseCountdown({ duelId: duel._id as any }).catch(console.error)}
                className="px-4 py-2 rounded-lg bg-green-500 hover:bg-green-600 text-white font-medium transition-colors"
              >
                ▶ Unpause
              </button>
            );
          })()}
        </div>
      )}

      {/* TTS Listen button */}
      {showListenButton && (
        <button
          onClick={handlePlayAudio}
          disabled={isPlayingAudio}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all mb-2 ${
            isPlayingAudio ? 'bg-green-600 text-white cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 text-white'
          }`}
        >
          <span className="text-xl">{isPlayingAudio ? '🔊' : '🔈'}</span>
          <span>{isPlayingAudio ? 'Playing...' : 'Listen'}</span>
        </button>
      )}

      {/* Answer Options */}
      {(frozenData ? frozenData.word : word) !== "done" && (
        <>
          {/* Normal grid layout when NOT bouncing */}
          {activeSabotage !== 'bounce' && activeSabotage !== 'trampoline' && (
            <div className="grid grid-cols-2 gap-3 w-full max-w-md mb-4">
              {(frozenData ? frozenData.shuffledAnswers : shuffledAnswers).map((ans, i) => {
                const displaySelectedAnswer = frozenData ? frozenData.selectedAnswer : selectedAnswer;
                const displayCorrectAnswer = frozenData ? frozenData.correctAnswer : currentWord.answer;
                const displayHasNone = frozenData ? frozenData.hasNoneOption : hasNoneOption;
                const isShowingFeedback = hasAnswered || isLocked || frozenData || status === "completed";
                const isEliminated = eliminatedOptions.includes(ans);
                const isNoneOfAbove = ans === "None of the above";
                const isWrongAnswer = isNoneOfAbove ? !displayHasNone : ans !== displayCorrectAnswer;
                const canEliminateThis = canEliminate && isWrongAnswer && !isEliminated;
                const isCorrectOption = displayHasNone ? ans === "None of the above" : ans === displayCorrectAnswer;
                const displayedAnswer =
                  activeSabotage === "reverse"
                    ? reverseAnimatedAnswers?.[i] ?? reverseText(ans)
                    : ans;
                
                const handleClick = () => {
                  if (phase !== 'answering') return;
                  if (canEliminateThis) {
                    handleEliminateOption(ans);
                  } else if (!hasAnswered && !isLocked && !isEliminated) {
                    setSelectedAnswer(ans, index);
                  }
                };
                
                const opponentLastAnswer = isChallenger ? duel.opponentLastAnswer : duel.challengerLastAnswer;
                const opponentPickedThis = frozenData 
                  ? frozenData.opponentAnswer === ans
                  : (status === "completed" && opponentLastAnswer === ans);
                
                return (
                  <button
                    key={i}
                    disabled={!!isShowingFeedback && !canEliminateThis || isEliminated}
                    onClick={handleClick}
                    className={`p-4 rounded-lg border-2 text-lg font-medium transition-all relative ${
                      isEliminated
                        ? 'border-gray-700 bg-gray-900 text-gray-600 line-through opacity-40 cursor-not-allowed'
                        : canEliminateThis
                          ? 'border-orange-500 bg-orange-500/20 text-orange-400 hover:bg-orange-500/30 cursor-pointer animate-pulse'
                          : isShowingFeedback
                            ? displaySelectedAnswer === ans
                              ? isCorrectOption
                                ? 'border-green-500 bg-green-500/20 text-green-400'
                                : 'border-red-500 bg-red-500/20 text-red-400'
                              : isCorrectOption
                                ? 'border-green-500 bg-green-500/10 text-green-400'
                                : 'border-gray-600 bg-gray-800 text-gray-400 opacity-50'
                            : selectedAnswer === ans
                              ? 'border-blue-500 bg-blue-500/20 text-blue-400'
                              : 'border-gray-600 bg-gray-800 hover:border-gray-500 text-white'
                    }`}
                  >
                    {isNoneOfAbove && displayHasNone && isRevealing && frozenData ? (
                      <span className="font-medium">
                        {typedText}
                        {!revealComplete && <span className="animate-pulse">|</span>}
                      </span>
                    ) : (
                      displayedAnswer
                    )}
                    {canEliminateThis && (
                      <span className="absolute -top-2 -right-2 bg-orange-500 text-white text-xs px-1.5 py-0.5 rounded-full">✕</span>
                    )}
                    {opponentPickedThis && (
                      <span className="absolute -top-2 -left-2 bg-blue-500 text-white text-xs px-1.5 py-0.5 rounded-full">👤</span>
                    )}
                    {isNoneOfAbove && displayHasNone && isShowingFeedback && (
                      <span className="absolute top-2 right-2 text-green-400">✓</span>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {/* Bouncing options when bounce sabotage is active */}
          {activeSabotage === 'bounce' && bouncingOptions.length > 0 && (
            <div className="fixed inset-0 z-50 pointer-events-none">
              {(frozenData ? frozenData.shuffledAnswers : shuffledAnswers).map((ans, i) => {
                const bouncePos = bouncingOptions[i];
                if (!bouncePos) return null;

                const displaySelectedAnswer = frozenData ? frozenData.selectedAnswer : selectedAnswer;
                const displayCorrectAnswer = frozenData ? frozenData.correctAnswer : currentWord.answer;
                const displayHasNone = frozenData ? frozenData.hasNoneOption : hasNoneOption;
                const isShowingFeedback = hasAnswered || isLocked || frozenData || status === "completed";
                const isEliminated = eliminatedOptions.includes(ans);
                const isNoneOfAbove = ans === "None of the above";
                const isWrongAnswer = isNoneOfAbove ? !displayHasNone : ans !== displayCorrectAnswer;
                const canEliminateThis = canEliminate && isWrongAnswer && !isEliminated;
                const isCorrectOption = displayHasNone ? ans === "None of the above" : ans === displayCorrectAnswer;
                
                const handleClick = () => {
                  if (phase !== 'answering') return;
                  if (canEliminateThis) {
                    handleEliminateOption(ans);
                  } else if (!hasAnswered && !isLocked && !isEliminated) {
                    setSelectedAnswer(ans, index);
                  }
                };
                
                const opponentLastAnswer = isChallenger ? duel.opponentLastAnswer : duel.challengerLastAnswer;
                const opponentPickedThis = frozenData 
                  ? frozenData.opponentAnswer === ans
                  : (status === "completed" && opponentLastAnswer === ans);
                
                return (
                  <button
                    key={i}
                    disabled={!!isShowingFeedback && !canEliminateThis || isEliminated}
                    onClick={handleClick}
                    style={{
                      position: 'absolute',
                      left: bouncePos.x,
                      top: bouncePos.y,
                      width: BUTTON_WIDTH,
                      height: BUTTON_HEIGHT,
                      pointerEvents: 'auto',
                    }}
                    className={`p-4 rounded-lg border-2 text-base font-medium transition-colors relative shadow-lg ${
                      isEliminated
                        ? 'border-gray-700 bg-gray-900 text-gray-600 line-through opacity-40 cursor-not-allowed'
                        : canEliminateThis
                          ? 'border-orange-500 bg-orange-500/20 text-orange-400 hover:bg-orange-500/30 cursor-pointer animate-pulse'
                          : isShowingFeedback
                            ? displaySelectedAnswer === ans
                              ? isCorrectOption
                                ? 'border-green-500 bg-green-500/20 text-green-400'
                                : 'border-red-500 bg-red-500/20 text-red-400'
                              : isCorrectOption
                                ? 'border-green-500 bg-green-500/10 text-green-400'
                                : 'border-gray-600 bg-gray-800 text-gray-400 opacity-50'
                            : selectedAnswer === ans
                              ? 'border-blue-500 bg-blue-500/20 text-blue-400'
                              : 'border-gray-600 bg-gray-800/95 hover:border-gray-500 text-white'
                    }`}
                  >
                    <span className="truncate block">{ans}</span>
                    {canEliminateThis && (
                      <span className="absolute -top-2 -right-2 bg-orange-500 text-white text-xs px-1.5 py-0.5 rounded-full">✕</span>
                    )}
                    {opponentPickedThis && (
                      <span className="absolute -top-2 -left-2 bg-blue-500 text-white text-xs px-1.5 py-0.5 rounded-full">👤</span>
                    )}
                    {isNoneOfAbove && displayHasNone && isShowingFeedback && (
                      <span className="absolute top-2 right-2 text-green-400">✓</span>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {/* Trampoline options when trampoline sabotage is active */}
          {activeSabotage === 'trampoline' && trampolineOptions.length > 0 && (
            <div className="fixed inset-0 z-50 pointer-events-none">
              {(frozenData ? frozenData.shuffledAnswers : shuffledAnswers).map((ans, i) => {
                const trampPos = trampolineOptions[i];
                if (!trampPos) return null;

                const displaySelectedAnswer = frozenData ? frozenData.selectedAnswer : selectedAnswer;
                const displayCorrectAnswer = frozenData ? frozenData.correctAnswer : currentWord.answer;
                const displayHasNone = frozenData ? frozenData.hasNoneOption : hasNoneOption;
                const isShowingFeedback = hasAnswered || isLocked || frozenData || status === "completed";
                const isEliminated = eliminatedOptions.includes(ans);
                const isNoneOfAbove = ans === "None of the above";
                const isWrongAnswer = isNoneOfAbove ? !displayHasNone : ans !== displayCorrectAnswer;
                const canEliminateThis = canEliminate && isWrongAnswer && !isEliminated;
                const isCorrectOption = displayHasNone ? ans === "None of the above" : ans === displayCorrectAnswer;

                const handleClick = () => {
                  if (phase !== 'answering') return;
                  if (canEliminateThis) {
                    handleEliminateOption(ans);
                  } else if (!hasAnswered && !isLocked && !isEliminated) {
                    setSelectedAnswer(ans, index);
                  }
                };

                const opponentLastAnswer = isChallenger ? duel.opponentLastAnswer : duel.challengerLastAnswer;
                const opponentPickedThis = frozenData
                  ? frozenData.opponentAnswer === ans
                  : (status === "completed" && opponentLastAnswer === ans);

                return (
                  <button
                    key={i}
                    disabled={!!isShowingFeedback && !canEliminateThis || isEliminated}
                    onClick={handleClick}
                    data-phase={trampPos.phase}
                    style={{
                      position: 'absolute',
                      left: trampPos.x + trampPos.shakeOffset.x,
                      top: trampPos.y + trampPos.shakeOffset.y,
                      width: TRAMPOLINE_BUTTON_WIDTH,
                      height: TRAMPOLINE_BUTTON_HEIGHT,
                      pointerEvents: 'auto',
                      transform: trampPos.phase === 'flying' ? `scale(${TRAMPOLINE_FLY_SCALE})` : 'scale(1)',
                      transformOrigin: 'top left',
                    }}
                    className={`p-4 rounded-lg border-2 text-base font-medium transition-colors relative shadow-lg ${
                      isEliminated
                        ? 'border-gray-700 bg-gray-900 text-gray-600 line-through opacity-40 cursor-not-allowed'
                        : canEliminateThis
                          ? 'border-orange-500 bg-orange-500/20 text-orange-400 hover:bg-orange-500/30 cursor-pointer animate-pulse'
                          : isShowingFeedback
                            ? displaySelectedAnswer === ans
                              ? isCorrectOption
                                ? 'border-green-500 bg-green-500/20 text-green-400'
                                : 'border-red-500 bg-red-500/20 text-red-400'
                              : isCorrectOption
                                ? 'border-green-500 bg-green-500/10 text-green-400'
                                : 'border-gray-600 bg-gray-800 text-gray-400 opacity-50'
                            : selectedAnswer === ans
                              ? 'border-blue-500 bg-blue-500/20 text-blue-400'
                              : 'border-gray-600 bg-gray-800/95 hover:border-gray-500 text-white'
                    }`}
                  >
                    <span className="truncate block">{ans}</span>
                    {canEliminateThis && (
                      <span className="absolute -top-2 -right-2 bg-orange-500 text-white text-xs px-1.5 py-0.5 rounded-full">✕</span>
                    )}
                    {opponentPickedThis && (
                      <span className="absolute -top-2 -left-2 bg-blue-500 text-white text-xs px-1.5 py-0.5 rounded-full">👤</span>
                    )}
                    {isNoneOfAbove && displayHasNone && isShowingFeedback && (
                      <span className="absolute top-2 right-2 text-green-400">✓</span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Confirm Button */}
      {!hasAnswered && phase === 'answering' && word !== "done" && (
        <button
          className="rounded-lg px-8 py-3 font-bold text-lg disabled:opacity-50 bg-green-600 text-white hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors"
          disabled={!selectedAnswer || isLocked}
          onClick={handleConfirmAnswer}
        >
          {isLocked ? "Submitting..." : "Confirm Answer"}
        </button>
      )}

      {/* Hint System UI */}
      {phase === 'answering' && word !== "done" && (
        <div className="flex flex-col items-center gap-2 mt-2">
          {canRequestHint && (
            <button onClick={handleRequestHint} className="rounded-lg px-8 py-3 font-medium bg-orange-500 text-white hover:bg-orange-600 transition-colors">
              HELP ME!
            </button>
          )}
          
          {iRequestedHint && !hintAccepted && (
            <div className="text-purple-400 font-medium animate-pulse">Waiting for opponent to accept hint request...</div>
          )}
          
          {iRequestedHint && hintAccepted && (
            <div className="text-purple-400 font-medium">💡 Hint received! {eliminatedOptions.length}/2 options eliminated</div>
          )}
          
          {canAcceptHint && (
            <button onClick={handleAcceptHint} className="rounded-lg px-8 py-3 font-medium bg-teal-500 text-white hover:bg-teal-600 transition-colors animate-bounce">
              Bafoon is begging
            </button>
          )}
          
          {isHintProvider && (
            <div className="text-center">
              <div className="text-orange-400 font-medium mb-1">
                🎯 Click on {2 - eliminatedOptions.length} wrong option{2 - eliminatedOptions.length !== 1 ? 's' : ''} to eliminate
              </div>
              <div className="text-xs text-gray-400">You&apos;ll get +0.5 points if they answer correctly after your hint</div>
            </div>
          )}
          
          {hasAnswered && theyRequestedHint && hintAccepted && eliminatedOptions.length >= 2 && (
            <div className="text-green-400 font-medium">✓ Hint provided! Waiting for opponent...</div>
          )}
          
          {theyRequestedHint && !hintAccepted && !hasAnswered && (
            <div className="text-purple-400 font-medium">Opponent requested a hint</div>
          )}
        </div>
      )}

      {/* Sabotage System UI */}
      {status === "accepted" && phase === 'answering' && word !== "done" && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-30 flex flex-col items-center gap-2">
          <div className="text-sm font-medium text-gray-200">
            Sabotage{" "}
            <span className="text-gray-300 tabular-nums">
              {sabotagesRemaining}/{MAX_SABOTAGES}
            </span>
          </div>

          {/* Always-visible sabotage buttons (center bottom) */}
          <div className="flex items-center justify-center gap-2 px-3 py-2 rounded-2xl border border-gray-700 bg-gray-900/80 backdrop-blur-md shadow-xl">
            {SABOTAGE_OPTIONS.map((option) => {
              const disabled =
                sabotagesRemaining <= 0 ||
                phase !== 'answering' ||
                (!hasAnswered && isLocked) ||
                isOutgoingSabotageActive;
              return (
                <button
                  key={option.effect}
                  onClick={() => handleSendSabotage(option.effect)}
                  disabled={disabled}
                  className={`h-11 w-11 rounded-xl border-2 flex items-center justify-center text-xl transition-all ${
                    disabled
                      ? 'border-gray-700 bg-gray-800 text-gray-500 cursor-not-allowed opacity-60'
                      : 'border-gray-600 bg-gray-800 hover:bg-gray-700 hover:border-gray-500 active:scale-95'
                  }`}
                  title={option.label}
                >
                  {option.emoji}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Waiting message */}
      {hasAnswered && phase === 'answering' && word !== "done" && !theyRequestedHint && (
        <div className="text-yellow-400 font-medium animate-pulse">Waiting for opponent to answer...</div>
      )}

      {/* Final Results - shown at end, no separate screen */}
      {status === "completed" && (
        <div className="w-full max-w-md mt-4">
          <div className="bg-gray-800 rounded-xl p-6 border-2 border-yellow-500">
            <div className="text-center text-xl font-bold text-yellow-400 mb-4">Duel Complete!</div>
            
            <div className={`text-center font-bold text-2xl mb-4 ${
              myScore === theirScore ? 'text-yellow-400' : myScore > theirScore ? 'text-green-400' : 'text-red-400'
            }`}>
              {myScore === theirScore ? "It's a tie!" : myScore > theirScore ? "You won! 🎉" : "You lost!"}
            </div>

            {/* Total Duration */}
            {duelDuration > 0 && (
              <div className="bg-gray-900 rounded-lg p-4 mb-4">
                <div className="text-center text-sm text-gray-400 mb-1">Total Time</div>
                <div className="text-center text-2xl font-bold font-mono text-white">{formatDuration(duelDuration)}</div>
              </div>
            )}
            
            <div className="bg-gray-900 rounded-lg p-4 mb-4">
              <div className="text-center text-sm text-gray-400 mb-3">Final Score</div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-green-400 font-medium">You ({myName?.split(' ')[0] || 'You'})</span>
                <span className="text-2xl font-bold text-green-400">{Number.isInteger(myScore) ? myScore : myScore.toFixed(1)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-blue-400 font-medium">{theirName?.split(' ')[0] || 'Opponent'}</span>
                <span className="text-2xl font-bold text-blue-400">{Number.isInteger(theirScore) ? theirScore : theirScore.toFixed(1)}</span>
              </div>
            </div>
            
            <button
              onClick={() => router.push('/')}
              className="w-full bg-blue-500 hover:bg-blue-600 text-white font-bold py-3 px-6 rounded-lg text-lg transition-colors"
            >
              Back to Home
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
