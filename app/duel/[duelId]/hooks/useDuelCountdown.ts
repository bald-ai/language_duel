"use client";

import { useEffect, useRef, useState } from "react";

interface UseDuelCountdownArgs {
  phase: "idle" | "answering" | "transition";
  duelStatus: string;
  countdownPausedBy?: string;
  countdownSkipRequestedBy: string[];
  onCountdownComplete: () => void;
}

export function useDuelCountdown({
  phase,
  duelStatus,
  countdownPausedBy,
  countdownSkipRequestedBy,
  onCountdownComplete,
}: UseDuelCountdownArgs) {
  const [countdown, setCountdown] = useState<number | null>(null);
  const prevCountdownPausedByRef = useRef<string | undefined>(countdownPausedBy);

  useEffect(() => {
    const wasPaused = prevCountdownPausedByRef.current;
    const isNowUnpaused = !countdownPausedBy;

    if (wasPaused && isNowUnpaused && countdown !== null && phase === "transition") {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- countdown reset is the transition event we are syncing to.
      setCountdown(1);
    }

    prevCountdownPausedByRef.current = countdownPausedBy;
  }, [countdownPausedBy, countdown, phase]);

  useEffect(() => {
    if (countdown === null || phase !== "transition") return;
    if (countdownPausedBy) return;

    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }

    if (duelStatus !== "completed") {
      onCountdownComplete();
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- state machine transition endpoint, not derived render state.
    setCountdown(null);
  }, [countdown, duelStatus, countdownPausedBy, phase, onCountdownComplete]);

  useEffect(() => {
    if (countdown === null || phase !== "transition") return;
    if (countdownSkipRequestedBy.includes("challenger") && countdownSkipRequestedBy.includes("opponent")) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- both-player skip should immediately collapse the countdown.
      setCountdown(0);
    }
  }, [countdownSkipRequestedBy, countdown, phase]);

  return { countdown, setCountdown };
}
