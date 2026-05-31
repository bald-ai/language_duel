"use client";

import type { ReactNode } from "react";
import { useAppearanceColors } from "@/app/components/AppearanceProvider";
import {
  formatSentenceTileForDisplay,
  getSentenceTilePoolFontSizeClass,
} from "@/lib/sentenceGameplay/displayTile";
import {
  TIMER_DANGER_THRESHOLD,
  TIMER_WARNING_THRESHOLD,
} from "@/lib/duelConstants";
import { buildDuelViewStyles } from "./duelViewStyles";

interface SentenceBuildBoardProps {
  /** Theme label shown above the prompt. */
  themeName: string;
  /** The English prompt the player is translating. */
  englishPrompt: string;
  /** Optional muted line above the theme (e.g. "Round 1 of 5"). Omitted when
   * the parent renders its own round/turn header (relay). */
  roundLabel?: string;
  tilePool: string[];
  placedTileIndices: number[];
  /**
   * Per-position correctness for the placed tiles, set right after a Confirm.
   * `null` → never color tiles. PvP passes the real mask; relay always passes
   * `null` (decision #2 — no per-tile hints to brute-force against).
   */
  correctnessMask: boolean[] | null;
  secondsLeft: number;
  /** Disables every tile (round completed / timed out / not your turn). */
  locked: boolean;
  /** Whether to render the Confirm / Reset action row. */
  showActions: boolean;
  confirmDisabled: boolean;
  onTileClick: (tileIndex: number) => void;
  onConfirm: () => void;
  onReset: () => void;
  /** Reveal / "not quite" / completion content rendered beneath the actions. */
  belowActions?: ReactNode;
  /** Whether to show the countdown. Defaults to true; relay hides it in the
   * feedback phase where the timer no longer applies. */
  showTimer?: boolean;
}

/**
 * Pure presentational build-and-confirm sentence board: prompt + timer + the
 * tappable tile pool (order badges, optional green/red correctness colors) +
 * the Confirm/Reset actions. It owns no server state, no mutations, and no
 * timer logic — the parent computes `secondsLeft`, wires the handlers, and
 * decides whether to color tiles. Shared by PvP (`SentencePvpBoard`) and Relay.
 */
export function SentenceBuildBoard({
  themeName,
  englishPrompt,
  roundLabel,
  tilePool,
  placedTileIndices,
  correctnessMask,
  secondsLeft,
  locked,
  showActions,
  confirmDisabled,
  onTileClick,
  onConfirm,
  onReset,
  belowActions,
  showTimer = true,
}: SentenceBuildBoardProps) {
  const colors = useAppearanceColors();
  const styles = buildDuelViewStyles(colors);
  const checked = correctnessMask !== null;

  const timerIsDanger = secondsLeft <= TIMER_DANGER_THRESHOLD;
  const timerIsWarning = secondsLeft <= TIMER_WARNING_THRESHOLD;
  const timerColor = timerIsDanger
    ? colors.status.danger.light
    : timerIsWarning
      ? colors.status.warning.light
      : colors.text.DEFAULT;

  const tileFontSizeClass = getSentenceTilePoolFontSizeClass(tilePool);

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-4 py-4 overflow-y-auto">
      {roundLabel && (
        <div className="text-center mb-3">
          <div className="text-sm mb-1" style={styles.mutedText}>
            {roundLabel}
          </div>
        </div>
      )}

      <div className="text-center mb-4">
        <div
          className="text-xs uppercase tracking-[0.25em] mb-2"
          style={styles.mutedText}
        >
          {themeName}
        </div>
        <h1
          className="text-2xl md:text-3xl font-bold leading-tight"
          style={{ color: colors.text.DEFAULT }}
          data-testid="sentence-prompt"
        >
          {englishPrompt}
        </h1>
      </div>

      {showTimer && (
        <div className="mb-4 text-center">
          <div className="flex items-center justify-center gap-2">
            <span
              className={`text-4xl font-bold tabular-nums ${timerIsDanger ? "animate-pulse" : ""}`}
              style={{ color: timerColor }}
              data-testid="sentence-timer"
            >
              {secondsLeft}
            </span>
            <span className="text-xs" style={styles.mutedText}>
              sec
            </span>
          </div>
        </div>
      )}

      {placedTileIndices.length === 0 && (
        <div
          className="mt-1 w-full max-w-md min-h-[1.5rem] text-center text-base"
          style={styles.mutedText}
          data-testid="sentence-hint"
        >
          Tap the words in order…
        </div>
      )}

      {/* Tile pool — order badges on placed tiles, green/red after a Confirm */}
      <div className="mt-4 grid grid-cols-2 gap-2 sm:gap-3 w-full max-w-md">
        {tilePool.map((tile, index) => {
          const order = placedTileIndices.indexOf(index);
          const isPlaced = order !== -1;
          const isLast = isPlaced && order === placedTileIndices.length - 1;
          const isCorrect = checked && isPlaced ? correctnessMask?.[order] === true : false;
          const isWrong = checked && isPlaced ? correctnessMask?.[order] === false : false;

          let badge: string | null = null;
          if (isPlaced) {
            badge = isLast && !checked ? "✕" : String(order + 1);
          }

          let tileStyle: React.CSSProperties;
          if (isCorrect) {
            tileStyle = {
              borderColor: colors.status.success.DEFAULT,
              backgroundColor: `${colors.status.success.DEFAULT}24`,
              color: colors.text.DEFAULT,
            };
          } else if (isWrong) {
            tileStyle = {
              borderColor: colors.status.danger.DEFAULT,
              backgroundColor: `${colors.status.danger.DEFAULT}24`,
              color: colors.text.DEFAULT,
            };
          } else if (isPlaced) {
            tileStyle = {
              borderColor: isLast ? colors.status.danger.DEFAULT : colors.neutral.dark,
              backgroundColor: colors.background.DEFAULT,
              color: colors.text.muted,
            };
          } else {
            tileStyle = {
              borderColor: colors.primary.dark,
              backgroundColor: colors.background.elevated,
              color: colors.text.DEFAULT,
            };
          }

          const badgeColor = isCorrect
            ? colors.status.success.DEFAULT
            : isWrong || (isLast && !checked)
              ? colors.status.danger.DEFAULT
              : colors.primary.DEFAULT;

          return (
            <button
              key={`${tile}-${index}`}
              onClick={() => onTileClick(index)}
              disabled={locked}
              className={`p-4 rounded-lg border-2 ${tileFontSizeClass} font-medium transition-all relative active:scale-95 ${
                isPlaced && !checked ? "opacity-70" : "hover:brightness-110"
              }`}
              style={tileStyle}
              data-testid={`sentence-tile-${index}`}
            >
              {formatSentenceTileForDisplay(tile)}
              {badge !== null && (
                <span
                  className="absolute -top-2 -left-2 w-6 h-6 rounded-full text-xs font-extrabold flex items-center justify-center text-white shadow"
                  style={{ backgroundColor: badgeColor }}
                  data-testid={`sentence-badge-${index}`}
                >
                  {badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Confirm / Reset — Confirm verifies the whole sentence; Reset is free */}
      {showActions && (
        <div className="mt-5 flex gap-3 w-full max-w-md">
          <button
            onClick={onConfirm}
            disabled={confirmDisabled}
            className="flex-1 rounded-xl font-extrabold text-lg py-3.5 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              backgroundColor: colors.cta.DEFAULT,
              color: "#fff",
              borderBottom: `4px solid ${colors.cta.dark}`,
            }}
            data-testid="sentence-confirm"
          >
            Confirm
          </button>
          <button
            onClick={onReset}
            disabled={locked || placedTileIndices.length === 0}
            className="rounded-xl font-extrabold text-lg py-3.5 px-5 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed hover:brightness-105"
            style={{
              backgroundColor: colors.neutral.light,
              color: colors.text.DEFAULT,
              borderBottom: `4px solid ${colors.neutral.dark}`,
            }}
            data-testid="sentence-reset"
          >
            Reset
          </button>
        </div>
      )}

      {belowActions}
    </div>
  );
}
