"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation } from "convex/react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";
import { useAppearanceColors } from "@/app/components/AppearanceProvider";
import { getErrorMessage } from "@/lib/errors";
import { isSelfDuel } from "@/lib/duel/selfDuel";
import {
  SENTENCE_PVE_TIMER_SECONDS,
  SENTENCE_PVP_TIMER_SECONDS,
  SENTENCE_SELF_DUEL_TIMER_SECONDS,
} from "@/lib/themes/sentenceConstants";
import { clampTimerSeconds, getEffectiveQuestionStartTime } from "@/lib/duelTiming";
import { SentenceBuildBoard } from "./SentenceBuildBoard";
import type { ViewerSafeSentenceSessionItem } from "../hooks/duelSessionTypes";

interface SentencePvpBoardProps {
  duel: Doc<"duels">;
  sessionItem: ViewerSafeSentenceSessionItem;
  question: {
    kind: "sentence";
    englishPrompt: string;
    tilePool: string[];
    spanishSentence?: string;
    answerRevealedToViewer?: boolean;
  };
  viewerRole: "challenger" | "opponent";
}

function pickTimerSeconds(duel: Doc<"duels">): number {
  if (isSelfDuel(duel)) return SENTENCE_SELF_DUEL_TIMER_SECONDS;
  if (duel.duelMode === "pve") return SENTENCE_PVE_TIMER_SECONDS;
  return SENTENCE_PVP_TIMER_SECONDS;
}

/**
 * PvP build-and-confirm sentence board (Variant 1). The player taps tiles in
 * any order — each gets an order badge — peels back from the end, and verifies
 * the whole sentence on Confirm. The server holds the placed sequence; the only
 * client-only state is the last Confirm's correctness mask, which colors tiles
 * green/red and clears the instant the player edits (decision 7).
 *
 * Re-mounted via `key={duel.currentWordIndex}` so per-round state resets on
 * advance. Auto-submits via `answerSentenceRound` on a correct Confirm
 * (server-confirmed `completed`) or on timeout — mirrors the word duel.
 */
export function SentencePvpBoard({
  duel,
  sessionItem,
  question,
  viewerRole,
}: SentencePvpBoardProps) {
  const colors = useAppearanceColors();
  const submit = useMutation(api.gameplay.answerSentenceRound);
  const tap = useMutation(api.gameplay.tapSentenceTile);
  const removeLast = useMutation(api.gameplay.removeLastSentenceTile);
  const clearBoard = useMutation(api.gameplay.clearSentenceBoard);
  const confirm = useMutation(api.gameplay.confirmSentenceRound);

  const submittedRef = useRef(false);

  // Per-Confirm correctness snapshot (client-only). `null` = not checked.
  // Cleared on any board edit so colors only show right after a Confirm.
  const [correctnessMask, setCorrectnessMask] = useState<boolean[] | null>(null);
  const checked = correctnessMask !== null;

  const progress = useMemo(() => {
    return (duel.sentenceProgress ?? []).find(
      (entry) =>
        entry.questionIndex === duel.currentWordIndex && entry.role === viewerRole
    );
  }, [duel.sentenceProgress, duel.currentWordIndex, viewerRole]);

  const placedTileIndices = useMemo(
    () => progress?.placedTileIndices ?? [],
    [progress]
  );
  const completed = progress?.completed ?? false;

  const timerSeconds = pickTimerSeconds(duel);
  const questionStartTime = duel.questionStartTime;
  const [secondsLeft, setSecondsLeft] = useState(() => {
    if (!questionStartTime) return timerSeconds;
    const effectiveStartTime = getEffectiveQuestionStartTime(
      questionStartTime,
      duel.currentWordIndex
    );
    const elapsed = Math.floor((Date.now() - effectiveStartTime) / 1000);
    return clampTimerSeconds(timerSeconds - elapsed, timerSeconds);
  });
  useEffect(() => {
    if (!questionStartTime) return;
    const tick = () => {
      const effectiveStartTime = getEffectiveQuestionStartTime(
        questionStartTime,
        duel.currentWordIndex
      );
      const elapsed = Math.floor((Date.now() - effectiveStartTime) / 1000);
      setSecondsLeft(clampTimerSeconds(timerSeconds - elapsed, timerSeconds));
    };
    tick();
    const interval = setInterval(tick, 250);
    return () => clearInterval(interval);
  }, [timerSeconds, questionStartTime, duel.currentWordIndex]);

  const handleSubmitFinal = useCallback(
    async (timedOut: boolean) => {
      if (submittedRef.current) return;
      submittedRef.current = true;
      try {
        await submit({
          duelId: duel._id,
          questionIndex: duel.currentWordIndex,
          timedOut,
        });
      } catch (error) {
        submittedRef.current = false;
        toast.error(getErrorMessage(error, "Could not submit sentence"));
      }
    },
    [submit, duel._id, duel.currentWordIndex]
  );

  // Auto-submit when a correct Confirm marks the round completed (server-confirmed).
  useEffect(() => {
    if (completed && !submittedRef.current) {
      void handleSubmitFinal(false);
    }
  }, [completed, handleSubmitFinal]);

  // Auto-submit on timeout (Confirm never auto-fires — decision 5).
  useEffect(() => {
    if (secondsLeft === 0 && !completed && !submittedRef.current) {
      void handleSubmitFinal(true);
    }
  }, [handleSubmitFinal, secondsLeft, completed]);

  const locked = completed || secondsLeft === 0;

  const handleTileClick = useCallback(
    (tileIndex: number) => {
      if (locked) return;
      // Touching any tile clears the previous Confirm's colors (decision 7).
      if (checked) setCorrectnessMask(null);

      const order = placedTileIndices.indexOf(tileIndex);
      if (order === -1) {
        void tap({
          duelId: duel._id,
          questionIndex: duel.currentWordIndex,
          tileIndex,
        }).catch((error) => toast.error(getErrorMessage(error, "Could not place tile")));
        return;
      }
      if (order === placedTileIndices.length - 1) {
        void removeLast({
          duelId: duel._id,
          questionIndex: duel.currentWordIndex,
        }).catch((error) => toast.error(getErrorMessage(error, "Could not remove tile")));
      }
      // A placed-but-not-last tile is not removable — the mask clear above is
      // the only effect (peel back from the end to reach it).
    },
    [locked, checked, placedTileIndices, tap, removeLast, duel._id, duel.currentWordIndex]
  );

  // After a Confirm, the button stays disabled until the player edits the board
  // (any tap/peel/reset clears `correctnessMask`). Stops repeated clicks on the
  // same wrong sentence from stacking penalties.
  const confirmDisabled = locked || placedTileIndices.length === 0 || checked;

  const handleConfirm = useCallback(() => {
    if (confirmDisabled) return;
    void confirm({
      duelId: duel._id,
      questionIndex: duel.currentWordIndex,
    })
      .then((result) => setCorrectnessMask(result.correctnessMask))
      .catch((error) => toast.error(getErrorMessage(error, "Could not check sentence")));
  }, [confirmDisabled, confirm, duel._id, duel.currentWordIndex]);

  const handleReset = useCallback(() => {
    if (locked || placedTileIndices.length === 0) return;
    setCorrectnessMask(null);
    void clearBoard({
      duelId: duel._id,
      questionIndex: duel.currentWordIndex,
    }).catch((error) => toast.error(getErrorMessage(error, "Could not reset board")));
  }, [locked, placedTileIndices.length, clearBoard, duel._id, duel.currentWordIndex]);

  return (
    <SentenceBuildBoard
      roundLabel={`Round ${duel.currentWordIndex + 1} of ${duel.sessionWords.length}`}
      themeName={sessionItem.themeName}
      englishPrompt={question.englishPrompt}
      tilePool={question.tilePool}
      placedTileIndices={placedTileIndices}
      correctnessMask={correctnessMask}
      secondsLeft={secondsLeft}
      locked={locked}
      showActions
      confirmDisabled={confirmDisabled}
      onTileClick={handleTileClick}
      onConfirm={handleConfirm}
      onReset={handleReset}
      belowActions={
        <>
          {question.answerRevealedToViewer === true && question.spanishSentence && (
            <div
              className="mt-5 w-full max-w-md rounded-xl border-2 p-3 text-center text-sm font-semibold shadow"
              style={{
                borderColor: colors.status.success.dark,
                backgroundColor: colors.status.success.DEFAULT,
                color: "#fff",
              }}
              data-testid="sentence-feedback"
            >
              Correct: {question.spanishSentence}
            </div>
          )}

          {completed && (
            <div
              className="mt-3 rounded-lg px-4 py-2 text-sm font-semibold shadow"
              style={{ backgroundColor: colors.status.success.DEFAULT, color: "#fff" }}
              data-testid="sentence-completed"
            >
              Sentence built — waiting for the round to advance.
            </div>
          )}
        </>
      }
    />
  );
}
