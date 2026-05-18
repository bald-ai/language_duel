"use client";

import type { CSSProperties } from "react";
import { useAppearanceColors } from "@/app/components/AppearanceProvider";
import { cssVarColors as colors } from "@/app/components/themeCssVars";
import {
  getThemeActionButtonStyle,
  themeActionButtonClassName,
  getThemeModalPanelStyle,
  themeOutlineButtonClassName,
  getThemeOutlineButtonStyle,
} from "./themeStyles";
import type { PickAndPruneWord } from "../hooks/usePickAndPrune";

interface PickAndPruneReviewProps {
  activeWords: PickAndPruneWord[];
  removedWords: PickAndPruneWord[];
  removedOpen: boolean;
  onRemovedOpenChange: (open: boolean) => void;
  onRemove: (id: string) => void;
  onRestore: (id: string) => void;
  onContinue: () => void;
  onCancel: () => void;
}

export function PickAndPruneReview({
  activeWords,
  removedWords,
  removedOpen,
  onRemovedOpenChange,
  onRemove,
  onRestore,
  onContinue,
  onCancel,
}: PickAndPruneReviewProps) {
  const colors = useAppearanceColors();
  const activeCount = activeWords.length;
  const removedCount = removedWords.length;

  return (
    <div className="w-full flex-1 min-h-0 flex flex-col" data-testid="theme-pick-prune-review">
      <div
        className="w-full max-w-md mx-auto flex-1 min-h-0 rounded-3xl border-2 p-4 flex flex-col gap-3"
        style={getThemeModalPanelStyle(colors)}
      >
        <header className="text-center shrink-0">
          <p
            className="text-[11px] font-bold uppercase tracking-[0.22em]"
            style={{ color: colors.cta.light }}
          >
            Experimental Review
          </p>
          <h1 className="title-font text-lg font-bold mt-0.5" style={{ color: colors.text.DEFAULT }}>
            Review Generated Words
          </h1>
          <div className="mt-1.5 flex justify-center gap-2 text-[11px]">
            <span
              className="rounded-full border px-2.5 py-0.5 font-semibold"
              style={countPillStyle}
              data-testid="theme-pick-prune-active-count"
            >
              Active: {activeCount}
            </span>
            <span
              className="rounded-full border px-2.5 py-0.5 font-semibold"
              style={removedPillStyle}
              data-testid="theme-pick-prune-removed-count"
            >
              Removed: {removedCount}
            </span>
          </div>
        </header>

        <section
          className="flex-1 min-h-0 rounded-2xl border-2 p-2.5 flex flex-col"
          style={activePanelStyle}
        >
          <h2
            className="text-[11px] font-bold uppercase tracking-[0.18em] px-1 pb-1.5 shrink-0"
            style={{ color: colors.primary.dark }}
          >
            Active ({activeCount})
          </h2>
          <div className="flex-1 min-h-0 space-y-1 overflow-y-auto pr-1">
            {activeWords.map((pickAndPruneWord, index) => (
              <WordRow
                key={pickAndPruneWord.id}
                dataTestId={`theme-pick-prune-active-row-${index}`}
                number={pickAndPruneWord.originalIndex + 1}
                word={pickAndPruneWord.word.word}
                answer={pickAndPruneWord.word.answer}
                variant="active"
                actionLabel="Remove"
                actionTestId={`theme-pick-prune-remove-${pickAndPruneWord.id}`}
                actionAriaLabel={`Remove ${pickAndPruneWord.word.word}`}
                onAction={() => onRemove(pickAndPruneWord.id)}
              />
            ))}
            {activeCount === 0 && (
              <p className="text-xs text-center py-3" style={{ color: colors.text.muted }}>
                No words selected. Restore at least one word to continue.
              </p>
            )}
          </div>
        </section>

        <section
          className="rounded-2xl border-2 shrink-0"
          style={removedPanelStyle}
        >
          <button
            type="button"
            className="w-full flex items-center justify-between text-left text-[11px] font-bold uppercase tracking-[0.18em] px-3 py-2"
            style={{ color: colors.status.danger.light }}
            onClick={() => onRemovedOpenChange(!removedOpen)}
            data-testid="theme-pick-prune-removed-toggle"
          >
            <span>Removed ({removedCount})</span>
            <span aria-hidden className="text-lg leading-none">
              {removedOpen ? "▴" : "▾"}
            </span>
          </button>

          {removedOpen && (
            <div className="px-2.5 pb-2.5 space-y-1 max-h-40 overflow-y-auto">
              {removedWords.map((pickAndPruneWord, index) => (
                <WordRow
                  key={pickAndPruneWord.id}
                  dataTestId={`theme-pick-prune-removed-row-${index}`}
                  number={pickAndPruneWord.originalIndex + 1}
                  word={pickAndPruneWord.word.word}
                  answer={pickAndPruneWord.word.answer}
                  variant="removed"
                  actionLabel="Restore"
                  actionTestId={`theme-pick-prune-restore-${pickAndPruneWord.id}`}
                  actionAriaLabel={`Restore ${pickAndPruneWord.word.word}`}
                  onAction={() => onRestore(pickAndPruneWord.id)}
                />
              ))}
              {removedCount === 0 && (
                <p className="text-xs text-center py-2" style={{ color: colors.text.muted }}>
                  Removed words will appear here.
                </p>
              )}
            </div>
          )}
        </section>

        <footer className="flex gap-3 shrink-0">
          <button
            type="button"
            onClick={onContinue}
            disabled={activeCount === 0}
            className={`${themeActionButtonClassName} disabled:opacity-50 disabled:cursor-not-allowed`}
            style={getThemeActionButtonStyle("cta", colors)}
            data-testid="theme-pick-prune-review-submit"
          >
            Continue with {activeCount} words
          </button>
          <button
            type="button"
            onClick={onCancel}
            className={themeOutlineButtonClassName}
            style={getThemeOutlineButtonStyle(colors)}
            data-testid="theme-pick-prune-cancel"
          >
            Cancel
          </button>
        </footer>
      </div>
    </div>
  );
}

const countPillStyle: CSSProperties = {
  borderColor: colors.primary.DEFAULT,
  color: colors.primary.dark,
  backgroundColor: `${colors.primary.DEFAULT}1A`,
};

const removedPillStyle: CSSProperties = {
  borderColor: `${colors.status.danger.DEFAULT}88`,
  color: colors.status.danger.dark,
  backgroundColor: `${colors.status.danger.DEFAULT}14`,
};

const activePanelStyle: CSSProperties = {
  backgroundColor: `${colors.background.DEFAULT}DD`,
  borderColor: `${colors.primary.DEFAULT}66`,
  boxShadow: `inset 0 1px 0 ${colors.background.elevated}`,
};

const removedPanelStyle: CSSProperties = {
  backgroundColor: `${colors.status.danger.DEFAULT}0F`,
  borderColor: `${colors.status.danger.DEFAULT}44`,
};

function WordRow({
  dataTestId,
  number,
  word,
  answer,
  variant,
  actionLabel,
  actionTestId,
  actionAriaLabel,
  onAction,
}: {
  dataTestId: string;
  number: number;
  word: string;
  answer: string;
  variant: "active" | "removed";
  actionLabel: string;
  actionTestId: string;
  actionAriaLabel: string;
  onAction: () => void;
}) {
  const colors = useAppearanceColors();
  const isActive = variant === "active";

  const rowStyle: CSSProperties = isActive
    ? {
        backgroundImage: `linear-gradient(135deg, ${colors.background.elevated} 0%, ${colors.primary.DEFAULT}12 100%)`,
        borderColor: `${colors.primary.DEFAULT}55`,
        boxShadow: `0 1px 2px ${colors.primary.glow}33`,
      }
    : {
        backgroundColor: `${colors.background.elevated}AA`,
        borderColor: `${colors.status.danger.DEFAULT}33`,
        opacity: 0.85,
      };

  const badgeStyle: CSSProperties = isActive
    ? {
        backgroundImage: `linear-gradient(135deg, ${colors.cta.DEFAULT}40, ${colors.cta.dark}55)`,
        color: colors.cta.dark,
        border: `1px solid ${colors.cta.DEFAULT}66`,
      }
    : {
        backgroundColor: `${colors.status.danger.DEFAULT}22`,
        color: colors.status.danger.dark,
        border: `1px solid ${colors.status.danger.DEFAULT}55`,
      };

  const buttonStyle: CSSProperties = isActive
    ? {
        backgroundColor: `${colors.status.danger.DEFAULT}18`,
        borderColor: `${colors.status.danger.DEFAULT}66`,
        color: colors.status.danger.dark,
      }
    : {
        backgroundColor: `${colors.secondary.DEFAULT}1A`,
        borderColor: `${colors.secondary.DEFAULT}66`,
        color: colors.secondary.dark,
      };

  return (
    <article
      className="grid grid-cols-[1.5rem_minmax(0,1fr)_minmax(0,1fr)_auto] items-center gap-2 rounded-lg border px-1.5 py-[7px] transition hover:brightness-105"
      style={rowStyle}
      data-testid={dataTestId}
    >
      <span
        className="h-5 w-5 rounded-full flex items-center justify-center text-[10px] font-bold"
        style={badgeStyle}
      >
        {number}
      </span>
      <p className="truncate text-base font-semibold" style={{ color: colors.text.DEFAULT }}>
        {word}
      </p>
      <p className="truncate text-base text-right italic" style={{ color: colors.text.muted }}>
        {answer}
      </p>
      <button
        type="button"
        onClick={onAction}
        className="rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider transition hover:brightness-110"
        style={buttonStyle}
        data-testid={actionTestId}
        aria-label={actionAriaLabel}
      >
        {actionLabel}
      </button>
    </article>
  );
}
