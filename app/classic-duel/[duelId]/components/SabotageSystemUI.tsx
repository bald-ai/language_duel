"use client";

import { memo } from "react";
import { MAX_SABOTAGES, SABOTAGE_OPTIONS, type SabotageEffect } from "@/app/game/sabotage";

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
}: SabotageSystemUIProps) {
  if (status !== "accepted" || phase !== "answering" || word === "done") {
    return null;
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="text-sm font-medium text-gray-200 uppercase tracking-wider opacity-80">
        Sabotage{" "}
        <span className="text-gray-300 tabular-nums">
          {sabotagesRemaining}/{MAX_SABOTAGES}
        </span>
      </div>

      <div className="flex items-center justify-center gap-2 px-3 py-2 rounded-2xl border border-gray-700 bg-gray-900/80 backdrop-blur-md shadow-xl">
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
                  ? "border-gray-700 bg-gray-800 text-gray-500 cursor-not-allowed opacity-60"
                  : "border-gray-600 bg-gray-800 hover:bg-gray-700 hover:border-gray-500 active:scale-95"
              }`}
              title={option.label}
            >
              {option.emoji}
            </button>
          );
        })}
      </div>
    </div>
  );
});
