"use client";

import { useParams, useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useEffect, useState, useMemo, useRef, useCallback } from "react";
import { calculateDifficultyDistribution, getDifficultyForIndex } from "@/lib/difficultyUtils";

// Sabotage Effect Type
type SabotageEffect = "ink" | "bubbles" | "emojis" | "sticky" | "cards";

const SABOTAGE_DURATION = 7000; // 7 seconds total (2s wind-up, 3s full, 2s wind-down)
const MAX_SABOTAGES = 5;

// Sabotage Effect Components
function InkSplatter({ phase }: { phase: 'wind-up' | 'full' | 'wind-down' }) {
  const splatters = useMemo(
    () =>
      Array.from({ length: 25 }, (_, i) => ({
        id: i,
        top: 5 + Math.random() * 90,
        left: 2 + Math.random() * 96,
        scale: 1.5 + Math.random() * 2.5,
        delay: Math.random() * 1.5,
        rotation: Math.random() * 360,
        pulseSpeed: 0.5 + Math.random() * 0.5,
      })),
    [],
  );

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
  const bubbles = useMemo(
    () =>
      Array.from({ length: 60 }, (_, i) => ({
        id: i,
        left: Math.random() * 100,
        size: 80 + Math.random() * 150,
        duration: 1.5 + Math.random() * 1.5,
        delay: Math.random() * 1,
        wobbleAmount: 40 + Math.random() * 60,
        hue: Math.floor(Math.random() * 60) + 180, // Blue-cyan range
      })),
    [],
  );

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
  const emojis = useMemo(() => {
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
  }, []);

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
  const notes = useMemo(
    () =>
      Array.from({ length: 20 }, (_, i) => ({
        id: i,
        top: 2 + Math.random() * 85,
        left: 2 + Math.random() * 85,
        rotation: -25 + Math.random() * 50,
        delay: Math.random() * 1,
        wobbleSpeed: 0.3 + Math.random() * 0.4,
        color: ["#fff740", "#ff7eb9", "#7afcff", "#feff9c", "#ff65a3", "#a8f0c6", "#ffb347", "#ff6961"][Math.floor(Math.random() * 8)],
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
      })),
    [],
  );

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
  const cards = useMemo(() => {
    const suits = ["♠", "♥", "♦", "♣"];
    const values = ["A", "K", "Q", "J", "10", "9", "8"];
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
  }, []);

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
    case "ink": return <InkSplatter phase={phase} />;
    case "bubbles": return <FloatingBubbles phase={phase} />;
    case "emojis": return <FallingEmojis phase={phase} />;
    case "sticky": return <StickyNotes phase={phase} />;
    case "cards": return <FlyingCards phase={phase} />;
    default: return null;
  }
}

// Sabotage button data
const SABOTAGE_OPTIONS: { effect: SabotageEffect; label: string; emoji: string }[] = [
  { effect: "ink", label: "Ink", emoji: "🖤" },
  { effect: "bubbles", label: "Bubbles", emoji: "🫧" },
  { effect: "emojis", label: "Emojis", emoji: "😈" },
  { effect: "sticky", label: "Sticky", emoji: "📝" },
  { effect: "cards", label: "Cards", emoji: "🃏" },
];

export default function ChallengePage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useUser();
  const challengeId = params.duelId as string;
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [isLocked, setIsLocked] = useState(false);
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
  const [showSabotageMenu, setShowSabotageMenu] = useState(false);
  const lastSabotageTimestampRef = useRef<number | null>(null);
  const sabotageTimersRef = useRef<NodeJS.Timeout[]>([]);
  
  // Helper to clear all sabotage timers and effect
  const clearSabotageEffect = useCallback(() => {
    sabotageTimersRef.current.forEach(timer => clearTimeout(timer));
    sabotageTimersRef.current = [];
    setActiveSabotage(null);
    setSabotagePhase('wind-up');
  }, []);

  const challengeData = useQuery(
    api.duel.getChallenge,
    { challengeId: challengeId as any }
  );

  // Get theme for this challenge
  const theme = useQuery(
    api.themes.getTheme,
    challengeData?.challenge?.themeId ? { themeId: challengeData.challenge.themeId } : "skip"
  );
  const answer = useMutation(api.duel.answerChallenge);
  const stopChallenge = useMutation(api.duel.stopChallenge);
  const requestHint = useMutation(api.duel.requestHint);
  const acceptHint = useMutation(api.duel.acceptHint);
  const eliminateOption = useMutation(api.duel.eliminateOption);
  const timeoutAnswer = useMutation(api.duel.timeoutAnswer);
  const sendSabotage = useMutation(api.duel.sendSabotage);
  const pauseCountdown = useMutation(api.duel.pauseCountdown);
  const requestUnpauseCountdown = useMutation(api.duel.requestUnpauseCountdown);
  const confirmUnpauseCountdown = useMutation(api.duel.confirmUnpauseCountdown);
  
  // Question timer state (16 seconds total, but display shows 15)
  const TIMER_DURATION = 16; // 16 seconds total (1 hidden + 15 shown)
  const TRANSITION_DURATION = 5; // 5 seconds for showing correct answer between questions (matches countdown)
  const [questionTimer, setQuestionTimer] = useState<number | null>(null);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const hasTimedOutRef = useRef(false);
  
  // Phase-based state machine for question flow
  // 'idle' = initial/loading, 'answering' = active question, 'transition' = showing feedback
  const [phase, setPhase] = useState<'idle' | 'answering' | 'transition'>('idle');
  const activeQuestionIndexRef = useRef<number | null>(null);
  const lockedAnswerRef = useRef<string | null>(null);
  
  // Extract values safely for hooks (before any returns)
  const challenge = challengeData?.challenge;
  const challenger = challengeData?.challenger;
  const opponent = challengeData?.opponent;
  const wordOrder = challenge?.wordOrder;
  const words = theme?.words || [];
  // When completed, show the last word; otherwise show current word
  const isCompleted = challenge?.status === "completed";
  const rawIndex = challenge?.currentWordIndex ?? 0;
  const index = isCompleted && words.length > 0 ? words.length - 1 : rawIndex;
  // Use shuffled word order if available, otherwise fall back to sequential
  const actualWordIndex = wordOrder ? wordOrder[index] : index;
  const currentWord = words[actualWordIndex] || { word: "done", answer: "done", wrongAnswers: [] };
  const word = currentWord.word;
  
  // Calculate dynamic difficulty distribution based on total word count
  const difficultyDistribution = useMemo(() => 
    calculateDifficultyDistribution(words.length), 
    [words.length]
  );

  // Track word index from server for transition detection
  const currentWordIndex = challenge?.currentWordIndex;
  
  // Unified transition effect - handles all question phase changes
  useEffect(() => {
    if (currentWordIndex === undefined || !words.length) return;
    
    // Initial load - start answering phase
    if (activeQuestionIndexRef.current === null) {
      activeQuestionIndexRef.current = currentWordIndex;
      setPhase('answering');
      return;
    }
    
    // No change in question index
    if (activeQuestionIndexRef.current === currentWordIndex) return;
    
    // Question changed! Determine if we should show transition
    const prevIndex = activeQuestionIndexRef.current;
    const shouldShowTransition = isLocked || lockedAnswerRef.current || hasTimedOutRef.current;
    
    if (shouldShowTransition) {
      // Get PREVIOUS word data (before the index changed)
      const prevActualIndex = wordOrder ? wordOrder[prevIndex] : prevIndex;
      const prevWord = words[prevActualIndex] || { word: "", answer: "", wrongAnswers: [] };
      
      // Determine previous difficulty using dynamic distribution
      const prevDistribution = calculateDifficultyDistribution(words.length);
      const prevDifficultyData = getDifficultyForIndex(prevIndex, prevDistribution);
      const prevDifficulty = {
        level: prevDifficultyData.level,
        points: prevDifficultyData.points,
        wrongCount: prevDifficultyData.wrongCount,
      };
      
      // Compute shuffled answers for previous word with difficulty logic
      let seed = prevWord.word.split('').reduce((acc: number, char: string, idx: number) => 
        acc + char.charCodeAt(0) * (idx + 1), 0);
      seed = seed + prevIndex * 7919;
      const random = () => {
        seed = (seed * 1103515245 + 12345) & 0x7fffffff;
        return seed / 0x7fffffff;
      };
      
      // Shuffle all wrong answers
      const allWrong = [...prevWord.wrongAnswers];
      for (let i = allWrong.length - 1; i > 0; i--) {
        const j = Math.floor(random() * (i + 1));
        [allWrong[i], allWrong[j]] = [allWrong[j], allWrong[i]];
      }
      const selectedWrong = allWrong.slice(0, prevDifficulty.wrongCount);
      
      let prevShuffled: string[];
      let prevHasNone = false;
      
      if (prevDifficulty.level === "hard") {
        // Always show "None of the above" in hard mode
        // Randomly decide if it's the correct answer or a trap
        const noneIsCorrect = random() < 0.5;
        if (noneIsCorrect) {
          // "None" is correct - show 4 wrong answers + None
          prevShuffled = [...selectedWrong, "None of the above"];
          prevHasNone = true;
        } else {
          // "None" is a trap - show 3 wrong answers + correct + None
          const fewerWrong = selectedWrong.slice(0, 3);
          prevShuffled = [prevWord.answer, ...fewerWrong, "None of the above"];
          prevHasNone = false; // None shown but not correct
        }
      } else {
        prevShuffled = [prevWord.answer, ...selectedWrong];
      }
      
      // Final shuffle
      for (let i = prevShuffled.length - 1; i > 0; i--) {
        const j = Math.floor(random() * (i + 1));
        [prevShuffled[i], prevShuffled[j]] = [prevShuffled[j], prevShuffled[i]];
      }
      
      // Get opponent's answer from challenge data
      const userIsChallenger = challenger?.clerkId === user?.id;
      const opponentLastAnswer = userIsChallenger 
        ? challenge?.opponentLastAnswer 
        : challenge?.challengerLastAnswer;
      
      // Enter transition phase with frozen data
      // Use lockedAnswerRef for the selected answer (captures what was CONFIRMED, not current state)
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
      
      // Only start countdown if challenge is not completed (more questions to come)
      const isLastQuestion = prevIndex >= words.length - 1;
      if (!isLastQuestion) {
        setCountdown(5);
      }
    } else {
      // No answer was locked, go straight to next question
      setPhase('answering');
      setSelectedAnswer(null);
      setIsLocked(false);
      lockedAnswerRef.current = null;
      hasTimedOutRef.current = false;
    }
    
    // Update the tracked index
    activeQuestionIndexRef.current = currentWordIndex;
  }, [currentWordIndex, words, wordOrder, challenger?.clerkId, user?.id, challenge?.opponentLastAnswer, challenge?.challengerLastAnswer, isLocked]);
  
  // Countdown timer - respects pause state from server
  const countdownPausedBy = challenge?.countdownPausedBy;
  const countdownUnpauseRequestedBy = challenge?.countdownUnpauseRequestedBy;
  
  useEffect(() => {
    if (countdown === null || phase !== 'transition') return;
    // Don't tick if paused
    if (countdownPausedBy) return;
    
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    } else {
      // Countdown finished - transition to answering phase
      // When completed, we want to keep showing the last question's feedback
      if (challenge?.status !== "completed") {
        // Reset ALL state for the new question
        setPhase('answering');
        setFrozenData(null);
        setSelectedAnswer(null);
        setIsLocked(false);
        lockedAnswerRef.current = null;
        hasTimedOutRef.current = false;
        // Reset reveal state for next question
        setIsRevealing(false);
        setTypedText("");
        setRevealComplete(false);
      }
      setCountdown(null);
    }
  }, [countdown, challenge?.status, countdownPausedBy, phase]);

  // Type reveal effect for "None of the above" correct answer
  // Triggers when frozenData exists and hasNoneOption is true (meaning "None" was correct)
  useEffect(() => {
    if (!frozenData || !frozenData.hasNoneOption) {
      return;
    }
    
    // Start revealing after a short delay
    const startDelay = setTimeout(() => {
      setIsRevealing(true);
    }, 300);
    
    return () => clearTimeout(startDelay);
  }, [frozenData]);

  // Typing animation effect
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
    }, 50); // 50ms per character
    
    return () => clearInterval(interval);
  }, [isRevealing, frozenData]);

  // Monitor challenge status for real-time updates
  useEffect(() => {
    if (challengeData) {
      const status = challengeData.challenge.status || "accepted";
      if (status === "stopped" || status === "rejected") {
        router.push('/');
      }
    }
  }, [challengeData, router]);

  // Sabotage effect listener - watch for incoming sabotage from opponent
  useEffect(() => {
    if (!challengeData?.challenge || !challenger || !user) return;
    
    const isChallenger = challenger.clerkId === user.id;
    const mySabotage = isChallenger 
      ? challengeData.challenge.challengerSabotage 
      : challengeData.challenge.opponentSabotage;
    
    if (mySabotage && mySabotage.timestamp !== lastSabotageTimestampRef.current) {
      lastSabotageTimestampRef.current = mySabotage.timestamp;
      
      // Clear any existing sabotage timers
      clearSabotageEffect();
      
      // Start with wind-up phase
      setSabotagePhase('wind-up');
      setActiveSabotage(mySabotage.effect as SabotageEffect);
      
      // Phase transitions: 2s wind-up → 3s full → 2s wind-down → clear
      const fullTimer = setTimeout(() => {
        setSabotagePhase('full');
      }, 2000);
      
      const windDownTimer = setTimeout(() => {
        setSabotagePhase('wind-down');
      }, 5000); // 2s wind-up + 3s full
      
      const clearTimer = setTimeout(() => {
        setActiveSabotage(null);
        setSabotagePhase('wind-up'); // Reset for next sabotage
      }, SABOTAGE_DURATION); // 7s total
      
      // Store timers for cleanup
      sabotageTimersRef.current = [fullTimer, windDownTimer, clearTimer];
    }
  }, [challengeData?.challenge?.challengerSabotage, challengeData?.challenge?.opponentSabotage, challenger?.clerkId, user?.id, clearSabotageEffect]);

  // Clear sabotage effect when answer is locked in
  useEffect(() => {
    if (isLocked) {
      clearSabotageEffect();
    }
  }, [isLocked, clearSabotageEffect]);

  // Clear sabotage effect when entering transition phase
  useEffect(() => {
    if (phase === 'transition') {
      clearSabotageEffect();
    }
  }, [phase, clearSabotageEffect]);

  // Clear selected answer if it becomes eliminated
  useEffect(() => {
    const eliminated = challengeData?.challenge?.eliminatedOptions || [];
    if (selectedAnswer && eliminated.includes(selectedAnswer)) {
      setSelectedAnswer(null);
    }
  }, [challengeData?.challenge?.eliminatedOptions, selectedAnswer]);

  // Question timer - synced from server questionStartTime, gated by phase
  useEffect(() => {
    // Clear any existing timer
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    
    const questionStartTime = challenge?.questionStartTime;
    const status = challenge?.status;
    
    // Only run timer during answering phase with active challenge
    if (phase !== 'answering' || !questionStartTime || status !== "accepted") {
      setQuestionTimer(null);
      return;
    }
    
    // Calculate remaining time based on server timestamp
    // Account for the 3-second transition period (server sets time when both answer,
    // but we show transition before starting the next question timer)
    // Only apply this offset after the first question, since no transition precedes the first one
    const updateTimer = () => {
      const isFirstQuestion = (challenge?.currentWordIndex ?? 0) === 0;
      const transitionOffset = isFirstQuestion ? 0 : TRANSITION_DURATION * 1000;
      const effectiveStartTime = questionStartTime + transitionOffset;
      const elapsed = (Date.now() - effectiveStartTime) / 1000;
      const remaining = Math.max(0, TIMER_DURATION - elapsed);
      setQuestionTimer(remaining);
      
      // Check if time is up and player hasn't answered
      if (remaining <= 0 && !hasTimedOutRef.current) {
        hasTimedOutRef.current = true;
        // Check if current user has answered
        const userIsChallenger = challenger?.clerkId === user?.id;
        const hasAnswered = userIsChallenger 
          ? challenge?.challengerAnswered 
          : challenge?.opponentAnswered;
        
        if (!hasAnswered && challenge?._id && user?.id) {
          // Auto-submit timeout
          timeoutAnswer({
            challengeId: challenge._id,
            userId: user.id,
          }).catch(console.error);
        }
      }
    };
    
    // Initial update
    updateTimer();
    
    // Update every 100ms for smooth countdown
    timerIntervalRef.current = setInterval(updateTimer, 100);
    
    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
    };
  }, [phase, challenge?.questionStartTime, challenge?.status, challenge?._id, challenge?.challengerAnswered, challenge?.opponentAnswered, challenger?.clerkId, user?.id, timeoutAnswer]);

  // Difficulty scaling based on question index using dynamic distribution
  // Easy: 4 options (1 correct + 3 random wrong), 1 point
  // Medium: 5 options (1 correct + 4 random wrong), 1.5 points
  // Hard: 5 options (4 wrong + either correct OR "None"), 2 points
  const difficulty = useMemo(() => 
    getDifficultyForIndex(index, difficultyDistribution),
    [index, difficultyDistribution]
  );

  // Shuffle answers with difficulty-based option selection (MUST be before any returns)
  const { shuffledAnswers, hasNoneOption, correctAnswerPresent } = useMemo(() => {
    if (word === "done" || !currentWord.wrongAnswers?.length) {
      return { shuffledAnswers: [], hasNoneOption: false, correctAnswerPresent: true };
    }
    
    // Seeded PRNG (Linear Congruential Generator)
    let seed = currentWord.word.split('').reduce((acc, char, idx) => 
      acc + char.charCodeAt(0) * (idx + 1), 0);
    // Add index to seed so different questions get different random selections
    seed = seed + index * 7919;
    const random = () => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return seed / 0x7fffffff;
    };
    
    // Shuffle all wrong answers first to pick random subset
    const allWrong = [...currentWord.wrongAnswers];
    for (let i = allWrong.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [allWrong[i], allWrong[j]] = [allWrong[j], allWrong[i]];
    }
    
    // Pick the required number of wrong answers
    const selectedWrong = allWrong.slice(0, difficulty.wrongCount);
    
    let answers: string[];
    let hasNone = false;
    let correctPresent = true;
    
    if (difficulty.level === "hard") {
      // Always show "None of the above" in hard mode
      // Randomly decide if it's the correct answer (correct answer hidden) or a trap
      const noneIsCorrect = random() < 0.5;
      if (noneIsCorrect) {
        // "None" is correct - show 4 wrong answers + None (no correct answer)
        answers = [...selectedWrong, "None of the above"];
        hasNone = true;
        correctPresent = false;
      } else {
        // "None" is a trap - show 3 wrong answers + correct + None
        const fewerWrong = selectedWrong.slice(0, 3);
        answers = [currentWord.answer, ...fewerWrong, "None of the above"];
        hasNone = false; // None is shown but NOT correct
        correctPresent = true;
      }
    } else {
      // Easy/Medium: always include correct answer
      answers = [currentWord.answer, ...selectedWrong];
    }
    
    // Final shuffle of the options
    for (let i = answers.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [answers[i], answers[j]] = [answers[j], answers[i]];
    }
    
    return { shuffledAnswers: answers, hasNoneOption: hasNone, correctAnswerPresent: correctPresent };
  }, [currentWord.word, currentWord.answer, currentWord.wrongAnswers, word, index, difficulty]);

  // Early returns AFTER all hooks
  if (!user) return <div>Sign in first.</div>;
  if (!challengeData) return <div>Loading challenge...</div>;
  if (!theme) return <div>Loading theme...</div>;

  // Check challenge status
  const status = challenge?.status || "accepted";
  if (status === "pending") {
    return <div>Challenge not yet accepted...</div>;
  }
  if (status === "rejected") {
    return <div>Challenge was rejected</div>;
  }
  if (status === "stopped") {
    return <div>Challenge was stopped</div>;
  }
  // For completed status, we'll show the last question with results overlay
  // (handled below in the main render)

  // At this point, challenge is guaranteed to exist
  if (!challenge) return <div>Loading...</div>;

  // Check if current user is challenger or opponent
  const isChallenger = challenger?.clerkId === user.id;
  const isOpponent = opponent?.clerkId === user.id;
  
  if (!isChallenger && !isOpponent) {
    return <div>You're not part of this challenge</div>;
  }

  const hasAnswered = (isChallenger && challenge.challengerAnswered) || 
                     (isOpponent && challenge.opponentAnswered);
  const opponentHasAnswered = (isChallenger && challenge.opponentAnswered) || 
                              (isOpponent && challenge.challengerAnswered);

  // Hint system state
  const myRole = isChallenger ? "challenger" : "opponent";
  const theirRole = isChallenger ? "opponent" : "challenger";
  const hintRequestedBy = challenge.hintRequestedBy;
  const hintAccepted = challenge.hintAccepted;
  const eliminatedOptions = challenge.eliminatedOptions || [];
  
  // Hint UI states
  const canRequestHint = !hasAnswered && opponentHasAnswered && !hintRequestedBy;
  const iRequestedHint = hintRequestedBy === myRole;
  const theyRequestedHint = hintRequestedBy === theirRole;
  const canAcceptHint = hasAnswered && theyRequestedHint && !hintAccepted;
  const isHintProvider = hasAnswered && theyRequestedHint && hintAccepted;
  const canEliminate = isHintProvider && eliminatedOptions.length < 2;

  // TTS button visibility - show during transition phase (including when paused)
  const inTransition = phase === 'transition' && !!frozenData;
  const showListenButton = (hasAnswered || isLocked || inTransition) && ((frozenData?.word ?? word) !== 'done');

  const handleStopChallenge = async () => {
    try {
      await stopChallenge({
        challengeId: challenge._id,
        userId: user.id,
      });
      router.push('/');
    } catch (error) {
      console.error("Failed to stop challenge:", error);
    }
  };

  const handleConfirmAnswer = async () => {
    if (!selectedAnswer) return;
    // Capture the answer in ref BEFORE any async operations or state changes
    // This ensures the correct answer is preserved even if user taps something else
    lockedAnswerRef.current = selectedAnswer;
    setIsLocked(true);
    try {
      await answer({
        challengeId: challenge._id,
        userId: user.id,
        selectedAnswer,
      });
    } catch (error) {
      console.error("Failed to submit answer:", error);
      setIsLocked(false);
      lockedAnswerRef.current = null;
    }
  };

  const handleRequestHint = async () => {
    try {
      await requestHint({
        challengeId: challenge._id,
        userId: user.id,
      });
    } catch (error) {
      console.error("Failed to request hint:", error);
    }
  };

  const handleAcceptHint = async () => {
    try {
      await acceptHint({
        challengeId: challenge._id,
        userId: user.id,
      });
    } catch (error) {
      console.error("Failed to accept hint:", error);
    }
  };

  const handleEliminateOption = async (option: string) => {
    try {
      await eliminateOption({
        challengeId: challenge._id,
        userId: user.id,
        option,
      });
    } catch (error) {
      console.error("Failed to eliminate option:", error);
    }
  };

  const handleSendSabotage = async (effect: SabotageEffect) => {
    try {
      await sendSabotage({
        challengeId: challenge._id,
        userId: user.id,
        effect,
      });
      setShowSabotageMenu(false);
    } catch (error) {
      console.error("Failed to send sabotage:", error);
    }
  };

  // Play TTS for the correct answer
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
  const challengerScore = challenge.challengerScore || 0;
  const opponentScore = challenge.opponentScore || 0;
  const myScore = isChallenger ? challengerScore : opponentScore;
  const theirScore = isChallenger ? opponentScore : challengerScore;
  const myName = isChallenger ? (challenger?.name || challenger?.email) : (opponent?.name || opponent?.email);
  const theirName = isChallenger ? (opponent?.name || opponent?.email) : (challenger?.name || challenger?.email);

  // Sabotage remaining count
  const mySabotagesUsed = isChallenger 
    ? (challenge.challengerSabotagesUsed || 0) 
    : (challenge.opponentSabotagesUsed || 0);
  const sabotagesRemaining = MAX_SABOTAGES - mySabotagesUsed;

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 relative p-4">
      {/* Active Sabotage Effect Overlay */}
      <SabotageRenderer effect={activeSabotage} phase={sabotagePhase} />
      
      {/* Exit Button - hide when completed */}
      {status !== "completed" && (
        <button
          onClick={handleStopChallenge}
          className="absolute top-4 right-4 bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-4 rounded"
        >
          Exit Challenge
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
        <h1 className="text-2xl font-bold mb-2">Language Challenge</h1>
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
        {/* Question Timer - show 15 seconds max (hide the extra 1 second) */}
        {questionTimer !== null && phase === 'answering' && (
          <div className="mb-3">
            <div className={`text-4xl font-bold tabular-nums ${
              questionTimer <= 4 ? 'text-red-500 animate-pulse' : 
              questionTimer <= 8 ? 'text-yellow-400' : 
              'text-white'
            }`}>
              {Math.max(0, Math.min(15, Math.ceil(questionTimer - 1)))}
            </div>
            <div className="text-xs text-gray-400 mt-1">seconds remaining</div>
          </div>
        )}
        <div className="text-3xl font-bold mb-6">{frozenData ? frozenData.word : word}</div>
      </div>

      {/* Countdown indicator with pause/unpause controls */}
      {countdown !== null && frozenData && (
        <div className="flex flex-col items-center gap-2 mb-2">
          <div className={`text-2xl font-bold ${countdownPausedBy ? 'text-orange-400' : 'text-yellow-400'}`}>
            {countdownPausedBy ? 'PAUSED' : `Next question in ${countdown}...`}
          </div>
          
          {/* Pause/Unpause Button */}
          {(() => {
            const userRole = isChallenger ? "challenger" : "opponent";
            const otherRole = isChallenger ? "opponent" : "challenger";
            
            // Not paused - show pause button
            if (!countdownPausedBy) {
              return (
                <button
                  onClick={() => {
                    if (challenge?._id && user?.id) {
                      pauseCountdown({ challengeId: challenge._id, userId: user.id }).catch(console.error);
                    }
                  }}
                  className="px-4 py-2 rounded-lg bg-orange-500 hover:bg-orange-600 text-white font-medium transition-colors"
                >
                  ⏸ Pause
                </button>
              );
            }
            
            // Paused - check if there's an unpause request
            if (countdownUnpauseRequestedBy) {
              // Someone requested unpause
              if (countdownUnpauseRequestedBy === userRole) {
                // Current user requested - waiting for other player
                return (
                  <div className="flex flex-col items-center gap-1">
                    <div className="text-sm text-gray-400">Waiting for opponent to confirm...</div>
                    <button
                      disabled
                      className="px-4 py-2 rounded-lg bg-gray-600 text-gray-400 font-medium cursor-not-allowed"
                    >
                      ▶ Unpause Requested
                    </button>
                  </div>
                );
              } else {
                // Other player requested - show confirm button
                return (
                  <div className="flex flex-col items-center gap-1">
                    <div className="text-sm text-yellow-400">Opponent wants to resume!</div>
                    <button
                      onClick={() => {
                        if (challenge?._id && user?.id) {
                          confirmUnpauseCountdown({ challengeId: challenge._id, userId: user.id }).catch(console.error);
                        }
                      }}
                      className="px-4 py-2 rounded-lg bg-green-500 hover:bg-green-600 text-white font-medium transition-colors animate-pulse"
                    >
                      ✓ Confirm Unpause
                    </button>
                  </div>
                );
              }
            }
            
            // Paused, no unpause request - show unpause button
            return (
              <button
                onClick={() => {
                  if (challenge?._id && user?.id) {
                    requestUnpauseCountdown({ challengeId: challenge._id, userId: user.id }).catch(console.error);
                  }
                }}
                className="px-4 py-2 rounded-lg bg-green-500 hover:bg-green-600 text-white font-medium transition-colors"
              >
                ▶ Unpause
              </button>
            );
          })()}
        </div>
      )}

      {/* TTS Listen button - show when player has locked in their answer or during transition */}
      {showListenButton && (
        <button
          onClick={handlePlayAudio}
          disabled={isPlayingAudio}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all mb-2 ${
            isPlayingAudio
              ? 'bg-green-600 text-white cursor-not-allowed'
              : 'bg-blue-600 hover:bg-blue-700 text-white'
          }`}
        >
          <span className="text-xl">{isPlayingAudio ? '🔊' : '🔈'}</span>
          <span>{isPlayingAudio ? 'Playing...' : 'Listen'}</span>
        </button>
      )}

      {/* Answer Options */}
      {(frozenData ? frozenData.word : word) !== "done" && (
        <div className="grid grid-cols-2 gap-3 w-full max-w-md mb-4">
          {(frozenData ? frozenData.shuffledAnswers : shuffledAnswers).map((ans, i) => {
            const displaySelectedAnswer = frozenData ? frozenData.selectedAnswer : selectedAnswer;
            const displayCorrectAnswer = frozenData ? frozenData.correctAnswer : currentWord.answer;
            const displayHasNone = frozenData ? frozenData.hasNoneOption : hasNoneOption;
            const isShowingFeedback = hasAnswered || isLocked || frozenData || status === "completed";
            const isEliminated = eliminatedOptions.includes(ans);
            // "None of the above" is wrong when the correct answer IS present (hasNoneOption = false)
            const isNoneOfAbove = ans === "None of the above";
            const isWrongAnswer = isNoneOfAbove 
              ? !displayHasNone  // "None" is wrong when correct answer IS present
              : ans !== displayCorrectAnswer;
            const canEliminateThis = canEliminate && isWrongAnswer && !isEliminated;
            
            // Determine if this answer is correct
            // - If "None of the above" is present (hasNoneOption), then "None of the above" is correct
            // - Otherwise, the correct answer from the word is correct
            const isCorrectOption = displayHasNone 
              ? ans === "None of the above"
              : ans === displayCorrectAnswer;
            
            // Handle click - either select answer or eliminate option
            const handleClick = () => {
              // Block all interaction when not in answering phase
              if (phase !== 'answering') return;
              if (canEliminateThis) {
                handleEliminateOption(ans);
              } else if (!hasAnswered && !isLocked && !isEliminated) {
                setSelectedAnswer(ans);
              }
            };
            
            // Check if opponent picked this answer (show during countdown OR when completed)
            const opponentLastAnswer = isChallenger 
              ? challenge?.opponentLastAnswer 
              : challenge?.challengerLastAnswer;
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
                {/* Type reveal effect for "None of the above" when it's the correct answer */}
                {isNoneOfAbove && displayHasNone && isRevealing && frozenData ? (
                  <span className="font-medium">
                    {typedText}
                    {!revealComplete && <span className="animate-pulse">|</span>}
                  </span>
                ) : (
                  ans
                )}
                {canEliminateThis && (
                  <span className="absolute -top-2 -right-2 bg-orange-500 text-white text-xs px-1.5 py-0.5 rounded-full">
                    ✕
                  </span>
                )}
                {/* Show opponent's pick during countdown */}
                {opponentPickedThis && (
                  <span className="absolute -top-2 -left-2 bg-blue-500 text-white text-xs px-1.5 py-0.5 rounded-full">
                    👤
                  </span>
                )}
                {/* Show checkmark when "None of the above" is correct and revealed */}
                {isNoneOfAbove && displayHasNone && isShowingFeedback && (
                  <span className="absolute top-2 right-2 text-green-400">✓</span>
                )}
              </button>
            );
          })}
        </div>
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
          {/* Request Hint Button - for player who hasn't answered */}
          {canRequestHint && (
            <button
              onClick={handleRequestHint}
              className="rounded-lg px-6 py-2 font-medium bg-purple-600 text-white hover:bg-purple-700 transition-colors"
            >
              💡 Request Hint
            </button>
          )}
          
          {/* Waiting for hint acceptance */}
          {iRequestedHint && !hintAccepted && (
            <div className="text-purple-400 font-medium animate-pulse">
              Waiting for opponent to accept hint request...
            </div>
          )}
          
          {/* Hint received - show status */}
          {iRequestedHint && hintAccepted && (
            <div className="text-purple-400 font-medium">
              💡 Hint received! {eliminatedOptions.length}/2 options eliminated
            </div>
          )}
          
          {/* Accept Hint Button - for player who answered */}
          {canAcceptHint && (
            <button
              onClick={handleAcceptHint}
              className="rounded-lg px-6 py-2 font-medium bg-purple-600 text-white hover:bg-purple-700 transition-colors animate-bounce"
            >
              ✓ Accept Hint Request
            </button>
          )}
          
          {/* Hint provider mode - show instructions */}
          {isHintProvider && (
            <div className="text-center">
              <div className="text-orange-400 font-medium mb-1">
                🎯 Click on {2 - eliminatedOptions.length} wrong option{2 - eliminatedOptions.length !== 1 ? 's' : ''} to eliminate
              </div>
              <div className="text-xs text-gray-400">
                You'll get +0.5 points if they answer after your hint
              </div>
            </div>
          )}
          
          {/* Hint provider done eliminating */}
          {hasAnswered && theyRequestedHint && hintAccepted && eliminatedOptions.length >= 2 && (
            <div className="text-green-400 font-medium">
              ✓ Hint provided! Waiting for opponent...
            </div>
          )}
          
          {/* Opponent requested hint - show notification */}
          {theyRequestedHint && !hintAccepted && !hasAnswered && (
            <div className="text-purple-400 font-medium">
              Opponent requested a hint
            </div>
          )}
        </div>
      )}

      {/* Sabotage System UI */}
      {status === "accepted" && phase === 'answering' && word !== "done" && (
        <div className="fixed bottom-4 right-4 z-30">
          {/* Sabotage Menu */}
          {showSabotageMenu && sabotagesRemaining > 0 && (
            <div className="absolute bottom-16 right-0 bg-gray-800 rounded-lg p-3 shadow-xl border border-gray-700 mb-2">
              <div className="text-xs text-gray-400 mb-2 text-center">Send to opponent</div>
              <div className="grid grid-cols-3 gap-2">
                {SABOTAGE_OPTIONS.map((option) => (
                  <button
                    key={option.effect}
                    onClick={() => handleSendSabotage(option.effect)}
                    className="flex flex-col items-center p-2 rounded-lg bg-gray-700 hover:bg-gray-600 transition-colors"
                    title={option.label}
                  >
                    <span className="text-2xl">{option.emoji}</span>
                    <span className="text-xs text-gray-300 mt-1">{option.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
          
          {/* Sabotage Toggle Button */}
          <button
            onClick={() => setShowSabotageMenu(!showSabotageMenu)}
            disabled={sabotagesRemaining <= 0}
            className={`flex items-center gap-2 px-4 py-3 rounded-lg font-medium transition-all ${
              sabotagesRemaining > 0
                ? 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white shadow-lg'
                : 'bg-gray-700 text-gray-500 cursor-not-allowed'
            }`}
          >
            <span className="text-xl">💥</span>
            <span>Sabotage</span>
            <span className={`px-2 py-0.5 rounded-full text-sm ${
              sabotagesRemaining > 0 ? 'bg-white/20' : 'bg-gray-600'
            }`}>
              {sabotagesRemaining}/{MAX_SABOTAGES}
            </span>
          </button>
        </div>
      )}

      {/* Waiting message */}
      {hasAnswered && phase === 'answering' && word !== "done" && !theyRequestedHint && (
        <div className="text-yellow-400 font-medium animate-pulse">
          Waiting for opponent to answer...
        </div>
      )}

      {/* Final Results Panel - shown when challenge is completed */}
      {status === "completed" && (
        <div className="w-full max-w-md mt-4">
          <div className="bg-gray-800 rounded-xl p-6 border-2 border-yellow-500">
            <div className="text-center text-xl font-bold text-yellow-400 mb-4">
              Challenge Complete!
            </div>
            
            {/* Winner announcement */}
            <div className={`text-center font-bold text-2xl mb-4 ${
              myScore === theirScore 
                ? 'text-yellow-400' 
                : myScore > theirScore 
                  ? 'text-green-400' 
                  : 'text-red-400'
            }`}>
              {myScore === theirScore 
                ? "It's a tie!" 
                : myScore > theirScore 
                  ? "You won! 🎉" 
                  : "You lost!"}
            </div>
            
            {/* Final Scores */}
            <div className="bg-gray-900 rounded-lg p-4 mb-4">
              <div className="text-center text-sm text-gray-400 mb-3">Final Score</div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-green-400 font-medium">You ({myName?.split(' ')[0] || 'You'})</span>
                <span className="text-2xl font-bold text-green-400">
                  {Number.isInteger(myScore) ? myScore : myScore.toFixed(1)}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-blue-400 font-medium">{theirName?.split(' ')[0] || 'Opponent'}</span>
                <span className="text-2xl font-bold text-blue-400">
                  {Number.isInteger(theirScore) ? theirScore : theirScore.toFixed(1)}
                </span>
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
