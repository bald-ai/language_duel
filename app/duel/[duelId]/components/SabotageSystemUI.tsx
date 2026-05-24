"use client";

import { memo } from "react";
import { MAX_SABOTAGES, SABOTAGE_OPTIONS, type SabotageEffect } from "@/app/game/sabotage";
import { useAppearanceColors } from "@/app/components/AppearanceProvider";

interface SabotageSystemUIProps {
  status: string;
  phase: string;
  isRoundOver: boolean;
  sabotagesRemaining: number;
  isLocked: boolean;
  hasAnswered: boolean;
  isOutgoingSabotageActive: boolean;
  opponentHasAnswered: boolean;
  onSendSabotage: (effect: SabotageEffect) => void;
  dataTestIdBase?: string;
}

/**
 * The sabotage controls shown in the duel footer (PvP only): one button per
 * sabotage effect, with a remaining-uses counter. Renders nothing once the
 * round is over or the duel is no longer in the answering phase.
 */
export const SabotageSystemUI = memo(function SabotageSystemUI({
  status,
  phase,
  isRoundOver,
  sabotagesRemaining,
  isLocked,
  hasAnswered,
  isOutgoingSabotageActive,
  opponentHasAnswered,
  onSendSabotage,
  dataTestIdBase,
}: SabotageSystemUIProps) {
  const colors = useAppearanceColors();
  if (status !== "active" || phase !== "answering" || isRoundOver) {
    return null;
  }

  // Loop-invariant: the same gate applies to every sabotage button, so compute
  // it once. (Sabotage can't be sent once the opponent has answered.)
  const disabled =
    sabotagesRemaining <= 0 ||
    (!hasAnswered && isLocked) ||
    isOutgoingSabotageActive ||
    opponentHasAnswered;

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
        {SABOTAGE_OPTIONS.map((option) => (
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
        ))}
      </div>
    </div>
  );
});
