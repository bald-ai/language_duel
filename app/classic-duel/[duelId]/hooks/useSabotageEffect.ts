"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import type { SabotageEffect } from "@/app/game/sabotage";
import {
  SABOTAGE_DURATION_MS,
  SABOTAGE_WIND_UP_MS,
  SABOTAGE_WIND_DOWN_MS,
} from "@/lib/sabotage/constants";

export type SabotagePhase = "wind-up" | "full" | "wind-down";

interface SabotageData {
  effect: string;
  timestamp: number;
}

interface UseSabotageEffectParams {
  /** The sabotage data for the current viewer (their incoming sabotage) */
  mySabotage: SabotageData | undefined;
  /** Current phase of the duel */
  phase: "idle" | "answering" | "transition";
  /** Whether the player has locked in their answer */
  isLocked: boolean;
}

interface UseSabotageEffectResult {
  activeSabotage: SabotageEffect | null;
  sabotagePhase: SabotagePhase;
  clearSabotageEffect: () => void;
}

/**
 * Manages sabotage effect state and timing.
 * Handles wind-up, full, and wind-down phases for sabotage effects.
 */
export function useSabotageEffect({
  mySabotage,
  phase,
  isLocked,
}: UseSabotageEffectParams): UseSabotageEffectResult {
  const [activeSabotage, setActiveSabotage] = useState<SabotageEffect | null>(null);
  const [sabotagePhase, setSabotagePhase] = useState<SabotagePhase>("wind-up");
  const lastSabotageTimestampRef = useRef<number | null>(null);
  const sabotageTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  // Helper to clear all sabotage timers and effect
  const clearSabotageEffect = useCallback(() => {
    sabotageTimersRef.current.forEach((timer) => clearTimeout(timer));
    sabotageTimersRef.current = [];
    setActiveSabotage(null);
    setSabotagePhase("wind-up");
  }, []);

  // Sabotage effect listener
  useEffect(() => {
    if (mySabotage && mySabotage.timestamp !== lastSabotageTimestampRef.current) {
      lastSabotageTimestampRef.current = mySabotage.timestamp;
      
      // Clear existing timers first
      sabotageTimersRef.current.forEach((timer) => clearTimeout(timer));
      sabotageTimersRef.current = [];
      
      // Use setTimeout to defer state updates and avoid cascading renders
      setTimeout(() => {
        setSabotagePhase("wind-up");
        setActiveSabotage(mySabotage.effect as SabotageEffect);

        const sabotageEffect = mySabotage.effect as SabotageEffect;

        // Bounce + trampoline + reverse last until question ends, not just 7 seconds
        if (
          sabotageEffect === "bounce" ||
          sabotageEffect === "trampoline" ||
          sabotageEffect === "reverse"
        ) {
          // For bounce/trampoline/reverse, skip phase transitions and duration timer
          // It will clear when question ends
          setSabotagePhase("full");
        } else {
          // Other effects follow the standard 7-second duration with phases
          const fullTimer = setTimeout(() => setSabotagePhase("full"), SABOTAGE_WIND_UP_MS);
          const windDownTimer = setTimeout(() => setSabotagePhase("wind-down"), SABOTAGE_WIND_DOWN_MS);
          const clearTimer = setTimeout(() => {
            setActiveSabotage(null);
            setSabotagePhase("wind-up");
          }, SABOTAGE_DURATION_MS);

          sabotageTimersRef.current = [fullTimer, windDownTimer, clearTimer];
        }
      }, 0);
    }
  }, [mySabotage]);

  // Clear sabotage when locked (except for persistent effects)
  useEffect(() => {
    if (
      isLocked &&
      activeSabotage !== "bounce" &&
      activeSabotage !== "trampoline" &&
      activeSabotage !== "reverse"
    ) {
      // Use setTimeout to defer state updates and avoid cascading renders
      setTimeout(() => {
        sabotageTimersRef.current.forEach((timer) => clearTimeout(timer));
        sabotageTimersRef.current = [];
        setActiveSabotage(null);
        setSabotagePhase("wind-up");
      }, 0);
    }
  }, [isLocked, activeSabotage]);

  // Clear sabotage when transitioning to next question
  useEffect(() => {
    if (phase === "transition") {
      // Use setTimeout to defer state updates and avoid cascading renders
      setTimeout(() => {
        sabotageTimersRef.current.forEach((timer) => clearTimeout(timer));
        sabotageTimersRef.current = [];
        setActiveSabotage(null);
        setSabotagePhase("wind-up");
      }, 0);
    }
  }, [phase]);

  return {
    activeSabotage,
    sabotagePhase,
    clearSabotageEffect,
  };
}

