"use client";

import { useEffect, useState } from "react";
import type { Doc } from "@/convex/_generated/dataModel";
import { useAppearanceColors } from "@/app/components/AppearanceProvider";
import { Scoreboard } from "@/app/game/components/duel/Scoreboard";
import { formatVisibleUser } from "@/lib/userDisplay";
import { TRANSITION_COUNTDOWN_SECONDS } from "@/lib/duelConstants";
import type { DuelPlayerSummary } from "../hooks/useDuelSessionViewModel";
import type { CrossKindTransition } from "../hooks/useCrossKindRoundTransition";

interface CrossKindTransitionViewProps {
  duel: Doc<"duels">;
  challenger: DuelPlayerSummary | null;
  opponent: DuelPlayerSummary | null;
  viewerRole: "challenger" | "opponent";
  transition: CrossKindTransition;
}

/**
 * Static reveal of the prior round, shown when `DuelSession` is about to
 * cross between word and sentence views (or finish on a sentence-last
 * round). Reads the prior round from the viewer-safe duel: past questions
 * always carry `answerRevealedToViewer: true` and the unmasked answer key,
 * so we can render the correct Spanish answer without any extra mutation.
 */
export function CrossKindTransitionView({
  duel,
  challenger,
  opponent,
  viewerRole,
  transition,
}: CrossKindTransitionViewProps) {
  const colors = useAppearanceColors();

  const isChallenger = viewerRole === "challenger";
  const myScore = isChallenger ? duel.challengerScore : duel.opponentScore;
  const theirScore = isChallenger ? duel.opponentScore : duel.challengerScore;
  const myName = formatVisibleUser(isChallenger ? challenger : opponent, "You");
  const theirName = formatVisibleUser(isChallenger ? opponent : challenger, "Opponent");

  const priorQuestion = duel.duelQuestions?.[transition.prevIndex];
  const priorItem = duel.sessionWords[duel.wordOrder[transition.prevIndex]];

  const prompt =
    priorQuestion?.kind === "word"
      ? priorItem?.kind === "word"
        ? priorItem.word
        : ""
      : priorQuestion?.kind === "sentence"
      ? priorQuestion.englishPrompt
      : "";
  const correctAnswer =
    priorQuestion?.kind === "word"
      ? priorQuestion.correctOption ?? null
      : priorQuestion?.kind === "sentence"
      ? priorQuestion.spanishSentence ?? null
      : null;

  const [secondsLeft, setSecondsLeft] = useState(TRANSITION_COUNTDOWN_SECONDS);
  useEffect(() => {
    if (secondsLeft <= 0) return;
    const id = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(id);
  }, [secondsLeft]);

  return (
    <main
      className="min-h-dvh md:flex md:items-center md:justify-center md:p-6 lg:p-8"
      style={{ color: colors.text.DEFAULT }}
      data-testid="cross-kind-transition"
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
        </header>

        <div className="flex-1 flex flex-col items-center justify-center px-4 py-4 overflow-y-auto">
          <div
            className="text-center text-xs uppercase tracking-widest"
            style={{ color: colors.text.muted }}
            data-testid="cross-kind-transition-round"
          >
            Round {transition.prevIndex + 1} of {duel.sessionWords.length}
          </div>

          <h1
            className="mt-3 text-center text-2xl sm:text-3xl font-bold leading-tight"
            style={{ color: colors.text.DEFAULT }}
            data-testid="cross-kind-transition-prompt"
          >
            {prompt}
          </h1>

          <div
            className="mt-5 w-full rounded-xl border-2 p-3 text-center text-lg sm:text-xl font-bold"
            style={{
              borderColor: colors.status.success.dark,
              backgroundColor: `${colors.status.success.DEFAULT}1A`,
              color: colors.status.success.light,
            }}
            data-testid="cross-kind-transition-answer"
          >
            {correctAnswer ?? ""}
          </div>

          {duel.status !== "completed" && (
            <div
              className="mt-6 text-sm font-semibold"
              style={{ color: colors.text.muted }}
              data-testid="cross-kind-transition-countdown"
            >
              Next round in {secondsLeft}…
            </div>
          )}
          {duel.status === "completed" && (
            <div
              className="mt-6 text-sm font-semibold"
              style={{ color: colors.text.muted }}
              data-testid="cross-kind-transition-final"
            >
              Wrapping up…
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
