"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation } from "convex/react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";
import { useAppearanceColors } from "@/app/components/AppearanceProvider";
import { Scoreboard } from "@/app/game/components/duel/Scoreboard";
import { formatVisibleUser } from "@/lib/userDisplay";
import { getErrorMessage } from "@/lib/errors";
import { isSelfDuel } from "@/lib/duel/selfDuel";
import {
  SENTENCE_PVE_TIMER_SECONDS,
  SENTENCE_PVP_TIMER_SECONDS,
  SENTENCE_SELF_DUEL_TIMER_SECONDS,
} from "@/lib/themes/sentenceConstants";
import { formatSentenceTileForDisplay } from "@/lib/sentenceGameplay/displayTile";
import type { ViewerSafeSentenceSessionItem } from "../hooks/duelSessionTypes";
import type { DuelPlayerSummary } from "../hooks/useDuelSessionViewModel";

interface SentenceRoundViewProps {
  duel: Doc<"duels">;
  challenger: DuelPlayerSummary | null;
  opponent: DuelPlayerSummary | null;
  viewerRole: "challenger" | "opponent";
  sessionItem: ViewerSafeSentenceSessionItem;
  /**
   * Server-shipped sentence question for the current position. Tile pool is
   * pre-shuffled. The `spanishSentence` answer key is masked during active
   * play and only present in the post-round reveal (`answerRevealedToViewer`).
   */
  question: {
    kind: "sentence";
    englishPrompt: string;
    tilePool: string[];
    spanishSentence?: string;
    answerRevealedToViewer?: boolean;
  };
}

function pickTimerSeconds(duel: Doc<"duels">): number {
  if (isSelfDuel(duel)) return SENTENCE_SELF_DUEL_TIMER_SECONDS;
  if (duel.duelMode === "pve") return SENTENCE_PVE_TIMER_SECONDS;
  // pvp / relay both use the per-player 30s timer.
  return SENTENCE_PVP_TIMER_SECONDS;
}

/**
 * Per-player sentence round surface. Each player builds their own copy of the
 * sentence locally; when complete (or on timeout) the result is submitted to
 * the server via `answerSentenceRound`. Server scores per the clean / messy
 * tier and advances once both players have submitted (mirrors word rounds).
 *
 * Round-aware mounting: this component intentionally does NOT mount the
 * hint/sabotage footer (plan decision: word-only tools are absent on sentence
 * rounds). Exit and scoreboard match the DuelView chrome. The per-round
 * board state lives on `SentenceRoundBoard` and resets via `key` whenever
 * the duel advances to a new question.
 */
export function SentenceRoundView({
  duel,
  challenger,
  opponent,
  viewerRole,
  sessionItem,
  question,
}: SentenceRoundViewProps) {
  const colors = useAppearanceColors();
  const router = useRouter();
  const stopDuel = useMutation(api.duels.stopDuel);

  const isChallenger = viewerRole === "challenger";
  const myScore = isChallenger ? duel.challengerScore : duel.opponentScore;
  const theirScore = isChallenger ? duel.opponentScore : duel.challengerScore;
  const myName = formatVisibleUser(isChallenger ? challenger : opponent, "You");
  const theirName = formatVisibleUser(isChallenger ? opponent : challenger, "Opponent");

  const handleExit = useCallback(() => {
    void stopDuel({ duelId: duel._id })
      .then(() => router.push("/"))
      .catch((error) => toast.error(getErrorMessage(error, "Could not exit duel")));
  }, [duel._id, router, stopDuel]);

  return (
    <main
      className="min-h-dvh md:flex md:items-center md:justify-center md:p-6 lg:p-8"
      style={{ color: colors.text.DEFAULT }}
    >
      <div
        className="w-full md:max-w-md lg:max-w-lg md:rounded-2xl md:border md:shadow-2xl flex flex-col min-h-dvh md:min-h-0 md:h-[85vh] md:max-h-[800px] bg-[var(--duel-bg)] md:bg-[var(--duel-bg-elevated)]"
        style={{ borderColor: colors.primary.dark }}
      >
        <header
          className="flex-shrink-0 flex items-center justify-between p-3 md:p-4 pt-[max(0.75rem,var(--sat))] md:pt-4 border-b"
          style={{ borderColor: `${colors.primary.dark}66` }}
        >
          <Scoreboard
            myName={myName}
            theirName={theirName}
            myScore={myScore}
            theirScore={theirScore}
            livesRemaining={duel.livesRemaining}
          />
          {duel.status !== "completed" && (
            <button
              onClick={handleExit}
              className="font-bold py-2 px-5 rounded-lg text-base flex-shrink-0 transition hover:brightness-110"
              style={{
                backgroundColor: `${colors.status.danger.DEFAULT}1A`,
                color: colors.status.danger.light,
              }}
              data-testid="sentence-exit"
            >
              Exit Duel
            </button>
          )}
        </header>

        <SentenceRoundBoard
          key={duel.currentWordIndex}
          duel={duel}
          question={question}
          sessionItem={sessionItem}
          viewerRole={viewerRole}
        />
      </div>
    </main>
  );
}

interface SentenceRoundBoardProps {
  duel: Doc<"duels">;
  sessionItem: ViewerSafeSentenceSessionItem;
  question: SentenceRoundViewProps["question"];
  viewerRole: "challenger" | "opponent";
}

/**
 * Inner per-round board. Re-mounted via `key={duel.currentWordIndex}` whenever
 * the duel advances. Server-authoritative: every tap is a `tapSentenceTile`
 * mutation; the UI mirrors `duel.sentenceProgress` for this player/position.
 */
function SentenceRoundBoard({ duel, sessionItem, question, viewerRole }: SentenceRoundBoardProps) {
  const colors = useAppearanceColors();
  const submit = useMutation(api.gameplay.answerSentenceRound);
  const tap = useMutation(api.gameplay.tapSentenceTile);

  const submittedRef = useRef(false);

  // Server-tracked progress (placed indices, mistakes, completed) for this
  // (questionIndex, viewerRole). Undefined until the player has tapped once.
  const progress = useMemo(() => {
    return (duel.sentenceProgress ?? []).find(
      (entry) =>
        entry.questionIndex === duel.currentWordIndex && entry.role === viewerRole
    );
  }, [duel.sentenceProgress, duel.currentWordIndex, viewerRole]);

  // `placedTileIndices` is derived from a fresh array literal on every render
  // when `progress` is undefined, which would invalidate `useCallback` deps
  // (handleTap) every render. Stabilize via useMemo.
  const placedTileIndices = useMemo(
    () => progress?.placedTileIndices ?? [],
    [progress]
  );
  const mistakes = progress?.mistakes ?? 0;
  const completed = progress?.completed ?? false;

  const timerSeconds = pickTimerSeconds(duel);
  // Both players must see the same countdown — subtract from the server-set
  // `duel.questionStartTime` anchor (mirrors `useDuelQuestionTimer`).
  const questionStartTime = duel.questionStartTime;
  const [secondsLeft, setSecondsLeft] = useState(() => {
    if (!questionStartTime) return timerSeconds;
    const elapsed = Math.floor((Date.now() - questionStartTime) / 1000);
    return Math.max(0, timerSeconds - elapsed);
  });
  useEffect(() => {
    // No anchor yet → the useState initializer already returned the full
    // `timerSeconds`, so there is nothing to do until the server sends one.
    if (!questionStartTime) return;
    const tick = () => {
      const elapsed = Math.floor((Date.now() - questionStartTime) / 1000);
      setSecondsLeft(Math.max(0, timerSeconds - elapsed));
    };
    tick();
    const interval = setInterval(tick, 250);
    return () => clearInterval(interval);
  }, [timerSeconds, questionStartTime]);

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

  // Auto-submit when the sentence completes (server confirmed via subscription).
  useEffect(() => {
    if (completed && !submittedRef.current) {
      void handleSubmitFinal(false);
    }
  }, [completed, handleSubmitFinal]);

  // Auto-submit on timeout.
  useEffect(() => {
    if (secondsLeft === 0 && !completed && !submittedRef.current) {
      void handleSubmitFinal(true);
    }
  }, [handleSubmitFinal, secondsLeft, completed]);

  const handleTap = useCallback(
    (tileIndex: number) => {
      if (completed) return;
      if (secondsLeft === 0) return;
      if (placedTileIndices.includes(tileIndex)) return;
      void tap({
        duelId: duel._id,
        questionIndex: duel.currentWordIndex,
        tileIndex,
      }).catch((error) => toast.error(getErrorMessage(error, "Could not place tile")));
    },
    [completed, duel._id, duel.currentWordIndex, placedTileIndices, secondsLeft, tap]
  );

  const assembled = placedTileIndices
    .map((index) => question.tilePool[index])
    .filter((tile): tile is string => tile !== undefined)
    .map(formatSentenceTileForDisplay)
    .join(" ");
  const placedSet = new Set(placedTileIndices);

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-4 py-4 overflow-y-auto">
      <div className="text-center text-xs uppercase tracking-widest" style={{ color: colors.text.muted }}>
        Round {duel.currentWordIndex + 1} of {duel.sessionWords.length}
      </div>
      <div
        className="text-[11px] uppercase tracking-widest mt-1"
        style={{ color: colors.text.muted }}
      >
        {sessionItem.themeName}
      </div>

      <h1
        className="mt-3 text-center text-2xl sm:text-3xl font-bold leading-tight"
        style={{ color: colors.text.DEFAULT }}
        data-testid="sentence-prompt"
      >
        {question.englishPrompt}
      </h1>

      <div
        className="mt-3 text-center text-3xl font-bold tabular-nums"
        style={{ color: secondsLeft <= 5 ? colors.status.danger.light : colors.text.DEFAULT }}
        data-testid="sentence-timer"
      >
        {secondsLeft}
        <span className="text-xs ml-1" style={{ color: colors.text.muted }}>
          sec
        </span>
      </div>

      <div
        className="mt-5 w-full min-h-[3rem] rounded-xl border-2 border-dashed p-3 text-center text-base sm:text-lg"
        style={{
          borderColor: colors.primary.dark,
          backgroundColor: `${colors.primary.DEFAULT}10`,
          color: assembled ? colors.text.DEFAULT : colors.text.muted,
        }}
        data-testid="sentence-assembled"
      >
        {assembled || "Tap the words in order…"}
      </div>

      <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3 w-full">
        {question.tilePool.map((tile, index) => {
          const isPlaced = placedSet.has(index);
          return (
            <button
              key={`${tile}-${index}`}
              onClick={() => handleTap(index)}
              disabled={isPlaced || completed || secondsLeft === 0}
              className="p-4 rounded-lg border-2 text-lg font-medium transition-all hover:brightness-110 active:scale-95 disabled:opacity-30"
              style={{
                backgroundColor: colors.background.elevated,
                borderColor: colors.primary.dark,
                color: colors.text.DEFAULT,
              }}
              data-testid={`sentence-tile-${index}`}
            >
              {formatSentenceTileForDisplay(tile)}
            </button>
          );
        })}
      </div>

      {question.answerRevealedToViewer === true && question.spanishSentence && (
        <div
          className="mt-5 w-full rounded-xl border-2 p-3 text-center text-sm"
          style={{
            borderColor: colors.status.success.dark,
            backgroundColor: `${colors.status.success.DEFAULT}1A`,
            color: colors.status.success.light,
          }}
          data-testid="sentence-feedback"
        >
          Correct: {question.spanishSentence}
        </div>
      )}

      {completed && (
        <div
          className="mt-3 text-sm font-semibold"
          style={{ color: colors.status.success.light }}
          data-testid="sentence-completed"
        >
          Sentence built — waiting for the round to advance.
        </div>
      )}

      {mistakes > 0 && (
        <div
          className="mt-2 text-xs"
          style={{ color: colors.text.muted }}
          data-testid="sentence-mistakes"
        >
          Wrong taps so far: {mistakes}
        </div>
      )}
    </div>
  );
}

