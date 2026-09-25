"use client";

import { useState, useRef, useEffect } from "react";
import { TIMER_UPDATE_INTERVAL_MS } from "@/lib/duelConstants";

// `windowMs` is the per-position answer window (21s for words, 60s for
// sentences) — anchored on `relayAnswerStartedAt`, NOT `questionStartTime`
// (relay never sets that). Mirrors the server's `relayAnswerWindowMs`.
export function useRelayCountdown(
  active: boolean,
  startedAt: number | undefined,
  windowMs: number,
  onExpire: () => void,
): number | null {
  const [secondsLeft, setSecondsLeft] = useState<number | null>(() =>
    active && startedAt !== undefined
      ? Math.max(0, Math.ceil((startedAt + windowMs - Date.now()) / 1000))
      : null,
  );
  const firedRef = useRef(false);

  useEffect(() => {
    if (!active || startedAt === undefined) return;
    const tick = () => {
      const msLeft = startedAt + windowMs - Date.now();
      setSecondsLeft(Math.max(0, Math.ceil(msLeft / 1000)));
      if (msLeft <= 0 && !firedRef.current) {
        firedRef.current = true;
        onExpire();
      }
    };
    const interval = setInterval(tick, TIMER_UPDATE_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [active, startedAt, windowMs, onExpire]);

  return secondsLeft;
}
