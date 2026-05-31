"use client";

import type { ThemeColors } from "@/lib/appearance";
import type { DuelMode } from "@/lib/duelMode";
import { FinalResultsPanel } from "@/app/game/components/duel/FinalResultsPanel";
import { HintSystemUI } from "@/app/game/components/duel/HintSystemUI";
import { HintPoolUI } from "./HintPoolUI";
import { SabotageSystemUI } from "./SabotageSystemUI";
import { buildDuelViewStyles, getConfirmButtonStyle } from "./duelViewStyles";
import type { DuelViewProps } from "./DuelView";

interface DuelFooterProps {
  status: string;
  duelMode: DuelMode;
  phase: "idle" | "answering" | "transition";
  isRoundOver: boolean;
  answers: DuelViewProps["answers"];
  hints: DuelViewProps["hints"];
  sabotage: DuelViewProps["sabotage"];
  score: DuelViewProps["score"];
  actions: DuelViewProps["actions"];
  duelDuration: number;
  colors: ThemeColors;
}

/**
 * The persistent bottom action bar: Confirm, the hint pool (PvE) or sabotage /
 * cooperative-hint controls (PvP), the waiting indicator, and the final results.
 */
export function DuelFooter({
  status,
  duelMode,
  phase,
  isRoundOver,
  answers,
  hints,
  sabotage,
  score,
  actions,
  duelDuration,
  colors,
}: DuelFooterProps) {
  const styles = buildDuelViewStyles(colors);
  const isPve = duelMode === "pve";
  const isAnsweringRound = phase === "answering" && !isRoundOver;
  const confirmDisabled = !answers.selectedAnswer || answers.isLocked;

  return (
    <footer
      className="flex-shrink-0 flex flex-col items-center gap-2 w-full px-4 py-3 pb-[max(0.75rem,var(--sab))] md:pb-4 border-t"
      style={styles.subtleBorder}
    >
      {/* Confirm Button */}
      {!answers.hasAnswered && isAnsweringRound && (
        <button
          className="w-full rounded-xl px-6 sm:px-10 py-2.5 sm:py-3 font-bold text-base sm:text-lg shadow-2xl disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-95 border-b-4 hover:brightness-110"
          style={getConfirmButtonStyle(colors, confirmDisabled)}
          disabled={confirmDisabled}
          onClick={actions.onConfirmAnswer}
          data-testid="duel-confirm"
        >
          Confirm Answer
        </button>
      )}

      {/* Cooperative-hint request UI (PvP only) */}
      {!isPve && isAnsweringRound && (
        <HintSystemUI
          canRequestHint={hints.canRequestHint}
          iRequestedHint={hints.iRequestedHint}
          theyRequestedHint={hints.theyRequestedHint}
          hintAccepted={hints.hintAccepted}
          canAcceptHint={hints.canAcceptHint}
          isHintProvider={hints.isHintProvider}
          hasAnswered={answers.hasAnswered}
          eliminatedOptionsCount={hints.eliminatedOptionsCount}
          onRequestHint={actions.onRequestHint}
          onAcceptHint={actions.onAcceptHint}
          requestHintText="Begging for help!"
          acceptHintText="Bafoon is begging"
          dataTestIdBase="duel-hint"
        />
      )}

      {isPve ? (
        isAnsweringRound ? (
          <HintPoolUI
            usedHints={hints.pool.usedHints}
            usedCount={hints.pool.usedCount}
            totalCount={hints.pool.totalCount}
            currentQuestionHintFired={hints.pool.currentQuestionHintFired}
            onFireHint={actions.onFireHint}
          />
        ) : null
      ) : (
        <SabotageSystemUI
          status={status}
          phase={phase}
          isRoundOver={isRoundOver}
          sabotagesRemaining={sabotage.sabotagesRemaining}
          isLocked={answers.isLocked}
          hasAnswered={answers.hasAnswered}
          hasSentSabotageThisQuestion={sabotage.hasSentSabotageThisQuestion}
          opponentHasAnswered={answers.opponentHasAnswered}
          onSendSabotage={actions.onSendSabotage}
          dataTestIdBase="duel-sabotage"
        />
      )}

      {/* Waiting message */}
      {answers.hasAnswered && isAnsweringRound && !hints.theyRequestedHint && (
        <div
          className="font-medium animate-pulse px-3 sm:px-4 py-1 rounded-full backdrop-blur-sm border text-sm sm:text-base"
          style={styles.waitingMessage}
        >
          Waiting for opponent...
        </div>
      )}

      {/* Final Results - shown at end, no separate screen */}
      {status === "completed" && (
        <FinalResultsPanel
          myName={score.myName}
          theirName={score.theirName}
          myScore={score.myScore}
          theirScore={score.theirScore}
          onBackToHome={actions.onBackToHome}
          duelDuration={duelDuration}
          dataTestIdBack="duel-back-home"
          bossType={score.bossType}
          livesRemaining={score.livesRemaining}
          livesTotal={score.livesTotal}
        />
      )}
    </footer>
  );
}
