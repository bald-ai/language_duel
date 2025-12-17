"use client";

import { useMemo } from "react";
import type { SabotagePhase } from "@/lib/sabotage";
import { hashSeed, mulberry32 } from "@/lib/prng";
import {
  STICKY_NOTE_COUNT,
  STICKY_NOTE_SIZE_MIN,
  STICKY_NOTE_SIZE_RANGE,
} from "@/lib/sabotage/constants";

const STICKY_COLORS = ["#fff740", "#ff7eb9", "#7afcff", "#feff9c", "#ff65a3", "#a8f0c6", "#ffb347", "#ff6961"];
const STICKY_TEXTS = [
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
];

interface StickyNotesProps {
  phase: SabotagePhase;
  seed?: number;
}

export function StickyNotes({ phase, seed = 0 }: StickyNotesProps) {
  const notes = useMemo(() => {
    const rand = mulberry32(hashSeed(`sticky::${seed}`));
    return Array.from({ length: STICKY_NOTE_COUNT }, (_, i) => ({
      id: i,
      top: 2 + rand() * 85,
      left: 2 + rand() * 85,
      rotation: -25 + rand() * 50,
      delay: rand() * 1,
      wobbleSpeed: 0.3 + rand() * 0.4,
      color: STICKY_COLORS[Math.floor(rand() * STICKY_COLORS.length)],
      text: STICKY_TEXTS[Math.floor(rand() * STICKY_TEXTS.length)],
      size: STICKY_NOTE_SIZE_MIN + rand() * STICKY_NOTE_SIZE_RANGE,
    }));
  }, [seed]);
  const opacity = phase === "wind-up" ? 0.5 : phase === "wind-down" ? 0.3 : 1;

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

