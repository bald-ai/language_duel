"use client";

import { useEffect, useRef } from "react";
import type { Level0Props } from "./types";
import { stripIrr } from "@/lib/stringUtils";
import { buttonStyles, colors } from "@/lib/theme";
import { useTwoOptionKeyboard } from "./hooks/useTwoOptionKeyboard";

const actionButtonClassName =
  "flex-1 bg-gradient-to-b border-t-2 border-b-4 border-x-2 rounded-xl py-3 px-4 text-sm sm:text-base font-bold uppercase tracking-widest hover:translate-y-0.5 hover:brightness-110 active:translate-y-1 transition-all duration-200 shadow-lg focus:outline-none focus:ring-2 focus:ring-amber-200 focus:ring-offset-2 focus:ring-offset-slate-700/70";
const defaultKeyboardActionClassName = "ring-2 ring-amber-200 ring-offset-2 ring-offset-slate-700/70";

const primaryActionStyle = {
  backgroundImage: `linear-gradient(to bottom, ${buttonStyles.primary.gradient.from}, ${buttonStyles.primary.gradient.to})`,
  borderTopColor: buttonStyles.primary.border.top,
  borderBottomColor: buttonStyles.primary.border.bottom,
  borderLeftColor: buttonStyles.primary.border.sides,
  borderRightColor: buttonStyles.primary.border.sides,
  color: colors.text.DEFAULT,
  textShadow: "0 2px 4px rgba(0,0,0,0.4)",
};

const secondaryActionStyle = {
  backgroundColor: colors.background.elevated,
  borderColor: colors.primary.dark,
  color: colors.text.DEFAULT,
  textShadow: "0 2px 4px rgba(0,0,0,0.4)",
};

/**
 * Level 0 - Introduction/Reveal mode
 * Shows the word and answer, user indicates if they know it or not
 * Used only in solo study mode
 */
export function Level0Input({ word, answer, onGotIt, onNotYet, dataTestIdBase }: Level0Props) {
  const gotItButtonRef = useRef<HTMLButtonElement>(null);
  const notYetButtonRef = useRef<HTMLButtonElement>(null);

  const { selectedOption, setSelectedOption } = useTwoOptionKeyboard({
    enabled: true,
    primaryOption: "got_it",
    secondaryOption: "not_yet",
    defaultOption: "got_it",
    onConfirm: (option) => {
      if (option === "got_it") {
        onGotIt();
      } else {
        onNotYet();
      }
    },
  });

  useEffect(() => {
    if (selectedOption === "got_it") {
      gotItButtonRef.current?.focus();
    } else {
      notYetButtonRef.current?.focus();
    }
  }, [selectedOption]);

  return (
    <div className="flex flex-col items-center gap-6">
      <div className="text-center">
        <div className="text-3xl font-bold mb-2" style={{ color: colors.text.DEFAULT }}>
          {word}
        </div>
        <div className="text-xs uppercase tracking-widest mb-3" style={{ color: colors.text.muted }}>
          Answer
        </div>
        <div className="text-2xl font-bold" style={{ color: colors.secondary.light }}>
          {stripIrr(answer)}
        </div>
      </div>

      <div className="flex gap-3 w-full">
        <button
          ref={gotItButtonRef}
          onClick={() => {
            setSelectedOption("got_it");
            onGotIt();
          }}
          className={`${actionButtonClassName} ${selectedOption === "got_it" ? defaultKeyboardActionClassName : ""}`}
          style={primaryActionStyle}
          autoFocus
          data-testid={dataTestIdBase ? `${dataTestIdBase}-got-it` : undefined}
        >
          Got it
        </button>
        <button
          ref={notYetButtonRef}
          onClick={() => {
            setSelectedOption("not_yet");
            onNotYet();
          }}
          className={`${actionButtonClassName} ${selectedOption === "not_yet" ? defaultKeyboardActionClassName : ""}`}
          style={secondaryActionStyle}
          data-testid={dataTestIdBase ? `${dataTestIdBase}-not-yet` : undefined}
        >
          Not yet
        </button>
      </div>
    </div>
  );
}
