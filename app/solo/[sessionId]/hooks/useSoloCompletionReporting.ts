"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useMutation } from "convex/react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { getErrorMessage } from "@/lib/errors";
import type { SoloSessionState } from "@/lib/soloPracticeRuntime";

interface UseSoloCompletionReportingParams {
  soloPracticeSessionId: string | null;
  spacedRepetitionStep: number | null;
  isBossPractice: boolean;
  session: SoloSessionState;
  /** The base correct-answer handler from {@link useSoloSession}. */
  handleCorrect: () => void;
}

/**
 * Reports solo-practice progress back to the server for boss and
 * spaced-repetition sessions: per-item mastery as each item clears its max
 * level, the spaced-repetition step on completion (once all mastery writes
 * settle), and the boss completion on completion. Each report is latched
 * idle→pending→done so it fires at most once. Plain theme practice (no
 * `soloPracticeSessionId`) is a no-op and just returns the base correct handler.
 */
export function useSoloCompletionReporting({
  soloPracticeSessionId,
  spacedRepetitionStep,
  isBossPractice,
  session,
  handleCorrect,
}: UseSoloCompletionReportingParams): { handleCorrectWithProgress: () => void } {
  const completeSpacedRepetitionSoloPractice = useMutation(api.weeklyGoalRepetitions.completeRepetitionSoloPractice);
  const recordRepetitionSoloMastery = useMutation(api.weeklyGoalRepetitions.recordRepetitionSoloMastery);
  const completeBossSoloPractice = useMutation(api.weeklyGoals.completeBossSoloPractice);

  const spacedRepetitionReportStatusRef = useRef<"idle" | "pending" | "done">("idle");
  const bossCompletionStatusRef = useRef<"idle" | "pending" | "done">("idle");
  const reportedMasteryIndicesRef = useRef<Set<number>>(new Set());
  const pendingMasteryWritesRef = useRef(0);
  const [masteryWritesPending, setMasteryWritesPending] = useState(0);

  const handleCorrectWithProgress = useCallback(() => {
    const currentItemState =
      session.currentItemIndex === null
        ? null
        : session.itemStates.get(session.currentItemIndex) ?? null;
    const completedItemIndex =
      currentItemState && session.questionLevel >= currentItemState.maxLevel
        ? session.currentItemIndex
        : null;

    handleCorrect();

    if (
      soloPracticeSessionId &&
      spacedRepetitionStep !== null &&
      completedItemIndex !== null &&
      !reportedMasteryIndicesRef.current.has(completedItemIndex)
    ) {
      reportedMasteryIndicesRef.current.add(completedItemIndex);
      pendingMasteryWritesRef.current += 1;
      setMasteryWritesPending(pendingMasteryWritesRef.current);
      void recordRepetitionSoloMastery({
        soloPracticeSessionId: soloPracticeSessionId as Id<"soloPracticeSessions">,
        itemIndex: completedItemIndex,
      })
        .catch(() => {
          reportedMasteryIndicesRef.current.delete(completedItemIndex);
        })
        .finally(() => {
          pendingMasteryWritesRef.current = Math.max(
            0,
            pendingMasteryWritesRef.current - 1
          );
          setMasteryWritesPending(pendingMasteryWritesRef.current);
        });
    }
  }, [
    handleCorrect,
    recordRepetitionSoloMastery,
    session.currentItemIndex,
    session.itemStates,
    session.questionLevel,
    soloPracticeSessionId,
    spacedRepetitionStep,
  ]);

  useEffect(() => {
    if (
      !soloPracticeSessionId ||
      spacedRepetitionStep === null ||
      !session.completed ||
      spacedRepetitionReportStatusRef.current !== "idle" ||
      masteryWritesPending > 0
    ) {
      return;
    }

    spacedRepetitionReportStatusRef.current = "pending";
    void completeSpacedRepetitionSoloPractice({
      soloPracticeSessionId: soloPracticeSessionId as Id<"soloPracticeSessions">,
      completedStep: spacedRepetitionStep,
    })
      .then((result) => {
        if (result.advanced) {
          spacedRepetitionReportStatusRef.current = "done";
          return;
        }

        spacedRepetitionReportStatusRef.current = "done";
        toast.error(
          "Practice finished, but your repetition progress could not be saved. Please try again from the repetition board."
        );
      })
      .catch((error) => {
        spacedRepetitionReportStatusRef.current = "idle";
        toast.error(getErrorMessage(error, "Could not save practice progress"));
      });
  }, [
    soloPracticeSessionId,
    completeSpacedRepetitionSoloPractice,
    session.completed,
    spacedRepetitionStep,
    masteryWritesPending,
  ]);

  useEffect(() => {
    if (
      !soloPracticeSessionId ||
      !isBossPractice ||
      !session.completed ||
      bossCompletionStatusRef.current !== "idle"
    ) {
      return;
    }

    bossCompletionStatusRef.current = "pending";
    void completeBossSoloPractice({
      soloPracticeSessionId: soloPracticeSessionId as Id<"soloPracticeSessions">,
    })
      .then(() => {
        bossCompletionStatusRef.current = "done";
      })
      .catch((error) => {
        bossCompletionStatusRef.current = "idle";
        toast.error(getErrorMessage(error, "Could not save boss progress"));
      });
  }, [
    soloPracticeSessionId,
    isBossPractice,
    session.completed,
    completeBossSoloPractice,
  ]);

  return { handleCorrectWithProgress };
}
