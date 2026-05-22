"use client";

import { type CSSProperties, type ReactNode } from "react";
import { useAppearanceColors } from "@/app/components/AppearanceProvider";
import { getWinner } from "@/lib/mockOnline/engine";
import type {
  PlayerSlot,
  RoomStatus,
  SentenceCoopState,
  SentenceDuelState,
  SentenceRound,
  SentenceState,
} from "@/lib/mockOnline/state";

interface SentenceBuilderProps {
  state: SentenceState;
  viewerSlot: PlayerSlot;
  status: RoomStatus;
  code: string;
  hostName: string;
  guestName: string;
  title: string;
  onTap: (tile: number) => void;
  onLeave: () => void;
  onRestart: () => void;
}

// Full duel-style card (mirrors app/duel/[duelId]/components/DuelView).
export function SentenceBuilder(props: SentenceBuilderProps) {
  const colors = useAppearanceColors();
  const {
    state,
    viewerSlot,
    status,
    code,
    hostName,
    guestName,
    title,
    onLeave,
  } = props;

  const isCoop = state.mode === "coop";
  const myName = viewerSlot === "host" ? hostName : guestName;
  const theirName = viewerSlot === "host" ? guestName : hostName;

  const gameContainerStyle = {
    "--duel-bg": `${colors.background.DEFAULT}E6`,
    "--duel-bg-elevated": `${colors.background.elevated}80`,
    borderColor: colors.primary.dark,
  } as CSSProperties;
  const subtleBorderStyle = { borderColor: `${colors.primary.dark}80` };
  const exitButtonStyle = {
    backgroundColor: colors.status.danger.DEFAULT,
    color: colors.text.inverse,
  };

  return (
    <main
      className="min-h-dvh md:flex md:items-center md:justify-center md:p-6 lg:p-8"
      style={{ color: colors.text.DEFAULT }}
      data-testid="sentence-builder"
    >
      <div
        className="w-full md:max-w-md lg:max-w-lg md:rounded-2xl md:border md:shadow-2xl flex flex-col min-h-dvh md:min-h-0 md:h-[85vh] md:max-h-[800px] bg-[var(--duel-bg)] md:bg-[var(--duel-bg-elevated)]"
        style={gameContainerStyle}
      >
        <header
          className="flex-shrink-0 flex items-center justify-between p-3 md:p-4 pt-[max(0.75rem,var(--sat))] md:pt-4 border-b"
          style={subtleBorderStyle}
        >
          {state.mode === "coop" ? (
            <TeamScoreboardCard score={state.scores.host} title={title} />
          ) : (
            <MistakesBoard
              myName={myName}
              theirName={theirName}
              myMistakes={viewerSlot === "host" ? state.mistakes.host : state.mistakes.guest}
              theirMistakes={viewerSlot === "host" ? state.mistakes.guest : state.mistakes.host}
            />
          )}
          <button
            onClick={onLeave}
            className="font-bold py-2 px-5 rounded-lg text-base flex-shrink-0 transition hover:brightness-110"
            style={exitButtonStyle}
            data-testid="sentence-exit"
          >
            Exit Duel
          </button>
        </header>

        {status === "waiting" ? (
          <WaitingBody code={code} title={title} />
        ) : status === "finished" ? (
          <FinishedBody {...props} myName={myName} theirName={theirName} />
        ) : isCoop ? (
          <CoopPlayBody
            state={state as SentenceCoopState}
            viewerSlot={viewerSlot}
            onTap={props.onTap}
          />
        ) : (
          <DuelPlayBody
            state={state as SentenceDuelState}
            viewerSlot={viewerSlot}
            onTap={props.onTap}
          />
        )}
      </div>
    </main>
  );
}

function TeamScoreboardCard({ score, title }: { score: number; title: string }) {
  const colors = useAppearanceColors();
  return (
    <div
      className="rounded-lg p-2 sm:p-3 md:p-4 min-w-[160px] sm:min-w-[200px] border-2"
      style={{
        backgroundColor: colors.background.elevated,
        borderColor: colors.primary.dark,
        boxShadow: `0 12px 30px ${colors.primary.glow}`,
      }}
    >
      <div className="text-xs sm:text-sm mb-1" style={{ color: colors.text.muted }}>
        {title}
      </div>
      <div className="flex justify-between items-center gap-2">
        <span className="font-medium text-xs sm:text-sm" style={{ color: colors.status.success.light }}>
          Team
        </span>
        <span
          className="text-lg sm:text-xl md:text-2xl font-bold tabular-nums"
          style={{ color: colors.status.success.light }}
        >
          {score}
        </span>
      </div>
    </div>
  );
}

function MistakesBoard({
  myName,
  theirName,
  myMistakes,
  theirMistakes,
}: {
  myName: string;
  theirName: string;
  myMistakes: number;
  theirMistakes: number;
}) {
  const colors = useAppearanceColors();
  const myColor = colors.status.success.light;
  const theirColor = colors.secondary.light;

  return (
    <div
      className="rounded-lg p-2 sm:p-3 md:p-4 min-w-[160px] sm:min-w-[200px] border-2"
      style={{
        backgroundColor: colors.background.elevated,
        borderColor: colors.primary.dark,
        boxShadow: `0 12px 30px ${colors.primary.glow}`,
      }}
    >
      <div className="text-xs sm:text-sm mb-1 sm:mb-2" style={{ color: colors.text.muted }}>
        Mistakes
      </div>
      <div className="flex justify-between items-center gap-2 mb-0.5 sm:mb-1">
        <span className="font-medium text-xs sm:text-sm truncate" style={{ color: myColor }}>
          You ({myName?.split(" ")[0] || "You"})
        </span>
        <span
          className="text-lg sm:text-xl md:text-2xl font-bold tabular-nums"
          data-testid="sentence-mistakes-me"
          style={{ color: myColor }}
        >
          {myMistakes}
        </span>
      </div>
      <div className="flex justify-between items-center gap-2">
        <span className="font-medium text-xs sm:text-sm truncate" style={{ color: theirColor }}>
          {theirName?.split(" ")[0] || "Opponent"}
        </span>
        <span
          className="text-lg sm:text-xl md:text-2xl font-bold tabular-nums"
          data-testid="sentence-mistakes-them"
          style={{ color: theirColor }}
        >
          {theirMistakes}
        </span>
      </div>
    </div>
  );
}

// ---------------- Waiting ----------------

function WaitingBody({ code, title }: { code: string; title: string }) {
  const colors = useAppearanceColors();
  return (
    <div className="flex-1 flex flex-col items-center justify-center px-4 py-6 gap-6 text-center">
      <div>
        <div
          className="text-xs uppercase tracking-[0.28em]"
          style={{ color: colors.text.muted }}
        >
          {title}
        </div>
        <div className="mt-1 text-2xl font-bold" style={{ color: colors.text.DEFAULT }}>
          Share this code
        </div>
      </div>
      <div
        className="rounded-2xl border-2 px-8 py-5"
        style={{
          borderColor: colors.secondary.dark,
          backgroundColor: `${colors.secondary.DEFAULT}1A`,
        }}
      >
        <div
          className="title-font text-5xl tracking-[0.3em]"
          data-testid="room-code"
          style={{ color: colors.cta.dark }}
        >
          {code}
        </div>
      </div>
      <div
        className="text-sm font-semibold"
        data-testid="waiting-message"
        style={{ color: colors.text.muted }}
      >
        Waiting for opponent…
      </div>
    </div>
  );
}

// ---------------- Finished ----------------

function FinishedBody({
  state,
  viewerSlot,
  myName,
  theirName,
  onLeave,
  onRestart,
}: SentenceBuilderProps & { myName: string; theirName: string }) {
  const colors = useAppearanceColors();
  const winner = getWinner(state);
  const line =
    state.mode === "coop"
      ? `Teamwork! You built all ${state.rounds.length} sentences.`
      : winner === "tie"
        ? "Tie — same number of mistakes!"
        : winner === viewerSlot
          ? "You win with fewer mistakes!"
          : `${winner === "host" ? myName : theirName} wins with fewer mistakes!`;

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-4 py-6 gap-5 text-center">
      <div
        className="w-full rounded-2xl border-2 p-5"
        style={{
          borderColor: colors.cta.dark,
          backgroundColor: `${colors.cta.DEFAULT}1A`,
        }}
      >
        <p className="title-font text-3xl" data-testid="winner-line" style={{ color: colors.cta.dark }}>
          {line}
        </p>
      </div>
      <div className="flex w-full gap-3">
        <button
          type="button"
          onClick={onLeave}
          data-testid="finished-leave"
          className="flex-1 rounded-xl px-6 py-3 font-bold text-base border-b-4 transition-all active:scale-95 hover:brightness-110"
          style={{
            backgroundColor: colors.background.elevated,
            borderBottomColor: colors.neutral.dark,
            color: colors.text.DEFAULT,
          }}
        >
          Leave
        </button>
        <button
          type="button"
          onClick={onRestart}
          data-testid="finished-restart"
          className="flex-1 rounded-xl px-6 py-3 font-bold text-base border-b-4 shadow-2xl transition-all active:scale-95 hover:brightness-110"
          style={{
            backgroundColor: colors.cta.DEFAULT,
            borderBottomColor: colors.cta.dark,
            color: colors.text.DEFAULT,
          }}
        >
          Play again
        </button>
      </div>
    </div>
  );
}

// ---------------- Coop play ----------------

function CoopPlayBody({
  state,
  viewerSlot,
  onTap,
}: {
  state: SentenceCoopState;
  viewerSlot: PlayerSlot;
  onTap: (tile: number) => void;
}) {
  const round = state.rounds[state.index];
  if (!round) return null;
  const isYourTurn = state.turn === viewerSlot;

  return (
    <>
      <div className="flex-1 flex flex-col items-center px-4 py-4 overflow-y-auto">
        <RoundHeader index={state.index} total={state.rounds.length} round={round} mode="coop" />
        <BoardArea
          words={round.words}
          placed={state.placed}
          interactive={isYourTurn}
          onTap={onTap}
        />
        {state.lastResolved && <ResultLine resolved={state.lastResolved} mode="coop" />}
      </div>
      <CoopFooter state={state} viewerSlot={viewerSlot} />
    </>
  );
}

function CoopFooter({
  state,
  viewerSlot,
}: {
  state: SentenceCoopState;
  viewerSlot: PlayerSlot;
}) {
  const colors = useAppearanceColors();
  const isYourTurn = state.turn === viewerSlot;
  const youMissed = state.lastError === viewerSlot;
  const theyMissed = state.lastError !== null && state.lastError !== viewerSlot;
  const subtleBorderStyle = { borderColor: `${colors.primary.dark}80` };

  const message = isYourTurn
    ? `Your turn — place the next word${theyMissed ? " · opponent missed, grab it!" : ""}`
    : `Waiting for opponent…${youMissed ? " (your pick was wrong)" : ""}`;

  return (
    <footer
      className="flex-shrink-0 px-4 py-3 pb-[max(0.75rem,var(--sab))] md:pb-4 border-t"
      style={subtleBorderStyle}
    >
      <div
        className="text-center text-sm font-semibold"
        data-testid="sentence-turn"
        style={{ color: isYourTurn ? colors.cta.dark : colors.text.muted }}
      >
        {message}
      </div>
    </footer>
  );
}

// ---------------- Duel play ----------------

function DuelPlayBody({
  state,
  viewerSlot,
  onTap,
}: {
  state: SentenceDuelState;
  viewerSlot: PlayerSlot;
  onTap: (tile: number) => void;
}) {
  const round = state.rounds[state.index];
  if (!round) return null;
  const myPlaced = viewerSlot === "host" ? state.placedHost : state.placedGuest;
  const myDone = viewerSlot === "host" ? state.doneHost : state.doneGuest;
  const theirDone = viewerSlot === "host" ? state.doneGuest : state.doneHost;
  const theirProgress = viewerSlot === "host" ? state.placedGuest.length : state.placedHost.length;

  return (
    <>
      <div className="flex-1 flex flex-col items-center px-4 py-4 overflow-y-auto">
        <RoundHeader index={state.index} total={state.rounds.length} round={round} mode="duel" />
        <BoardArea
          words={round.words}
          placed={myPlaced}
          interactive={!myDone}
          onTap={onTap}
        />
        {state.lastResolved && <ResultLine resolved={state.lastResolved} mode="duel" />}
      </div>
      <DuelFooter
        myDone={myDone}
        theirDone={theirDone}
        myPlacedCount={myPlaced.length}
        theirPlacedCount={theirProgress}
        total={round.solution.length}
        youMissed={state.lastError === viewerSlot}
      />
    </>
  );
}

function DuelFooter({
  myDone,
  theirDone,
  myPlacedCount,
  theirPlacedCount,
  total,
  youMissed,
}: {
  myDone: boolean;
  theirDone: boolean;
  myPlacedCount: number;
  theirPlacedCount: number;
  total: number;
  youMissed: boolean;
}) {
  const colors = useAppearanceColors();
  const subtleBorderStyle = { borderColor: `${colors.primary.dark}80` };

  let message: string;
  if (myDone && !theirDone) {
    message = `Done! Waiting for opponent (${theirPlacedCount}/${total})…`;
  } else if (!myDone && theirDone) {
    message = `Opponent finished — keep going (${myPlacedCount}/${total})`;
  } else if (myDone && theirDone) {
    message = "Both done — next sentence…";
  } else {
    message = youMissed
      ? `Wrong pick · +1 mistake · keep building (${myPlacedCount}/${total})`
      : `Build the sentence (${myPlacedCount}/${total}) · opponent ${theirPlacedCount}/${total}`;
  }

  return (
    <footer
      className="flex-shrink-0 px-4 py-3 pb-[max(0.75rem,var(--sab))] md:pb-4 border-t"
      style={subtleBorderStyle}
    >
      <div
        className="text-center text-sm font-semibold"
        data-testid="sentence-turn"
        style={{ color: myDone ? colors.text.muted : colors.cta.dark }}
      >
        {message}
      </div>
    </footer>
  );
}

// ---------------- Shared body pieces ----------------

function RoundHeader({
  index,
  total,
  round,
  mode,
}: {
  index: number;
  total: number;
  round: SentenceRound;
  mode: SentenceState["mode"];
}) {
  const colors = useAppearanceColors();
  const pillStyle =
    mode === "coop"
      ? {
          color: colors.status.success.light,
          backgroundColor: `${colors.status.success.DEFAULT}33`,
          borderColor: colors.status.success.DEFAULT,
        }
      : {
          color: colors.status.danger.light,
          backgroundColor: `${colors.status.danger.DEFAULT}33`,
          borderColor: colors.status.danger.DEFAULT,
        };

  return (
    <div className="text-center mb-4 w-full max-w-md">
      <div className="text-sm mb-1" style={{ color: colors.text.muted }}>
        Sentence #{index + 1} of {total}
      </div>
      <span
        className="inline-block px-3 py-1 rounded-full border text-sm font-medium uppercase"
        style={pillStyle}
      >
        {mode}
      </span>
      <div className="mt-3 text-xs uppercase tracking-[0.25em]" style={{ color: colors.text.muted }}>
        Build this sentence
      </div>
      <div className="text-2xl md:text-3xl font-bold mt-1" style={{ color: colors.text.DEFAULT }}>
        {round.english}
      </div>
    </div>
  );
}

function BoardArea({
  words,
  placed,
  interactive,
  onTap,
}: {
  words: readonly string[];
  placed: readonly number[];
  interactive: boolean;
  onTap: (tile: number) => void;
}) {
  const positions = new Map(placed.map((tile, position) => [tile, position]));
  const assembled = placed.map((tile) => words[tile]).join(" ");

  return (
    <div className="w-full max-w-md flex flex-col gap-4 items-stretch">
      <AssembledRow text={assembled} />
      <WordGrid>
        {words.map((word, tile) => {
          const orderPosition = positions.has(tile) ? (positions.get(tile) as number) : -1;
          const isPlaced = orderPosition !== -1;
          const variant: WordVariant = isPlaced ? "placed" : interactive ? "idle" : "disabled";
          return (
            <WordButton
              key={tile}
              word={word}
              testId={`sentence-word-${tile}`}
              orderPosition={orderPosition}
              variant={variant}
              disabled={!interactive || isPlaced}
              onClick={() => onTap(tile)}
            />
          );
        })}
      </WordGrid>
    </div>
  );
}

function AssembledRow({ text }: { text: string }) {
  const colors = useAppearanceColors();
  return (
    <div
      className="w-full min-h-12 rounded-xl border-2 border-dashed p-3 text-center text-lg font-semibold"
      style={{
        borderColor: `${colors.primary.dark}80`,
        color: colors.text.DEFAULT,
      }}
      data-testid="sentence-assembled"
    >
      {text || (
        <span className="text-sm font-normal" style={{ color: colors.text.muted }}>
          Tap the words in order…
        </span>
      )}
    </div>
  );
}

function WordGrid({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-2 gap-2 sm:gap-3">{children}</div>;
}

type WordVariant = "idle" | "placed" | "disabled";

function WordButton({
  word,
  testId,
  orderPosition,
  variant,
  disabled,
  onClick,
}: {
  word: string;
  testId: string;
  orderPosition: number;
  variant: WordVariant;
  disabled: boolean;
  onClick: () => void;
}) {
  const colors = useAppearanceColors();
  const style: CSSProperties =
    variant === "placed"
      ? {
          backgroundColor: `${colors.secondary.DEFAULT}26`,
          borderColor: colors.secondary.DEFAULT,
          color: colors.secondary.dark,
        }
      : variant === "disabled"
        ? {
            borderColor: colors.neutral.dark,
            backgroundColor: colors.background.DEFAULT,
            color: colors.text.muted,
            opacity: 0.6,
          }
        : {
            backgroundColor: colors.background.elevated,
            borderColor: colors.primary.dark,
            color: colors.text.DEFAULT,
          };

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      data-testid={testId}
      className="relative p-4 rounded-lg border-2 text-lg font-medium transition-all hover:brightness-110 active:scale-95 disabled:cursor-not-allowed"
      style={style}
    >
      {orderPosition !== -1 && (
        <span
          className="absolute -top-2 -left-2 flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold"
          style={{ backgroundColor: colors.secondary.DEFAULT, color: colors.text.inverse }}
        >
          {orderPosition + 1}
        </span>
      )}
      {word}
    </button>
  );
}

function ResultLine({
  resolved,
  mode,
}: {
  resolved: NonNullable<SentenceState["lastResolved"]>;
  mode: SentenceState["mode"];
}) {
  const colors = useAppearanceColors();
  const lead = mode === "coop" ? "Built together!" : "Both finished:";

  return (
    <p
      className="text-center text-sm font-semibold mt-4"
      data-testid="sentence-last-result"
      style={{ color: colors.status.success.light }}
    >
      {lead} <span className="font-bold">{resolved.correctText}</span>
    </p>
  );
}
