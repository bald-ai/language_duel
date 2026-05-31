"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation } from "convex/react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";
import { useAppearanceColors } from "@/app/components/AppearanceProvider";
import { getErrorMessage } from "@/lib/errors";
import { SENTENCE_TIMER_SECONDS } from "@/lib/themes/sentenceConstants";
import { clampTimerSeconds, getEffectiveQuestionStartTime } from "@/lib/duelTiming";
import { SentenceBuildBoard } from "./SentenceBuildBoard";
import { SentenceHintPoolUI } from "./SentenceHintPoolUI";
import { useSentenceHintPool } from "../hooks/useSentenceHintPool";
import type { ViewerSafeSentenceSessionItem } from "../hooks/duelSessionTypes";

interface SentenceBoardProps {
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

/**
 * The unified build-and-confirm sentence board (every mode: PvE / PvP / self).
 * The player taps tiles in any order — each gets an order badge — peels back
 * from the end, and verifies the whole sentence on Confirm. The server holds the
 * placed sequence; the only client-only state is the last Confirm's correctness
 * mask (green/red), which clears the instant the player edits.
 *
 * Tools differ by mode, like word rounds: PvE mounts the cooperative hint pool
 * in the footer (the effects ride on shared duel fields, so both co-op boards
 * stay in sync). PvP sabotages are handled separately. Re-mounted via
 * `key={duel.currentWordIndex}` so per-round state resets on advance.
 */
export function SentenceBoard({
  duel,
  sessionItem,
  question,
  viewerRole,
}: SentenceBoardProps) {
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

  // PvE cooperative hint pool (self-duels are pve mode, so they get it too). The
  // per-question effect fields are shared on the duel doc, so both boards mark
  // the same tiles. PvP gets sabotages instead (handled separately).
  const isPve = duel.duelMode === "pve";
  const hintPool = useSentenceHintPool({
    duelId: duel._id,
    usedHints: duel.sentenceHintPoolUsed,
    currentQuestionHintFired: duel.currentQuestionHintFired,
  });
  const eliminatedTileIndices = useMemo(
    () => duel.currentQuestionEliminatedTileIndices ?? [],
    [duel.currentQuestionEliminatedTileIndices]
  );
  const revealedTiles = useMemo(
    () => duel.currentQuestionRevealedTiles ?? [],
    [duel.currentQuestionRevealedTiles]
  );

  // Timer: base + accumulated hint bonus is the single source of truth, used as
  // BOTH the value and the clamp ceiling so a freeze hint's seconds aren't eaten
  // (the mutation does not push questionStartTime, so there's no double count).
  const totalTimer = SENTENCE_TIMER_SECONDS + (duel.currentQuestionTimerBonusSeconds ?? 0);
  const questionStartTime = duel.questionStartTime;
  const [secondsLeft, setSecondsLeft] = useState(() => {
    if (!questionStartTime) return totalTimer;
    const effectiveStartTime = getEffectiveQuestionStartTime(
      questionStartTime,
      duel.currentWordIndex
    );
    const elapsed = Math.floor((Date.now() - effectiveStartTime) / 1000);
    return clampTimerSeconds(totalTimer - elapsed, totalTimer);
  });
  useEffect(() => {
    if (!questionStartTime) return;
    const tick = () => {
      const effectiveStartTime = getEffectiveQuestionStartTime(
        questionStartTime,
        duel.currentWordIndex
      );
      const elapsed = Math.floor((Date.now() - effectiveStartTime) / 1000);
      setSecondsLeft(clampTimerSeconds(totalTimer - elapsed, totalTimer));
    };
    tick();
    const interval = setInterval(tick, 250);
    return () => clearInterval(interval);
  }, [totalTimer, questionStartTime, duel.currentWordIndex]);

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

  // Auto-submit on timeout (Confirm never auto-fires).
  useEffect(() => {
    if (secondsLeft === 0 && !completed && !submittedRef.current) {
      void handleSubmitFinal(true);
    }
  }, [handleSubmitFinal, secondsLeft, completed]);

  const locked = completed || secondsLeft === 0;

  const handleTileClick = useCallback(
    (tileIndex: number) => {
      if (locked) return;
      // A removed distractor is inert — skip it in the place/peel handler.
      if (eliminatedTileIndices.includes(tileIndex)) return;
      // Touching any tile clears the previous Confirm's colors.
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
      // A placed-but-not-last tile is not removable — peel back from the end.
    },
    [locked, eliminatedTileIndices, checked, placedTileIndices, tap, removeLast, duel._id, duel.currentWordIndex]
  );

  // After a Confirm, the button stays disabled until the player edits the board
  // (any tap/peel/reset clears `correctnessMask`).
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
      eliminatedTileIndices={eliminatedTileIndices}
      revealedTiles={revealedTiles}
      secondsLeft={secondsLeft}
      locked={locked}
      showActions
      confirmDisabled={confirmDisabled}
      onTileClick={handleTileClick}
      onConfirm={handleConfirm}
      onReset={handleReset}
      belowActions={
        <>
          {isPve && !locked && (
            <div className="mt-4">
              <SentenceHintPoolUI
                usedHints={hintPool.usedHints}
                usedCount={hintPool.usedCount}
                totalCount={hintPool.totalCount}
                currentQuestionHintFired={hintPool.currentQuestionHintFired}
                onFireHint={(type) => void hintPool.fireHint(type)}
              />
            </div>
          )}

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
