"use client";

import { useEffect, useMemo, useState } from "react";
import { useAppearanceColors } from "@/app/components/AppearanceProvider";
import { isSoloStudyTimerInfinite } from "@/lib/soloLearnTimer";
import { TIMER_THRESHOLDS } from "../constants";

/**
 * Counts the study timer down from `initialDuration` once the session is ready,
 * and derives the green/yellow/red color for the remaining time. The countdown
 * is constant from `initialDuration`, so no separate mutable `duration` is kept.
 */
export function useSoloLearnTimer(initialDuration: number, isSessionReady: boolean) {
  const colors = useAppearanceColors();
  const [timeRemaining, setTimeRemaining] = useState(initialDuration);

  useEffect(() => {
    if (!isSessionReady) return;
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
  }, [isSessionReady]);

  const timerStyle = useMemo(() => {
    if (isSoloStudyTimerInfinite(initialDuration)) {
      return { color: colors.status.success.DEFAULT };
    }
    const percentage = timeRemaining / initialDuration;
    if (percentage > TIMER_THRESHOLDS.GREEN) return { color: colors.status.success.DEFAULT };
    if (percentage > TIMER_THRESHOLDS.YELLOW) return { color: colors.status.warning.DEFAULT };
    return { color: colors.status.danger.DEFAULT };
  }, [colors, timeRemaining, initialDuration]);

  return { timeRemaining, timerStyle };
}
