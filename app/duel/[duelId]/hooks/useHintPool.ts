"use client";

import { useCallback } from "react";
import { useMutation } from "convex/react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import type { HintType } from "@/lib/hintPool/types";
import { HINT_POOL_SIZE } from "@/lib/hintPool/constants";
import { getErrorMessage } from "./useDuelRaceErrors";

interface UseHintPoolArgs {
  duelId: Id<"duels">;
  usedHints: HintType[];
  currentQuestionHintFired: boolean;
}

export function useHintPool({
  duelId,
  usedHints,
  currentQuestionHintFired,
}: UseHintPoolArgs) {
  const fireHintMutation = useMutation(api.hintPool.fireHint);

  const fireHint = useCallback(
    async (hintType: HintType) => {
      try {
        await fireHintMutation({ duelId, hintType });
      } catch (error) {
        console.error("Failed to fire hint:", error);
        toast.error(getErrorMessage(error, "Failed to use hint"));
      }
    },
    [duelId, fireHintMutation]
  );

  return {
    usedHints,
    usedCount: usedHints.length,
    totalCount: HINT_POOL_SIZE,
    currentQuestionHintFired,
    fireHint,
  };
}
