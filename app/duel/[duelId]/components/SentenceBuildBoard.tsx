"use client";

import { useMemo, type CSSProperties, type ReactNode } from "react";
import { useAppearanceColors } from "@/app/components/AppearanceProvider";
import {
  formatSentenceTileForDisplay,
  getSentenceTilePoolFontSizeClass,
} from "@/lib/sentenceGameplay/displayTile";
import {
  computeRevealBadgeView,
  type RevealBadge,
  type RevealBadgeView,
} from "@/lib/sentenceGameplay/reveal";
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

type BoardColors = ReturnType<typeof useAppearanceColors>;

/** Which color treatment a tile gets, in the precedence the board applies. */
type TileStatus = "eliminated" | "correct" | "wrong" | "lastPlaced" | "placed" | "lastWrongPick" | "available";

type SentenceTileBoard = {
  placedTileIndices: number[];
  correctnessMask: boolean[] | null;
  eliminatedSet: Set<number>;
  revealView: RevealBadgeView;
  lastWrongTileIndex: number | null;
  tileMeanings: Array<string | null>;
};

type SentenceTileView = {
  status: TileStatus;
  /** Position in the built sentence, or -1 while the tile is in the pool. */
  order: number;
  isPlaced: boolean;
  isLast: boolean;
  /** This slot's Confirm result; undefined before a Confirm or while unplaced. */
  correctness: boolean | undefined;
  isEliminated: boolean;
  isLastWrongPick: boolean;
  /** Unplaced and not eliminated: the tiles that fly, scramble, and pulse. */
  isLoose: boolean;
  isPulsing: boolean;
  revealBadge: RevealBadge | undefined;
  meaning: string | null;
};

function getTileStatus(tile: Pick<SentenceTileView, "isEliminated" | "correctness" | "isPlaced" | "isLast" | "isLastWrongPick">): TileStatus {
  if (tile.isEliminated) return "eliminated";
  if (tile.correctness !== undefined) return tile.correctness ? "correct" : "wrong";
  if (tile.isPlaced) return tile.isLast ? "lastPlaced" : "placed";
  return tile.isLastWrongPick ? "lastWrongPick" : "available";
}

function describeSentenceTile(index: number, board: SentenceTileBoard): SentenceTileView {
  const order = board.placedTileIndices.indexOf(index);
  const isPlaced = order !== -1;
  const isLast = isPlaced && order === board.placedTileIndices.length - 1;
  const correctness = isPlaced ? board.correctnessMask?.[order] : undefined;
  // PvE hint effects (reveal + eliminate never coexist on one round, and
  // never coexist with PvP sabotage — different duel modes).
  const isEliminated = board.eliminatedSet.has(index);
  // Subtle flag for the partner's previous WRONG pick (unplaced).
  const isLastWrongPick = !isPlaced && board.lastWrongTileIndex === index;
  const isLoose = !isPlaced && !isEliminated;
  return {
    status: getTileStatus({ isEliminated, correctness, isPlaced, isLast, isLastWrongPick }),
    order,
    isPlaced,
    isLast,
    correctness,
    isEliminated,
    isLastWrongPick,
    isLoose,
    isPulsing: isLoose && board.revealView.pulseTileIndex === index,
    revealBadge: isEliminated ? undefined : board.revealView.badgeByTileIndex.get(index),
    meaning: isEliminated ? null : board.tileMeanings[index]?.trim() || null,
  };
}

function getTileStatusStyles(colors: BoardColors): Record<TileStatus, CSSProperties> {
  const muted = { backgroundColor: colors.background.DEFAULT, color: colors.text.muted };
  return {
    eliminated: { borderColor: colors.neutral.dark, ...muted },
    correct: { borderColor: colors.status.success.DEFAULT, backgroundColor: `${colors.status.success.DEFAULT}24`, color: colors.text.DEFAULT },
    wrong: { borderColor: colors.status.danger.DEFAULT, backgroundColor: `${colors.status.danger.DEFAULT}24`, color: colors.text.DEFAULT },
    lastPlaced: { borderColor: colors.status.danger.DEFAULT, ...muted },
    placed: { borderColor: colors.neutral.dark, ...muted },
    lastWrongPick: { borderColor: colors.status.danger.DEFAULT, backgroundColor: `${colors.status.danger.DEFAULT}14`, color: colors.text.DEFAULT },
    available: { borderColor: colors.primary.dark, backgroundColor: colors.background.elevated, color: colors.text.DEFAULT },
  };
}

function flyingTileClasses(tile: SentenceTileView, fontSizeClass: string): string {
  return `min-h-16 p-3 rounded-lg border-2 ${fontSizeClass} font-medium transition-colors relative shadow-lg overflow-hidden flex flex-col items-center justify-center gap-1 ${tile.isLastWrongPick ? "border-dashed" : ""} ${tile.isEliminated ? "opacity-40 line-through cursor-not-allowed" : "hover:brightness-110"}`;
}

function anchoredTileClasses(tile: SentenceTileView, fontSizeClass: string, isFlyingEffect: boolean, checked: boolean): string {
  // Hide the anchored cell of an unplaced tile while it flies (keeps layout).
  const hiddenWhileFlying = isFlyingEffect && tile.isLoose;
  return `min-h-16 p-3 rounded-lg border-2 ${fontSizeClass} font-medium transition-all relative active:scale-95 flex flex-col items-center justify-center gap-1 ${tile.isLastWrongPick ? "border-dashed" : ""} ${tile.isPulsing ? "animate-pulse ring-2 ring-amber-400" : ""} ${hiddenWhileFlying ? "invisible" : ""} ${tile.isEliminated ? "opacity-40 line-through cursor-not-allowed" : tile.isPlaced && !checked ? "opacity-70" : "hover:brightness-110"}`;
}

function TileMeaning({ meaning, index, colors }: { meaning: string | null; index: number; colors: BoardColors }) {
  if (!meaning) return null;
  return <span className="max-w-full break-words text-center text-[11px] leading-tight font-extrabold opacity-85" style={{ color: colors.secondary.light }} data-testid={`sentence-tile-${index}-meaning`}>{meaning}</span>;
}

function TileOrderBadge({ tile, checked, index, colors }: { tile: SentenceTileView; checked: boolean; index: number; colors: BoardColors }) {
  if (!tile.isPlaced) return null;
  const color = tile.correctness === true
    ? colors.status.success.DEFAULT
    : tile.correctness === false || (tile.isLast && !checked)
      ? colors.status.danger.DEFAULT
      : colors.primary.DEFAULT;
  return <span className="absolute -top-2 -left-2 w-6 h-6 rounded-full text-xs font-extrabold flex items-center justify-center text-white shadow" style={{ backgroundColor: color }} data-testid={`sentence-badge-${index}`}>{tile.order + 1}</span>;
}

function TileRevealBadge({ badge, index, colors }: { badge: RevealBadge | undefined; index: number; colors: BoardColors }) {
  if (!badge) return null;
  return <span className="absolute -top-2 -right-2 min-w-6 h-6 px-1 rounded-full text-xs font-extrabold flex items-center justify-center text-white shadow" style={{ backgroundColor: badge.correct ? colors.status.success.DEFAULT : "#f59e0b" }} data-testid={`sentence-reveal-badge-${index}`}>{badge.correct ? "✓" : badge.slot}</span>;
}

function FlyingSentenceTiles({ activeSabotage, bouncingOptions, trampolineOptions, flyingIndices, renderTile }: {
  activeSabotage: SabotageEffect | null;
  bouncingOptions: ReturnType<typeof useBounceOptions>["bouncingOptions"];
  trampolineOptions: ReturnType<typeof useTrampolineOptions>["trampolineOptions"];
  flyingIndices: number[];
  renderTile: (index: number, style?: CSSProperties) => ReactNode;
}) {
  return <>
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

  </>;
}

function getTimerColor(colors: BoardColors, secondsLeft: number): string {
  if (secondsLeft <= TIMER_DANGER_THRESHOLD) return colors.status.danger.light;
  if (secondsLeft <= TIMER_WARNING_THRESHOLD) return colors.status.warning.light;
  return colors.text.DEFAULT;
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
  const timerColor = getTimerColor(colors, secondsLeft);

  const tileFontSizeClass = getSentenceTilePoolFontSizeClass(tilePool);
  const statusStyles = getTileStatusStyles(colors);
  const board: SentenceTileBoard = {
    placedTileIndices,
    correctnessMask,
    eliminatedSet,
    revealView,
    lastWrongTileIndex,
    tileMeanings,
  };
  const tiles = tilePool.map((_, index) => describeSentenceTile(index, board));
  // Reverse scrambles only UNPLACED, non-eliminated tiles so the built
  // sentence stays readable. Flying copies always render their plain text.
  const anchoredTexts = displayTiles.map((text, index) =>
    activeSabotage === "reverse" && tiles[index].isLoose
      ? reverseAnimatedAnswers?.[index] ?? text
      : text
  );

  // One renderer for both the anchored grid tile and its flying copy, so badges
  // / colors / handlers are declared once (mirrors DuelAnswerGrid.renderOption).
  const renderTile = (index: number, flyStyle?: CSSProperties) => {
    const tile = tiles[index];
    const flying = flyStyle !== undefined;
    const statusStyle = statusStyles[tile.status];
    const tileStyle = tile.meaning
      ? { ...statusStyle, boxShadow: `0 0 0 1px ${colors.secondary.light}` }
      : statusStyle;

    return (
      <button
        key={flying ? `fly-${tilePool[index]}-${index}` : `${tilePool[index]}-${index}`}
        onClick={() => onTileClick(index)}
        disabled={locked || tile.isEliminated}
        className={
          flying
            ? flyingTileClasses(tile, tileFontSizeClass)
            : anchoredTileClasses(tile, tileFontSizeClass, isFlyingEffect, checked)
        }
        style={flyStyle ? { ...tileStyle, ...flyStyle } : tileStyle}
        data-testid={flying ? `sentence-tile-${index}-fly` : `sentence-tile-${index}`}
      >
        <span className={flying ? "truncate block max-w-full" : "break-words"}>
          {flying ? displayTiles[index] : anchoredTexts[index]}
        </span>
        <TileMeaning meaning={tile.meaning} index={index} colors={colors} />
        <TileOrderBadge tile={tile} checked={checked} index={index} colors={colors} />
        <TileRevealBadge badge={tile.revealBadge} index={index} colors={colors} />
      </button>
    );
  };

  // The unplaced, non-eliminated pool tiles are the ones that fly.
  const flyingIndices = tiles.flatMap((tile, index) => (tile.isLoose ? [index] : []));

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
      <FlyingSentenceTiles activeSabotage={activeSabotage} bouncingOptions={bouncingOptions}
        trampolineOptions={trampolineOptions} flyingIndices={flyingIndices} renderTile={renderTile} />

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
