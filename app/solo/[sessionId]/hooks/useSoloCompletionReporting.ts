"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
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
 * spaced-repetition sessions: per-word mastery as each word clears Level 3, the
 * spaced-repetition step on completion (once all mastery writes settle), and the
 * boss completion on completion. Each report is latched idle→pending→done so it
 * fires at most once. Plain theme practice (no `soloPracticeSessionId`) is a
 * no-op and just returns the base correct handler.
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
    const completedWordIndex =
      session.questionLevel === 3 ? session.currentWordIndex : null;

    handleCorrect();

    if (
      soloPracticeSessionId &&
      spacedRepetitionStep !== null &&
      completedWordIndex !== null &&
      !reportedMasteryIndicesRef.current.has(completedWordIndex)
    ) {
      reportedMasteryIndicesRef.current.add(completedWordIndex);
      pendingMasteryWritesRef.current += 1;
      setMasteryWritesPending(pendingMasteryWritesRef.current);
      void recordRepetitionSoloMastery({
        soloPracticeSessionId: soloPracticeSessionId as Id<"soloPracticeSessions">,
        wordIndex: completedWordIndex,
      })
        .catch(() => {
          reportedMasteryIndicesRef.current.delete(completedWordIndex);
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
    session.currentWordIndex,
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
        spacedRepetitionReportStatusRef.current = result.advanced ? "done" : "idle";
      })
      .catch(() => {
        spacedRepetitionReportStatusRef.current = "idle";
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
      .catch(() => {
        bossCompletionStatusRef.current = "idle";
      });
  }, [
    soloPracticeSessionId,
    isBossPractice,
    session.completed,
    completeBossSoloPractice,
  ]);

  return { handleCorrectWithProgress };
}
