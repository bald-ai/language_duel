import { useEffect, useMemo, useState } from "react";
import { getSabotageExpiryAt, isSabotageActive } from "@/lib/sabotage/active";
import type { SabotageState } from "@/lib/sabotage/types";

type OutgoingSabotage = SabotageState | undefined;

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
      effect: outgoingSabotageEffect,
      timestamp: outgoingSabotageTimestamp,
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
  }, [outgoingSabotageEffect, outgoingSabotageTimestamp]);

  return useMemo(
    () => isSabotageActive({
      sabotage: params.outgoingSabotage,
      now: sabotageNow,
      questionStartTime: params.questionStartTime,
    }),
    [params.outgoingSabotage, params.questionStartTime, sabotageNow]
  );
}
