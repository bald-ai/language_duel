"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { SabotageEffect } from "@/lib/sabotage/types";
import {
  getSabotagePhaseSchedule,
  shouldClearSabotageForQuestionPhase,
  shouldClearSabotageOnLock,
  type DuelQuestionPhase,
  type SabotagePhase,
} from "@/lib/sabotage/effectPhases";

export type { SabotagePhase } from "@/lib/sabotage/effectPhases";

interface SabotageData {
  effect: SabotageEffect;
  timestamp: number;
}

interface UseSabotageEffectParams {
  mySabotage: SabotageData | undefined;
  phase: DuelQuestionPhase;
  isLocked: boolean;
}

interface UseSabotageEffectResult {
  activeSabotage: SabotageEffect | null;
  sabotagePhase: SabotagePhase;
  /** Imperatively clear the active effect (e.g. the sentence board clears any
   * sabotage the instant the player presses Confirm, so the retry is clean). */
  clearSabotage: () => void;
}

export function useSabotageEffect({
  mySabotage,
  phase,
  isLocked,
}: UseSabotageEffectParams): UseSabotageEffectResult {
  const [activeSabotage, setActiveSabotage] = useState<SabotageEffect | null>(null);
  const [sabotagePhase, setSabotagePhase] = useState<SabotagePhase>("wind-up");
  const lastSabotageTimestampRef = useRef<number | null>(null);
  const sabotageTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const clearTimers = useCallback(() => {
    sabotageTimersRef.current.forEach((timer) => clearTimeout(timer));
    sabotageTimersRef.current = [];
  }, []);

  const scheduleTimer = useCallback((callback: () => void, delayMs: number) => {
    const timer = setTimeout(() => {
      sabotageTimersRef.current = sabotageTimersRef.current.filter((storedTimer) => storedTimer !== timer);
      callback();
    }, delayMs);
    sabotageTimersRef.current.push(timer);
  }, []);

  const clearActiveSabotage = useCallback(() => {
    clearTimers();
    setActiveSabotage(null);
    setSabotagePhase("wind-up");
  }, [clearTimers]);

  useEffect(() => {
    if (!mySabotage || mySabotage.timestamp === lastSabotageTimestampRef.current) return;

    lastSabotageTimestampRef.current = mySabotage.timestamp;
    clearTimers();

    scheduleTimer(() => {
      const sabotageEffect = mySabotage.effect;
      setSabotagePhase("wind-up");
      setActiveSabotage(sabotageEffect);

      getSabotagePhaseSchedule(sabotageEffect).forEach(({ delayMs, phase: nextPhase }) => {
        scheduleTimer(() => {
          if (nextPhase === null) {
            setActiveSabotage(null);
            setSabotagePhase("wind-up");
            return;
          }
          setSabotagePhase(nextPhase);
        }, delayMs);
      });
    }, 0);
  }, [clearTimers, mySabotage, scheduleTimer]);

  useEffect(() => {
    if (!isLocked || !shouldClearSabotageOnLock(activeSabotage)) return;
    scheduleTimer(clearActiveSabotage, 0);
  }, [activeSabotage, clearActiveSabotage, isLocked, scheduleTimer]);

  useEffect(() => {
    if (!shouldClearSabotageForQuestionPhase(phase)) return;
    scheduleTimer(clearActiveSabotage, 0);
  }, [clearActiveSabotage, phase, scheduleTimer]);

  useEffect(() => clearTimers, [clearTimers]);

  return {
    activeSabotage,
    sabotagePhase,
    clearSabotage: clearActiveSabotage,
  };
}
