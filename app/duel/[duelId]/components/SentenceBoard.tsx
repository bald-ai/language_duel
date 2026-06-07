"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation } from "convex/react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";
import { useAppearanceColors } from "@/app/components/AppearanceProvider";
import { SpeakerIcon } from "@/app/components/icons";
import { useTTS } from "@/hooks/useTTS";
import { getErrorMessage } from "@/lib/errors";
import { forRole } from "@/lib/duelRole";
import { MAX_SABOTAGES } from "@/lib/sabotage/constants";
import type { SabotageEffect } from "@/lib/sabotage/types";
import { SENTENCE_TIMER_SECONDS } from "@/lib/themes/sentenceConstants";
import { clampTimerSeconds, getEffectiveQuestionStartTime } from "@/lib/duelTiming";
import { SentenceBuildBoard } from "./SentenceBuildBoard";
import { SentenceHintPoolUI } from "./SentenceHintPoolUI";
import { SabotageSystemUI } from "./SabotageSystemUI";
import { getListenButtonStyle } from "./duelViewStyles";
import { useSentenceHintPool } from "../hooks/useSentenceHintPool";
import { useSabotageEffect } from "../hooks/useSabotageEffect";
import type { ViewerSafeSentenceSessionItem } from "../hooks/duelSessionTypes";

interface SentenceBoardProps {
  duel: Doc<"duels">;
  sessionItem: ViewerSafeSentenceSessionItem;
  question: {
    kind: "sentence";
    englishPrompt: string;
    tilePool: string[];
    tileMeanings?: Array<string | null>;
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
 * (effects ride on shared duel fields, so both co-op boards stay in sync); PvP
 * mounts the sabotage footer AND receives the opponent's incoming sabotage,
 * which is drawn on the board (unplaced tiles fly / scramble, sticky overlays).
 * Re-mounted via `key={duel.currentItemIndex}` so per-round state resets.
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
  const sendSabotage = useMutation(api.sabotage.sendSabotage);
  const { isPlaying: isPlayingAudio, playTTS } = useTTS();

  const submittedRef = useRef(false);

  // Per-Confirm correctness snapshot (client-only). `null` = not checked.
  // Cleared on any board edit so colors only show right after a Confirm.
  const [correctnessMask, setCorrectnessMask] = useState<boolean[] | null>(null);
  const checked = correctnessMask !== null;

  const progress = useMemo(() => {
    return (duel.sentenceProgress ?? []).find(
      (entry) =>
        entry.questionIndex === duel.currentItemIndex && entry.role === viewerRole
    );
  }, [duel.sentenceProgress, duel.currentItemIndex, viewerRole]);

  const placedTileIndices = useMemo(
    () => progress?.placedTileIndices ?? [],
    [progress]
  );
  const completed = progress?.completed ?? false;

  const isPve = duel.duelMode === "pve";
  const isPvp = duel.duelMode === "pvp";

  // PvE cooperative hint pool (self-duels are pve mode, so they get it too). The
  // per-question effect fields are shared on the duel doc, so both boards mark
  // the same tiles.
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

  // PvP sabotage state (the role view gives the incoming effect + outgoing budget).
  const roleView = useMemo(() => forRole(duel, viewerRole), [duel, viewerRole]);

  // Timer: base + accumulated hint bonus is the single source of truth, used as
  // BOTH the value and the clamp ceiling so a freeze hint's seconds aren't eaten
  // (the mutation does not push questionStartTime, so there's no double count).
  const totalTimer = SENTENCE_TIMER_SECONDS + (duel.currentQuestionTimerBonusSeconds ?? 0);
  const questionStartTime = duel.questionStartTime;
  const [secondsLeft, setSecondsLeft] = useState(() => {
    if (!questionStartTime) return totalTimer;
    const effectiveStartTime = getEffectiveQuestionStartTime(
      questionStartTime,
      duel.currentItemIndex
    );
    const elapsed = Math.floor((Date.now() - effectiveStartTime) / 1000);
    return clampTimerSeconds(totalTimer - elapsed, totalTimer);
  });
  useEffect(() => {
    if (!questionStartTime) return;
    const tick = () => {
      const effectiveStartTime = getEffectiveQuestionStartTime(
        questionStartTime,
        duel.currentItemIndex
      );
      const elapsed = Math.floor((Date.now() - effectiveStartTime) / 1000);
      setSecondsLeft(clampTimerSeconds(totalTimer - elapsed, totalTimer));
    };
    tick();
    const interval = setInterval(tick, 250);
    return () => clearInterval(interval);
  }, [totalTimer, questionStartTime, duel.currentItemIndex]);

  const locked = completed || secondsLeft === 0;

  // Incoming sabotage (the effect my opponent sent ME). Movement effects persist
  // for the question; sticky auto-clears on its own ~7s timer. `clearSabotage`
  // lets Confirm wipe the effect so the retry is a clean board (see handleConfirm).
  const { activeSabotage, sabotagePhase, clearSabotage } = useSabotageEffect({
    mySabotage: isPvp ? roleView.mySabotage : undefined,
    phase: "answering",
    isLocked: locked,
  });

  const handleSubmitFinal = useCallback(
    async (timedOut: boolean) => {
      if (submittedRef.current) return;
      submittedRef.current = true;
      try {
        await submit({
          duelId: duel._id,
          questionIndex: duel.currentItemIndex,
          timedOut,
        });
      } catch (error) {
        submittedRef.current = false;
        toast.error(getErrorMessage(error, "Could not submit sentence"));
      }
    },
    [submit, duel._id, duel.currentItemIndex]
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
          questionIndex: duel.currentItemIndex,
          tileIndex,
        }).catch((error) => toast.error(getErrorMessage(error, "Could not place tile")));
        return;
      }
      if (order === placedTileIndices.length - 1) {
        void removeLast({
          duelId: duel._id,
          questionIndex: duel.currentItemIndex,
        }).catch((error) => toast.error(getErrorMessage(error, "Could not remove tile")));
      }
      // A placed-but-not-last tile is not removable — peel back from the end.
    },
    [locked, eliminatedTileIndices, checked, placedTileIndices, tap, removeLast, duel._id, duel.currentItemIndex]
  );

  // After a Confirm, the button stays disabled until the player edits the board
  // (any tap/peel/reset clears `correctnessMask`).
  const confirmDisabled = locked || placedTileIndices.length === 0 || checked;

  const handleConfirm = useCallback(() => {
    if (confirmDisabled) return;
    // First Confirm clears any active sabotage so the second attempt is a clean
    // board — we don't keep sabotaging across retries (one-per-question already
    // stops the opponent re-sending, so a client-side clear is sufficient).
    clearSabotage();
    void confirm({
      duelId: duel._id,
      questionIndex: duel.currentItemIndex,
    })
      .then((result) => setCorrectnessMask(result.correctnessMask))
      .catch((error) => toast.error(getErrorMessage(error, "Could not check sentence")));
  }, [confirmDisabled, clearSabotage, confirm, duel._id, duel.currentItemIndex]);

  const handleReset = useCallback(() => {
    if (locked || placedTileIndices.length === 0) return;
    setCorrectnessMask(null);
    void clearBoard({
      duelId: duel._id,
      questionIndex: duel.currentItemIndex,
    }).catch((error) => toast.error(getErrorMessage(error, "Could not reset board")));
  }, [locked, placedTileIndices.length, clearBoard, duel._id, duel.currentItemIndex]);

  const handleSendSabotage = useCallback(
    (effect: SabotageEffect) => {
      void sendSabotage({ duelId: duel._id, effect }).catch((error) =>
        toast.error(getErrorMessage(error, "Could not send sabotage"))
      );
    },
    [sendSabotage, duel._id]
  );
  const canPlaySentenceAudio =
    question.answerRevealedToViewer === true &&
    !!question.spanishSentence &&
    !!sessionItem.ttsStorageId;
  const handlePlaySentenceAudio = useCallback(() => {
    if (!canPlaySentenceAudio || !question.spanishSentence || !sessionItem.ttsStorageId) return;
    void playTTS(`duel-sentence-${duel._id}-${duel.currentItemIndex}`, question.spanishSentence, {
      storageId: sessionItem.ttsStorageId,
      themeId: String(sessionItem.themeId),
    });
  }, [
    canPlaySentenceAudio,
    duel._id,
    duel.currentItemIndex,
    playTTS,
    question.spanishSentence,
    sessionItem.themeId,
    sessionItem.ttsStorageId,
  ]);

  // Outgoing-sabotage footer inputs (PvP only), mirroring the word DuelFooter.
  // "Already sabotaged this question" = my outgoing sabotage is timestamped at or
  // after the current question's start.
  const hasSentSabotageThisQuestion =
    typeof duel.questionStartTime === "number" &&
    typeof roleView.theirSabotage?.timestamp === "number" &&
    roleView.theirSabotage.timestamp >= duel.questionStartTime;

  return (
    <SentenceBuildBoard
      roundLabel={`Round ${duel.currentItemIndex + 1} of ${duel.sessionItems.length}`}
      themeName={sessionItem.themeName}
      englishPrompt={question.englishPrompt}
      tilePool={question.tilePool}
      tileMeanings={question.tileMeanings}
      placedTileIndices={placedTileIndices}
      correctnessMask={correctnessMask}
      eliminatedTileIndices={eliminatedTileIndices}
      revealedTiles={revealedTiles}
      activeSabotage={activeSabotage}
      sabotagePhase={sabotagePhase}
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

          {isPvp && (
            <div className="mt-4">
              <SabotageSystemUI
                status={duel.status}
                phase="answering"
                isRoundOver={false}
                sabotagesRemaining={MAX_SABOTAGES - roleView.mySabotagesUsed}
                isLocked={locked}
                hasAnswered={roleView.myAnswered}
                hasSentSabotageThisQuestion={hasSentSabotageThisQuestion}
                opponentHasAnswered={roleView.theirAnswered}
                onSendSabotage={handleSendSabotage}
                dataTestIdBase="sentence-sabotage"
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

          {canPlaySentenceAudio && (
            <button
              type="button"
              onClick={handlePlaySentenceAudio}
              disabled={isPlayingAudio}
              className="mt-3 inline-flex items-center gap-2 rounded-xl border-2 px-5 py-2 text-sm font-bold shadow-lg transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-70"
              style={getListenButtonStyle(colors, isPlayingAudio)}
              data-testid="sentence-listen"
            >
              <SpeakerIcon className="h-4 w-4" />
              <span>{isPlayingAudio ? "Playing..." : "Listen"}</span>
            </button>
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
