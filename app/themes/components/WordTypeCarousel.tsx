"use client";

import type { WordType } from "@/lib/themes/api";
import { WORD_TYPE_OPTIONS } from "../constants";
import { useAppearanceColors } from "@/app/components/AppearanceProvider";

interface WordTypeCarouselProps {
  value: WordType;
  onChange: (wordType: WordType) => void;
  disabled?: boolean;
}

export function WordTypeCarousel({ value, onChange, disabled = false }: WordTypeCarouselProps) {
  const colors = useAppearanceColors();
  const selectedIndex = WORD_TYPE_OPTIONS.findIndex((option) => option.value === value);
  const currentWordType = WORD_TYPE_OPTIONS[selectedIndex] || WORD_TYPE_OPTIONS[0];

  const cycleWordType = (direction: -1 | 1) => {
    const nextIndex =
      (selectedIndex + direction + WORD_TYPE_OPTIONS.length) % WORD_TYPE_OPTIONS.length;
    onChange(WORD_TYPE_OPTIONS[nextIndex].value);
  };

  return (
    <div className="mb-6" data-testid="theme-generate-type-carousel">
      <div className="grid grid-cols-[3.5rem_1fr_3.5rem] items-center gap-5">
        <button
          type="button"
          onClick={() => cycleWordType(-1)}
          disabled={disabled}
          className="flex h-11 w-11 items-center justify-center justify-self-center rounded-xl border-2 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
          style={{
            backgroundColor: colors.background.elevated,
            borderColor: colors.primary.dark,
            color: colors.text.DEFAULT,
          }}
          aria-label="Previous word type"
          data-testid="theme-generate-type-previous"
        >
          <ChevronLeftIcon />
        </button>

        <div
          className="min-w-0 rounded-xl border-2 px-6 py-3 text-center text-sm font-bold uppercase tracking-widest shadow-lg"
          style={{
            backgroundImage: `linear-gradient(to bottom, ${colors.primary.light}, ${colors.primary.DEFAULT})`,
            borderColor: colors.primary.dark,
            color: colors.text.inverse,
            boxShadow: `0 10px 24px ${colors.primary.glow}`,
            opacity: disabled ? 0.5 : 1,
          }}
          aria-live="polite"
          data-testid="theme-generate-type-selected"
        >
          {currentWordType.label}
        </div>

        <button
          type="button"
          onClick={() => cycleWordType(1)}
          disabled={disabled}
          className="flex h-11 w-11 items-center justify-center justify-self-center rounded-xl border-2 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
          style={{
            backgroundColor: colors.background.elevated,
            borderColor: colors.primary.dark,
            color: colors.text.DEFAULT,
          }}
          aria-label="Next word type"
          data-testid="theme-generate-type-next"
        >
          <ChevronRightIcon />
        </button>
      </div>

      <div className="mt-5 flex justify-center gap-3" aria-label="Word type options">
        {WORD_TYPE_OPTIONS.map((option) => {
          const selected = option.value === value;
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onChange(option.value)}
              disabled={disabled}
              className="h-2.5 rounded-full transition-all disabled:cursor-not-allowed disabled:opacity-50"
              style={{
                width: selected ? "1.5rem" : "0.625rem",
                backgroundColor: selected ? colors.primary.dark : colors.neutral.light,
              }}
              aria-label={`Select ${option.label}`}
              aria-pressed={selected}
              data-testid={`theme-generate-type-${option.value}`}
            />
          );
        })}
      </div>
    </div>
  );
}

function ChevronLeftIcon() {
  return (
    <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 5l-7 7 7 7" />
    </svg>
  );
}

function ChevronRightIcon() {
  return (
    <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
    </svg>
  );
}
