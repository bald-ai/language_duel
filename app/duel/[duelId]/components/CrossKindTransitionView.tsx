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

          {/* Prompt and answer share one typographic scale and stack directly
              on top of each other so the learner can line the languages up
              word-for-word. Colour is the only differentiator: default for the
              prompt, success-green for the revealed answer. */}
          <div className="mt-6 w-full flex flex-col items-center gap-3 text-center">
            <h1
              className="text-2xl sm:text-3xl font-bold leading-snug"
              style={{ color: colors.text.DEFAULT }}
              data-testid="cross-kind-transition-prompt"
            >
              {prompt}
            </h1>
            <div
              className="h-px w-16"
              style={{ backgroundColor: `${colors.text.muted}55` }}
              aria-hidden
            />
            <p
              className="text-2xl sm:text-3xl font-bold leading-snug"
              style={{ color: colors.status.success.light }}
              data-testid="cross-kind-transition-answer"
            >
              {correctAnswer ?? ""}
            </p>
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
