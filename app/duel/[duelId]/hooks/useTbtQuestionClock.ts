import { useEffect, useRef, useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";
import {
  TBT_QUESTION_TIMEOUT_MS,
  TBT_QUESTION_TIMEOUT_SECONDS,
} from "@/lib/duelConstants";
import {
  clampTimerSeconds,
  getEffectiveQuestionStartTime,
} from "@/lib/duelTiming";

/** Shared sentence clock; either participant can notify the idempotent server timeout. */
export function useTbtQuestionClock(duel: Doc<"duels">) {
  const questionTimeout = useMutation(api.tbtDuel.tbtQuestionTimeout);
  const isCompleted = duel.status === "completed";
  const questionIndex = duel.currentItemIndex;
  const questionStartTime = duel.questionStartTime;
  const [secondsLeft, setSecondsLeft] = useState(TBT_QUESTION_TIMEOUT_SECONDS);
  const firedForRef = useRef<number | null>(null);

  useEffect(() => {
    if (isCompleted || questionStartTime === undefined) return;
    const tick = () => {
      const effectiveStart = getEffectiveQuestionStartTime(
        questionStartTime,
        questionIndex,
      );
      const remainingMs = effectiveStart + TBT_QUESTION_TIMEOUT_MS - Date.now();
      setSecondsLeft(
        clampTimerSeconds(
          Math.ceil(remainingMs / 1000),
          TBT_QUESTION_TIMEOUT_SECONDS,
        ),
      );
      if (remainingMs <= 0 && firedForRef.current !== questionIndex) {
        firedForRef.current = questionIndex;
        questionTimeout({ duelId: duel._id, questionIndex }).catch(() => {
          // A failed request can be retried on a later tick; the server verifies its window.
          firedForRef.current = null;
        });
      }
    };
    tick();
    const id = window.setInterval(tick, 250);
    return () => window.clearInterval(id);
  }, [
    questionStartTime,
    questionIndex,
    isCompleted,
    duel._id,
    questionTimeout,
  ]);
  return secondsLeft;
}
