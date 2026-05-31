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
import {
  formatSentenceTileForDisplay,
  getSentenceTilePoolFontSizeClass,
} from "@/lib/sentenceGameplay/displayTile";
import { isBuildConfirmSentenceMode } from "@/lib/sentenceGameplay/mode";
import {
  TIMER_DANGER_THRESHOLD,
  TIMER_WARNING_THRESHOLD,
} from "@/lib/duelConstants";
import { clampTimerSeconds, getEffectiveQuestionStartTime } from "@/lib/duelTiming";
import { buildDuelViewStyles } from "./duelViewStyles";
import { SentencePvpBoard } from "./SentencePvpBoard";
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
  const styles = buildDuelViewStyles(colors);
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
        className="w-full md:max-w-md lg:max-w-lg md:rounded-2xl md:border md:shadow-2xl flex flex-col min-h-dvh md:min-h-0 md:h-[85vh] md:max-h-[800px] backdrop-blur-xl"
        style={styles.gameContainer}
      >
        <header
          className="flex-shrink-0 flex items-center justify-between p-3 md:p-4 pt-[max(0.75rem,var(--sat))] md:pt-4 border-b"
          style={styles.subtleBorder}
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
              style={styles.exitButton}
              data-testid="sentence-exit"
            >
              Exit Duel
            </button>
          )}
        </header>

        {isBuildConfirmSentenceMode(duel) ? (
          <SentencePvpBoard
            key={duel.currentWordIndex}
            duel={duel}
            question={question}
            sessionItem={sessionItem}
            viewerRole={viewerRole}
          />
        ) : (
          <SentenceRoundBoard
            key={duel.currentWordIndex}
            duel={duel}
            question={question}
            sessionItem={sessionItem}
            viewerRole={viewerRole}
          />
        )}
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
  const styles = buildDuelViewStyles(colors);
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
  // `duel.questionStartTime` anchor plus the shared transition offset.
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
    // No anchor yet → the useState initializer already returned the full
    // `timerSeconds`, so there is nothing to do until the server sends one.
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
  const tileFontSizeClass = getSentenceTilePoolFontSizeClass(question.tilePool);

  const timerIsDanger = secondsLeft <= TIMER_DANGER_THRESHOLD;
  const timerIsWarning = secondsLeft <= TIMER_WARNING_THRESHOLD;
  const timerColor = timerIsDanger
    ? colors.status.danger.light
    : timerIsWarning
      ? colors.status.warning.light
      : colors.text.DEFAULT;

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-4 py-4 overflow-y-auto">
      {/* Round progress + theme + prompt — matches the word duel's header chrome */}
      <div className="text-center mb-3">
        <div className="text-sm mb-1" style={styles.mutedText}>
          Round {duel.currentWordIndex + 1} of {duel.sessionWords.length}
        </div>
      </div>

      <div className="text-center mb-4">
        <div
          className="text-xs uppercase tracking-[0.25em] mb-2"
          style={styles.mutedText}
        >
          {sessionItem.themeName}
        </div>
        <h1
          className="text-2xl md:text-3xl font-bold leading-tight"
          style={{ color: colors.text.DEFAULT }}
          data-testid="sentence-prompt"
        >
          {question.englishPrompt}
        </h1>
      </div>

      <div className="mb-4 text-center">
        <div className="flex items-center justify-center gap-2">
          <span
            className={`text-4xl font-bold tabular-nums ${timerIsDanger ? "animate-pulse" : ""}`}
            style={{ color: timerColor }}
            data-testid="sentence-timer"
          >
            {secondsLeft}
          </span>
          <span className="text-xs" style={styles.mutedText}>
            sec
          </span>
        </div>
      </div>

      <div
        className="mt-5 w-full max-w-md min-h-[3rem] rounded-xl border-2 border-dashed p-3 text-center text-base sm:text-lg"
        style={{
          borderColor: colors.primary.dark,
          backgroundColor: `${colors.primary.DEFAULT}10`,
          color: assembled ? colors.text.DEFAULT : colors.text.muted,
        }}
        data-testid="sentence-assembled"
      >
        {assembled || "Tap the words in order…"}
      </div>

      {/* Tile pool — same 2-col grid and button chrome as the word duel's answer grid */}
      <div className="mt-4 grid grid-cols-2 gap-2 sm:gap-3 w-full max-w-md">
        {question.tilePool.map((tile, index) => {
          const isPlaced = placedSet.has(index);
          const isDisabled = isPlaced || completed || secondsLeft === 0;
          return (
            <button
              key={`${tile}-${index}`}
              onClick={() => handleTap(index)}
              disabled={isDisabled}
              className={`p-4 rounded-lg border-2 ${tileFontSizeClass} font-medium transition-all relative active:scale-95 ${
                isPlaced ? "opacity-50" : "hover:brightness-110"
              }`}
              style={
                isPlaced
                  ? {
                      borderColor: colors.neutral.dark,
                      backgroundColor: colors.background.DEFAULT,
                      color: colors.text.muted,
                    }
                  : {
                      borderColor: colors.primary.dark,
                      backgroundColor: colors.background.elevated,
                      color: colors.text.DEFAULT,
                    }
              }
              data-testid={`sentence-tile-${index}`}
            >
              {formatSentenceTileForDisplay(tile)}
            </button>
          );
        })}
      </div>

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
