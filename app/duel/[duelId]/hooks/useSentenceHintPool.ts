"use client";

import { useCallback } from "react";
import { useMutation } from "convex/react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import type { SentenceHintType } from "@/lib/sentenceGameplay/hints";
import { SENTENCE_HINT_POOL_SIZE } from "@/lib/sentenceGameplay/hints";
import { getErrorMessage } from "./useDuelRaceErrors";

interface UseSentenceHintPoolArgs {
  duelId: Id<"duels">;
  usedHints: SentenceHintType[];
  currentQuestionHintFired: boolean;
}

/**
 * PvE sentence hint pool state hook — the cooperative counterpart to PvP
 * sabotages on the build-and-confirm board. Mirrors `useHintPool` (the word
 * pool): wraps `api.hintPool.fireSentenceHint` and surfaces the shared pool
 * counts. The effect fields live on the duel doc, so both co-op players stay in
 * sync through the subscription.
 */
export function useSentenceHintPool({
  duelId,
  usedHints,
  currentQuestionHintFired,
}: UseSentenceHintPoolArgs) {
  const fireHintMutation = useMutation(api.hintPool.fireSentenceHint);

  const fireHint = useCallback(
    async (hintType: SentenceHintType) => {
      try {
        await fireHintMutation({ duelId, hintType });
      } catch (error) {
        console.error("Failed to fire sentence hint:", error);
        toast.error(getErrorMessage(error, "Failed to use hint"));
      }
    },
    [duelId, fireHintMutation]
  );

  return {
    usedHints,
    usedCount: usedHints.length,
    totalCount: SENTENCE_HINT_POOL_SIZE,
    currentQuestionHintFired,
    fireHint,
  };
}
