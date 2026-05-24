"use client";

import type { CSSProperties } from "react";
import { stripIrr } from "@/lib/stringUtils";
import type { SabotageEffect } from "@/lib/sabotage/types";
import {
  BUTTON_WIDTH,
  BUTTON_HEIGHT,
  TRAMPOLINE_BUTTON_WIDTH,
  TRAMPOLINE_BUTTON_HEIGHT,
  TRAMPOLINE_FLY_SCALE,
  BOUNCE_FLY_SCALE,
} from "@/lib/sabotage/constants";
import { useReverseAnswers } from "@/app/game/sabotage/hooks/useReverseAnswers";
import { useBounceOptions } from "@/app/game/sabotage/hooks/useBounceOptions";
import { useTrampolineOptions } from "@/app/game/sabotage/hooks/useTrampolineOptions";
import { reverseText } from "@/app/game/sabotage/utils/textTransforms";
import { AnswerOptionButton, computeOptionState, type OptionContext } from "./AnswerOptionButton";

interface DuelAnswerGridProps {
  answers: string[];
  /** Base option context; the per-option `answer` is filled in per button. */
  optionContext: OptionContext;
  activeSabotage: SabotageEffect | null;
  onOptionClick: (answer: string, canEliminateThis: boolean, isEliminated: boolean) => void;
  showTypeReveal: boolean;
  typedText: string;
  revealComplete: boolean;
  hasNoneOption: boolean;
  isShowingFeedback: boolean;
}

/**
 * The answer options: the normal 2-col grid plus the bounce and trampoline
 * fly-out overlays. All three share a single `renderOption` so the option body
 * (state + reveal + handlers + test ids) is declared once.
 */
export function DuelAnswerGrid({
  answers,
  optionContext,
  activeSabotage,
  onOptionClick,
  showTypeReveal,
  typedText,
  revealComplete,
  hasNoneOption,
  isShowingFeedback,
}: DuelAnswerGridProps) {
  const { reverseAnimatedAnswers } = useReverseAnswers({ activeSabotage, answers });
  const { bouncingOptions } = useBounceOptions({ activeSabotage, optionCount: answers.length });
  const { trampolineOptions } = useTrampolineOptions({ activeSabotage, optionCount: answers.length });

  const renderOption = (ans: string, i: number, flyStyle?: CSSProperties) => {
    const state = computeOptionState(ans, { ...optionContext, answer: ans });
    const cleanAns = stripIrr(ans);
    const displayText =
      !flyStyle && activeSabotage === "reverse"
        ? reverseAnimatedAnswers?.[i] ?? reverseText(cleanAns)
        : cleanAns;

    return (
      <AnswerOptionButton
        key={i}
        answer={ans}
        displayText={displayText}
        state={state}
        onClick={() => onOptionClick(ans, state.canEliminateThis, state.isEliminated)}
        showTypeReveal={flyStyle ? false : showTypeReveal}
        typedText={typedText}
        revealComplete={revealComplete}
        hasNoneOption={hasNoneOption}
        isShowingFeedback={isShowingFeedback}
        isFlying={Boolean(flyStyle)}
        style={flyStyle}
        dataTestId={flyStyle ? `duel-answer-${i}-fly` : `duel-answer-${i}`}
      />
    );
  };

  return (
    <>
      {/* Normal grid - use visibility instead of unmounting to prevent layout shift */}
      <div
        className={`grid grid-cols-2 gap-2 sm:gap-3 w-full max-w-md ${
          activeSabotage === "bounce" || activeSabotage === "trampoline" ? "invisible" : ""
        }`}
      >
        {answers.map((ans, i) => renderOption(ans, i))}
      </div>

      {/* Bouncing options when bounce sabotage is active */}
      {activeSabotage === "bounce" && bouncingOptions.length > 0 && (
        <div className="fixed inset-0 z-50 pointer-events-none">
          {answers.map((ans, i) => {
            const bouncePos = bouncingOptions[i];
            if (!bouncePos) return null;
            return renderOption(ans, i, {
              position: "absolute",
              left: bouncePos.x,
              top: bouncePos.y,
              width: BUTTON_WIDTH,
              height: BUTTON_HEIGHT,
              pointerEvents: "auto",
              transform: `scale(${BOUNCE_FLY_SCALE})`,
              transformOrigin: "top left",
            });
          })}
        </div>
      )}

      {/* Trampoline options when trampoline sabotage is active */}
      {activeSabotage === "trampoline" && trampolineOptions.length > 0 && (
        <div className="fixed inset-0 z-50 pointer-events-none">
          {answers.map((ans, i) => {
            const trampPos = trampolineOptions[i];
            if (!trampPos) return null;
            return renderOption(ans, i, {
              position: "absolute",
              left: trampPos.x + trampPos.shakeOffset.x,
              top: trampPos.y + trampPos.shakeOffset.y,
              width: TRAMPOLINE_BUTTON_WIDTH,
              height: TRAMPOLINE_BUTTON_HEIGHT,
              pointerEvents: "auto",
              transform: trampPos.phase === "flying" ? `scale(${TRAMPOLINE_FLY_SCALE})` : "scale(1)",
              transformOrigin: "top left",
            });
          })}
        </div>
      )}
    </>
  );
}
