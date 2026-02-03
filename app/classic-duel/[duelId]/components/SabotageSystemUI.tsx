"use client";

import { memo } from "react";
import { MAX_SABOTAGES, SABOTAGE_OPTIONS, type SabotageEffect } from "@/app/game/sabotage";
import { colors } from "@/lib/theme";

interface SabotageSystemUIProps {
  status: string;
  phase: string;
  word: string;
  sabotagesRemaining: number;
  isLocked: boolean;
  hasAnswered: boolean;
  isOutgoingSabotageActive: boolean;
  opponentHasAnswered: boolean;
  onSendSabotage: (effect: SabotageEffect) => void;
  dataTestIdBase?: string;
}

/**
 * SabotageSystemUI component displays the sabotage controls.
 * It is extracted from the main ClassicDuelChallenge to adhere to the "Skinny Page" rule.
 * 
 * Principle: No magic numbers in component code. (Uses MAX_SABOTAGES from constants)
 * Principle: Co-locate feature-specific components.
 */
export const SabotageSystemUI = memo(function SabotageSystemUI({
  status,
  phase,
  word,
  sabotagesRemaining,
  isLocked,
  hasAnswered,
  isOutgoingSabotageActive,
  opponentHasAnswered,
  onSendSabotage,
  dataTestIdBase,
}: SabotageSystemUIProps) {
  if (status !== "accepted" || phase !== "answering" || word === "done") {
    return null;
  }

  const containerStyle = {
    borderColor: colors.primary.dark,
    backgroundColor: `${colors.background.DEFAULT}CC`,
  };
  const disabledButtonStyle = {
    borderColor: colors.neutral.dark,
    backgroundColor: colors.background.DEFAULT,
    color: colors.text.muted,
  };
  const enabledButtonStyle = {
    borderColor: colors.primary.dark,
    backgroundColor: colors.background.elevated,
    color: colors.text.DEFAULT,
  };

  return (
    <div className="flex flex-col items-center gap-2">
      <div
        className="text-sm font-medium uppercase tracking-wider opacity-80"
        style={{ color: colors.text.DEFAULT }}
      >
        Sabotage{" "}
        <span className="tabular-nums" style={{ color: colors.text.DEFAULT }}>
          {sabotagesRemaining}/{MAX_SABOTAGES}
        </span>
      </div>

      <div
        className="flex items-center justify-center gap-2 px-3 py-2 rounded-2xl border backdrop-blur-md shadow-xl"
        style={containerStyle}
      >
        {SABOTAGE_OPTIONS.map((option) => {
          // Rule: Sabotage can't be sent if the opponent has already answered
          const disabled =
            sabotagesRemaining <= 0 ||
            phase !== "answering" ||
            (!hasAnswered && isLocked) ||
            isOutgoingSabotageActive ||
            opponentHasAnswered;

          return (
            <button
              key={option.effect}
              onClick={() => onSendSabotage(option.effect)}
              disabled={disabled}
              className={`h-11 w-11 rounded-xl border-2 flex items-center justify-center text-xl transition-all ${
                disabled
                  ? "cursor-not-allowed opacity-60"
                  : "hover:brightness-110 active:scale-95"
              }`}
              style={disabled ? disabledButtonStyle : enabledButtonStyle}
              title={option.label}
              data-testid={dataTestIdBase ? `${dataTestIdBase}-${option.effect}` : undefined}
            >
              {option.emoji}
            </button>
          );
        })}
      </div>
    </div>
  );
});
