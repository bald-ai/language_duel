"use client";

import { useMemo, type CSSProperties, type ReactNode } from "react";
import { useAppearanceColors } from "@/app/components/AppearanceProvider";
import {
  formatSentenceTileForDisplay,
  getSentenceTilePoolFontSizeClass,
} from "@/lib/sentenceGameplay/displayTile";
import { computeRevealBadgeView } from "@/lib/sentenceGameplay/reveal";
import type { SentenceTileReveal } from "@/lib/sentenceGameplay/hints";
import {
  TIMER_DANGER_THRESHOLD,
  TIMER_WARNING_THRESHOLD,
} from "@/lib/duelConstants";
import type { SabotageEffect, SabotagePhase } from "@/lib/sabotage/types";
import {
  BUTTON_WIDTH,
  BUTTON_HEIGHT,
  TRAMPOLINE_BUTTON_WIDTH,
  TRAMPOLINE_BUTTON_HEIGHT,
  TRAMPOLINE_FLY_SCALE,
  BOUNCE_FLY_SCALE,
} from "@/lib/sabotage/constants";
import { SabotageRenderer } from "@/app/game/sabotage/SabotageRenderer";
import { useReverseAnswers } from "@/app/game/sabotage/hooks/useReverseAnswers";
import { useBounceOptions } from "@/app/game/sabotage/hooks/useBounceOptions";
import { useTrampolineOptions } from "@/app/game/sabotage/hooks/useTrampolineOptions";
import { useMeasuredAnimationBounds } from "@/app/game/sabotage/hooks/useAnimatedOptions";
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
  tileMeanings?: Array<string | null>;
  placedTileIndices: number[];
  /**
   * Per-position correctness for the placed tiles, set right after a Confirm.
   * `null` → never color tiles. PvP passes the real mask; relay always passes
   * `null` (decision #2 — no per-tile hints to brute-force against).
   */
  correctnessMask: boolean[] | null;
  /**
   * remove_distractor hint (PvE): pool indices to grey out + disable. The board
   * also skips them in the tap handler. Defaults to none.
   */
  eliminatedTileIndices?: number[];
  /**
   * reveal_tiles hint (PvE): the marked slots (shared across both boards). Each
   * carries the pool indices that validly fill it; the per-tile badge + pulse is
   * derived per-player from the placed sequence. Defaults to none.
   */
  revealedTiles?: SentenceTileReveal[];
  /**
   * An unplaced tile to flag subtly because it was the previous player's WRONG
   * pick (placed nothing). `null` → nothing flagged. Used by Tag Team so the
   * partner can see what was just tried; ignored by PvP/Relay.
   */
  lastWrongTileIndex?: number | null;
  /**
   * Incoming PvP sabotage to render on the board (the effect my opponent sent
   * me). `null` → no effect. Only the UNPLACED pool tiles fly (bounce/trampoline)
   * or scramble (reverse); placed tiles + the Confirm/Reset row stay anchored so
   * the player can keep building. Sticky is a drop-in full-screen overlay.
   * Defaults to none (Relay / TbT never pass it).
   */
  activeSabotage?: SabotageEffect | null;
  sabotagePhase?: SabotagePhase;
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
 * tappable tile pool (order badges, optional green/red correctness colors,
 * optional PvE reveal badges, optional PvP sabotage chaos) + the Confirm/Reset
 * actions. It owns no server state, no mutations, and no timer logic — the
 * parent computes `secondsLeft`, wires the handlers, and decides what overlays
 * to pass. Shared by PvP (`SentenceBoard`), Relay, and Tag Team.
 *
 * Sabotage rendering (PvP only — the others pass `activeSabotage: null`): the
 * physics/scramble hooks are pinned to the FULL, stable `tilePool.length`, so
 * placing a tile only removes that one flyer and never re-scatters the rest.
 * Unplaced pool tiles fly (bounce/trampoline) or scramble (reverse); placed
 * tiles and the action row stay anchored.
 */
export function SentenceBuildBoard({
  themeName,
  englishPrompt,
  roundLabel,
  tilePool,
  tileMeanings = [],
  placedTileIndices,
  correctnessMask,
  eliminatedTileIndices = [],
  revealedTiles = [],
  lastWrongTileIndex = null,
  activeSabotage = null,
  sabotagePhase = "wind-up",
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
  const eliminatedSet = useMemo(
    () => new Set(eliminatedTileIndices),
    [eliminatedTileIndices]
  );
  // Per-player reveal badges + the next-due pulse, derived from this client's own
  // placed sequence (the revealed *slots* are the shared duel field).
  const revealView = useMemo(
    () => computeRevealBadgeView(revealedTiles, placedTileIndices),
    [revealedTiles, placedTileIndices]
  );

  // Sabotage overlays (PvP only). The hooks are no-ops when `activeSabotage`
  // isn't their effect, so they're always called (hooks rules) and pinned to the
  // whole pool — placing a tile changes which flyers we RENDER, not the physics
  // array, so the rest keep their trajectories.
  const displayTiles = useMemo(
    () => tilePool.map(formatSentenceTileForDisplay),
    [tilePool]
  );
  const { ref: sabotageAreaRef, bounds: sabotageBounds } =
    useMeasuredAnimationBounds<HTMLDivElement>();

  const { reverseAnimatedAnswers } = useReverseAnswers({
    activeSabotage,
    answers: displayTiles,
  });
  const { bouncingOptions } = useBounceOptions({
    activeSabotage,
    optionCount: tilePool.length,
    bounds: sabotageBounds,
  });
  const { trampolineOptions } = useTrampolineOptions({
    activeSabotage,
    optionCount: tilePool.length,
    bounds: sabotageBounds,
  });
  const isFlyingEffect = activeSabotage === "bounce" || activeSabotage === "trampoline";

  const timerIsDanger = secondsLeft <= TIMER_DANGER_THRESHOLD;
  const timerIsWarning = secondsLeft <= TIMER_WARNING_THRESHOLD;
  const timerColor = timerIsDanger
    ? colors.status.danger.light
    : timerIsWarning
      ? colors.status.warning.light
      : colors.text.DEFAULT;

  const tileFontSizeClass = getSentenceTilePoolFontSizeClass(tilePool);

  // One renderer for both the anchored grid tile and its flying copy, so badges
  // / colors / handlers are declared once (mirrors DuelAnswerGrid.renderOption).
  const renderTile = (index: number, flyStyle?: CSSProperties) => {
    const tile = tilePool[index];
    const tileMeaning = tileMeanings[index]?.trim() || null;
    const flying = flyStyle !== undefined;
    const order = placedTileIndices.indexOf(index);
    const isPlaced = order !== -1;
    const isLast = isPlaced && order === placedTileIndices.length - 1;
    const isCorrect = checked && isPlaced ? correctnessMask?.[order] === true : false;
    const isWrong = checked && isPlaced ? correctnessMask?.[order] === false : false;
    // Subtle flag for the partner's previous WRONG pick (unplaced).
    const isLastWrong = !isPlaced && lastWrongTileIndex === index;
    // PvE hint effects (reveal + eliminate never coexist on one round, and
    // never coexist with PvP sabotage — different duel modes).
    const isEliminated = eliminatedSet.has(index);
    const revealBadge = isEliminated ? undefined : revealView.badgeByTileIndex.get(index);
    const isPulsing = !isEliminated && !isPlaced && revealView.pulseTileIndex === index;
    // Reverse scrambles only UNPLACED, non-eliminated tiles so the built
    // sentence stays readable. Flying copies always render their plain text.
    const reversed = !flying && activeSabotage === "reverse" && !isPlaced && !isEliminated;
    const displayText = reversed
      ? reverseAnimatedAnswers?.[index] ?? displayTiles[index]
      : displayTiles[index];
    // Hide the anchored cell of an unplaced tile while it flies (keeps layout).
    const hiddenWhileFlying = !flying && isFlyingEffect && !isPlaced && !isEliminated;

    const badge: string | null = isPlaced ? String(order + 1) : null;

    let tileStyle: CSSProperties;
    if (isEliminated) {
      tileStyle = {
        borderColor: colors.neutral.dark,
        backgroundColor: colors.background.DEFAULT,
        color: colors.text.muted,
      };
    } else if (isCorrect) {
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
    } else if (isLastWrong) {
      tileStyle = {
        borderColor: colors.status.danger.DEFAULT,
        backgroundColor: `${colors.status.danger.DEFAULT}14`,
        color: colors.text.DEFAULT,
      };
    } else {
      tileStyle = {
        borderColor: colors.primary.dark,
        backgroundColor: colors.background.elevated,
        color: colors.text.DEFAULT,
      };
    }

    if (tileMeaning && !isEliminated) {
      tileStyle = {
        ...tileStyle,
        boxShadow: `0 0 0 1px ${colors.secondary.light}`,
      };
    }

    const badgeColor = isCorrect
      ? colors.status.success.DEFAULT
      : isWrong || (isLast && !checked)
        ? colors.status.danger.DEFAULT
        : colors.primary.DEFAULT;

    const buttonClasses = flying
      ? `min-h-16 p-3 rounded-lg border-2 ${tileFontSizeClass} font-medium transition-colors relative shadow-lg overflow-hidden flex flex-col items-center justify-center gap-1 ${
          isLastWrong ? "border-dashed" : ""
        } ${
          isEliminated
            ? "opacity-40 line-through cursor-not-allowed"
            : "hover:brightness-110"
        }`
      : `min-h-16 p-3 rounded-lg border-2 ${tileFontSizeClass} font-medium transition-all relative active:scale-95 flex flex-col items-center justify-center gap-1 ${
          isLastWrong ? "border-dashed" : ""
        } ${isPulsing ? "animate-pulse ring-2 ring-amber-400" : ""} ${
          hiddenWhileFlying ? "invisible" : ""
        } ${
          isEliminated
            ? "opacity-40 line-through cursor-not-allowed"
            : isPlaced && !checked
              ? "opacity-70"
              : "hover:brightness-110"
        }`;

    return (
      <button
        key={flying ? `fly-${tile}-${index}` : `${tile}-${index}`}
        onClick={() => onTileClick(index)}
        disabled={locked || isEliminated}
        className={buttonClasses}
        style={flyStyle ? { ...tileStyle, ...flyStyle } : tileStyle}
        data-testid={flying ? `sentence-tile-${index}-fly` : `sentence-tile-${index}`}
      >
        <span className={flying ? "truncate block max-w-full" : "break-words"}>
          {displayText}
        </span>
        {tileMeaning && !isEliminated && (
          <span
            className="max-w-full break-words text-center text-[11px] leading-tight font-extrabold opacity-85"
            style={{ color: colors.secondary.light }}
            data-testid={`sentence-tile-${index}-meaning`}
          >
            {tileMeaning}
          </span>
        )}
        {badge !== null && (
          <span
            className="absolute -top-2 -left-2 w-6 h-6 rounded-full text-xs font-extrabold flex items-center justify-center text-white shadow"
            style={{ backgroundColor: badgeColor }}
            data-testid={`sentence-badge-${index}`}
          >
            {badge}
          </span>
        )}
        {revealBadge && (
          <span
            className="absolute -top-2 -right-2 min-w-6 h-6 px-1 rounded-full text-xs font-extrabold flex items-center justify-center text-white shadow"
            style={{
              backgroundColor: revealBadge.correct
                ? colors.status.success.DEFAULT
                : "#f59e0b",
            }}
            data-testid={`sentence-reveal-badge-${index}`}
          >
            {revealBadge.correct ? "✓" : revealBadge.slot}
          </span>
        )}
      </button>
    );
  };

  // The unplaced, non-eliminated pool tiles are the ones that fly.
  const flyingIndices = tilePool
    .map((_, index) => index)
    .filter(
      (index) => !placedTileIndices.includes(index) && !eliminatedSet.has(index)
    );

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-4 py-4 overflow-y-auto">
      <div ref={sabotageAreaRef} className="fixed inset-0 pointer-events-none" aria-hidden />

      {/* Sticky is content-agnostic: a full-screen overlay that obscures the
          board and touches nothing. Bounce/trampoline/reverse draw on the tiles
          themselves below, so SabotageRenderer ignores them. */}
      <SabotageRenderer effect={activeSabotage} phase={sabotagePhase} />

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

      {/* Tile pool — order badges on placed tiles, green/red after a Confirm.
          Unplaced tiles go `invisible` (not unmounted) during bounce/trampoline
          so the grid keeps its height while the flying copies animate over it. */}
      <div className="mt-4 grid grid-cols-2 gap-2 sm:gap-3 w-full max-w-md">
        {tilePool.map((_, index) => renderTile(index))}
      </div>

      {/* Bounce / Trampoline overlays: only the unplaced tiles fly, each pinned
          by its pool index so placing one leaves the rest undisturbed. */}
      {activeSabotage === "bounce" && bouncingOptions.length > 0 && (
        <div className="fixed inset-0 z-50 pointer-events-none overflow-hidden">
          {flyingIndices.map((index) => {
            const pos = bouncingOptions[index];
            if (!pos) return null;
            return renderTile(index, {
              position: "absolute",
              left: pos.x,
              top: pos.y,
              width: BUTTON_WIDTH,
              height: BUTTON_HEIGHT,
              pointerEvents: "auto",
              transform: `scale(${BOUNCE_FLY_SCALE})`,
              transformOrigin: "top left",
            });
          })}
        </div>
      )}

      {activeSabotage === "trampoline" && trampolineOptions.length > 0 && (
        <div className="fixed inset-0 z-50 pointer-events-none overflow-hidden">
          {flyingIndices.map((index) => {
            const pos = trampolineOptions[index];
            if (!pos) return null;
            return renderTile(index, {
              position: "absolute",
              left: pos.x + pos.shakeOffset.x,
              top: pos.y + pos.shakeOffset.y,
              width: TRAMPOLINE_BUTTON_WIDTH,
              height: TRAMPOLINE_BUTTON_HEIGHT,
              pointerEvents: "auto",
              transform: pos.phase === "flying" ? `scale(${TRAMPOLINE_FLY_SCALE})` : "scale(1)",
              transformOrigin: "top left",
            });
          })}
        </div>
      )}

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
