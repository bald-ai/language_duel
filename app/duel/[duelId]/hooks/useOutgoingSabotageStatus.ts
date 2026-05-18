import { useEffect, useMemo, useState } from "react";
import {
  SABOTAGE_DURATION_MS,
  SABOTAGE_FALLBACK_DURATION_MS,
} from "@/lib/sabotage/constants";
import { getSabotageExpiryAt, isSabotageActive } from "@/lib/sabotage/active";
import type { SabotageEffect } from "@/lib/sabotage/types";

type OutgoingSabotage = {
  effect: SabotageEffect;
  timestamp: number;
} | undefined;

export function useOutgoingSabotageStatus(params: {
  outgoingSabotage: OutgoingSabotage;
  questionStartTime?: number;
}) {
  const [sabotageNow, setSabotageNow] = useState(() => Date.now());
  const outgoingSabotageEffect = params.outgoingSabotage?.effect;
  const outgoingSabotageTimestamp = params.outgoingSabotage?.timestamp;

  useEffect(() => {
    if (!outgoingSabotageEffect || typeof outgoingSabotageTimestamp !== "number") return;

    const refreshTimer = setTimeout(() => setSabotageNow(Date.now()), 0);

    const expiresAt = getSabotageExpiryAt({
      sabotage: { effect: outgoingSabotageEffect, timestamp: outgoingSabotageTimestamp },
      questionStartTime: params.questionStartTime,
      sabotageDurationMs: SABOTAGE_DURATION_MS,
      sabotageFallbackDurationMs: SABOTAGE_FALLBACK_DURATION_MS,
    });

    if (expiresAt === null) {
      return () => clearTimeout(refreshTimer);
    }

    const timer = setTimeout(
      () => setSabotageNow(Date.now()),
      Math.max(0, expiresAt - Date.now() + 50)
    );

    return () => {
      clearTimeout(refreshTimer);
      clearTimeout(timer);
    };
  }, [outgoingSabotageEffect, outgoingSabotageTimestamp, params.questionStartTime]);

  return useMemo(
    () => isSabotageActive({
      sabotage: params.outgoingSabotage,
      now: sabotageNow,
      questionStartTime: params.questionStartTime,
    }),
    [params.outgoingSabotage, params.questionStartTime, sabotageNow]
  );
}
