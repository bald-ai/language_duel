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
  buildAssembledSentence,
  createInitialSentenceRoundState,
  tapSentenceTile,
  type SentenceRoundState,
} from "@/lib/sentenceGameplay/engine";
import type { SentenceQuestionSnapshot } from "@/lib/sentenceGameplay/types";
import {
  SENTENCE_PVE_TIMER_SECONDS,
  SENTENCE_PVP_TIMER_SECONDS,
  SENTENCE_SELF_DUEL_TIMER_SECONDS,
} from "@/lib/themes/sentenceConstants";
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
   * pre-shuffled; `spanishSentence` is included even during active play (v1
   * loosening) so the client can validate taps locally.
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
        />
      </div>
    </main>
  );
}

interface SentenceRoundBoardProps {
  duel: Doc<"duels">;
  sessionItem: ViewerSafeSentenceSessionItem;
  question: SentenceRoundViewProps["question"];
}

/**
 * Inner per-round board. Re-mounted via `key={duel.currentWordIndex}` whenever
 * the duel advances so its local play state and timer reset cleanly without
 * imperative effects.
 */
function SentenceRoundBoard({ duel, sessionItem, question }: SentenceRoundBoardProps) {
  const colors = useAppearanceColors();
  const submit = useMutation(api.gameplay.answerSentenceRound);

  // Local play state — keep it on the client so taps are responsive. Server
  // only sees the final result. This matches the plan's v1 shortcut and skips
  // shared PvE tap state for now.
  const [state, setState] = useState<SentenceRoundState>(createInitialSentenceRoundState);
  const submittedRef = useRef(false);

  const localSnapshot: SentenceQuestionSnapshot = useMemo(
    () => ({
      kind: "sentence",
      englishPrompt: question.englishPrompt,
      spanishSentence: question.spanishSentence ?? "",
      tilePool: question.tilePool,
    }),
    [question.englishPrompt, question.spanishSentence, question.tilePool]
  );

  const timerSeconds = pickTimerSeconds(duel);
  // `Date.now` is impure — capture it inside the mount effect (which runs in
  // the commit phase) rather than during render so React's strict-mode double
  // renders can't shift the start.
  const startedAtRef = useRef<number>(0);
  const [secondsLeft, setSecondsLeft] = useState(timerSeconds);
  useEffect(() => {
    startedAtRef.current = Date.now();
    const tick = () => {
      const elapsed = Math.floor((Date.now() - startedAtRef.current) / 1000);
      setSecondsLeft(Math.max(0, timerSeconds - elapsed));
    };
    const interval = setInterval(tick, 250);
    return () => clearInterval(interval);
  }, [timerSeconds]);

  const handleSubmitFinal = useCallback(
    async (params: { completed: boolean; mistakes: number }) => {
      if (submittedRef.current) return;
      submittedRef.current = true;
      try {
        await submit({
          duelId: duel._id,
          questionIndex: duel.currentWordIndex,
          completed: params.completed,
          mistakes: params.mistakes,
        });
      } catch (error) {
        submittedRef.current = false;
        toast.error(getErrorMessage(error, "Could not submit sentence"));
      }
    },
    [submit, duel._id, duel.currentWordIndex]
  );

  // Auto-submit when the sentence completes locally.
  useEffect(() => {
    if (state.completed) {
      void handleSubmitFinal({ completed: true, mistakes: state.mistakes });
    }
  }, [state.completed, state.mistakes, handleSubmitFinal]);

  // Auto-submit on timeout.
  useEffect(() => {
    if (secondsLeft === 0 && !state.completed && !submittedRef.current) {
      void handleSubmitFinal({ completed: false, mistakes: state.mistakes });
    }
  }, [handleSubmitFinal, secondsLeft, state.completed, state.mistakes]);

  const handleTap = useCallback(
    (tileIndex: number) => {
      if (state.completed) return;
      if (secondsLeft === 0) return;
      const outcome = tapSentenceTile(state, localSnapshot, tileIndex);
      setState(outcome.state);
    },
    [localSnapshot, secondsLeft, state]
  );

  const assembled = buildAssembledSentence(localSnapshot, state.placedTileIndices);
  const placedSet = new Set(state.placedTileIndices);

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

      <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-2 w-full">
        {question.tilePool.map((tile, index) => {
          const isPlaced = placedSet.has(index);
          return (
            <button
              key={`${tile}-${index}`}
              onClick={() => handleTap(index)}
              disabled={isPlaced || state.completed || secondsLeft === 0}
              className="rounded-xl border-2 px-3 py-2 text-sm sm:text-base font-bold transition hover:brightness-110 disabled:opacity-30"
              style={{
                backgroundColor: colors.background.DEFAULT,
                borderColor: colors.primary.dark,
                color: colors.text.DEFAULT,
              }}
              data-testid={`sentence-tile-${index}`}
            >
              {tile}
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

      {state.completed && (
        <div
          className="mt-3 text-sm font-semibold"
          style={{ color: colors.status.success.light }}
          data-testid="sentence-completed"
        >
          Sentence built — waiting for the round to advance.
        </div>
      )}

      {state.mistakes > 0 && (
        <div
          className="mt-2 text-xs"
          style={{ color: colors.text.muted }}
          data-testid="sentence-mistakes"
        >
          Wrong taps so far: {state.mistakes}
        </div>
      )}
    </div>
  );
}
