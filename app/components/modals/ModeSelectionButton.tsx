"use client";

import { memo } from "react";
import { colors } from "@/lib/theme";

type ModeTone = "primary" | "secondary" | "cta";

interface ModeSelectionButtonProps {
  selected: boolean;
  onClick: () => void;
  title: string;
  description: string;
  selectedTone?: ModeTone;
  dataTestId?: string;
}

const toneMap = {
  primary: colors.primary,
  secondary: colors.secondary,
  cta: colors.cta,
} as const;

export const ModeSelectionButton = memo(function ModeSelectionButton({
  selected,
  onClick,
  title,
  description,
  selectedTone = "primary",
  dataTestId,
}: ModeSelectionButtonProps) {
  const tone = toneMap[selectedTone];
  const cardStyle = selected
    ? {
        backgroundColor: `${tone.DEFAULT}1A`,
        borderColor: `${tone.DEFAULT}66`,
      }
    : {
        backgroundColor: colors.background.DEFAULT,
        borderColor: colors.primary.dark,
      };

  const titleStyle = selected ? { color: tone.light } : { color: colors.text.DEFAULT };

  const checkStyle = selected
    ? {
        backgroundColor: tone.DEFAULT,
        borderColor: tone.DEFAULT,
      }
    : {
        backgroundColor: "transparent",
        borderColor: colors.neutral.dark,
      };

  return (
    <button
      type="button"
      onClick={onClick}
      data-testid={dataTestId}
      aria-pressed={selected}
      className="w-full text-left p-4 sm:p-5 rounded-2xl border-2 transition hover:brightness-110 flex items-center justify-between gap-4"
      style={cardStyle}
    >
      <div>
        <div className="font-bold text-lg sm:text-xl" style={titleStyle}>
          {title}
        </div>
        <div className="text-sm" style={{ color: colors.text.muted }}>
          {description}
        </div>
      </div>
      <div
        className="w-10 h-10 rounded-full border-2 flex items-center justify-center shrink-0"
        style={checkStyle}
      >
        {selected ? <CheckIcon /> : null}
      </div>
    </button>
  );
});

function CheckIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M16.5 5.5L8.25 13.75L3.5 9"
        stroke="white"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
