"use client";

import { useCallback, useState, type CSSProperties, type ReactNode } from "react";
import { useMutation } from "convex/react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import { useAppearanceColors } from "@/app/components/AppearanceProvider";
import { Scoreboard } from "@/app/game/components/duel/Scoreboard";
import { FinalResultsPanel } from "@/app/game/components/duel/FinalResultsPanel";
import {
  AnswerOptionButton,
  computeOptionState,
  type OptionContext,
} from "@/app/duel/[duelId]/components/AnswerOptionButton";
import { otherSlot } from "@/lib/mockOnline/players";
import type { RelayState } from "@/lib/mockOnline/state";
import { convexErrorMessage, playerName } from "../helpers";
import type { RoomData } from "./RoomView";

interface RelayDuelViewProps {
  data: RoomData;
  onLeave: () => void;
}

export function RelayDuelView({ data, onLeave }: RelayDuelViewProps) {
  const colors = useAppearanceColors();
  const applyMove = useMutation(api.prototypeRooms.applyMove);
  const restartGame = useMutation(api.prototypeRooms.restartGame);

  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);

  const handlePick = useCallback(
    (wordId: string) => {
      void applyMove({ roomId: data.room._id, move: { kind: "pick", wordId } }).catch((error) =>
        toast.error(convexErrorMessage(error, "Move failed"))
      );
    },
    [applyMove, data.room._id]
  );

  const handleConfirm = useCallback(() => {
    if (!selectedAnswer) return;
    void applyMove({ roomId: data.room._id, move: { kind: "answer", value: selectedAnswer } })
      .then(() => setSelectedAnswer(null))
      .catch((error) => toast.error(convexErrorMessage(error, "Move failed")));
  }, [applyMove, data.room._id, selectedAnswer]);

  const handleNext = useCallback(() => {
    void applyMove({ roomId: data.room._id, move: { kind: "next" } }).catch((error) =>
      toast.error(convexErrorMessage(error, "Move failed"))
    );
  }, [applyMove, data.room._id]);

  const handleRestart = useCallback(() => {
    setSelectedAnswer(null);
    void restartGame({ roomId: data.room._id }).catch((error) =>
      toast.error(convexErrorMessage(error, "Could not restart"))
    );
  }, [restartGame, data.room._id]);

  const state = data.room.state;
  if (state.kind !== "relay") return null;

  const { viewerSlot } = data;
  const hostName = playerName(data.host, "Host");
  const guestName = playerName(data.guest, "Guest");
  const myName = viewerSlot === "host" ? hostName : guestName;
  const opponentName = viewerSlot === "host" ? guestName : hostName;
  const myScore = state.scores[viewerSlot];
  const theirScore = state.scores[otherSlot(viewerSlot)];

  const finished = data.room.status === "finished";
  const amPicker = viewerSlot === state.picker;
  const amAnswerer = viewerSlot === otherSlot(state.picker);
  const word = state.assigned;
  const showFeedback = state.phase === "feedback";

  // ---- Styles copied from the real DuelView so this matches it closely. ----
  const gameContainerStyle = {
    "--duel-bg": `${colors.background.DEFAULT}E6`,
    "--duel-bg-elevated": `${colors.background.elevated}80`,
    borderColor: colors.primary.dark,
  } as CSSProperties;
  const subtleBorderStyle = { borderColor: `${colors.primary.dark}80` };
  const mutedTextStyle = { color: colors.text.muted };
  const exitButtonStyle = { backgroundColor: colors.status.danger.DEFAULT, color: colors.text.inverse };
  const footerButtonClass =
    "w-full rounded-xl px-6 sm:px-10 py-2.5 sm:py-3 font-bold text-base sm:text-lg shadow-2xl disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-95 border-b-4 hover:brightness-110";
  const ctaEnabledStyle = { backgroundColor: colors.cta.DEFAULT, borderBottomColor: colors.cta.dark, color: colors.text.DEFAULT };
  const ctaDisabledStyle = { backgroundColor: colors.background.elevated, borderBottomColor: colors.neutral.dark, color: colors.text.muted };

  const wordCardStyle: CSSProperties = {
    borderColor: colors.primary.dark,
    backgroundColor: colors.background.elevated,
    color: colors.text.DEFAULT,
  };

  const optionContext = (): OptionContext => ({
    answer: "",
    selectedAnswer: showFeedback ? state.lastResult?.chosen ?? null : selectedAnswer,
    correctAnswer: showFeedback && word ? word.answer : null,
    hasNoneOption: showFeedback ? false : null,
    isShowingFeedback: showFeedback,
    eliminatedOptions: [],
    canEliminate: false,
    opponentAnswer: null,
    showOpponentPick: false,
  });

  const renderAnswerGrid = (interactive: boolean) =>
    word && (
      <div className="grid grid-cols-2 gap-2 sm:gap-3 w-full max-w-md">
        {word.options.map((option, i) => {
          const optState = computeOptionState(option, { ...optionContext(), answer: option });
          return (
            <AnswerOptionButton
              key={i}
              answer={option}
              displayText={option}
              state={optState}
              onClick={() => interactive && !showFeedback && setSelectedAnswer(option)}
              isShowingFeedback={showFeedback}
              dataTestId={`relay-answer-${i}`}
            />
          );
        })}
      </div>
    );

  const wordHeader = word && (
    <>
      <div className="text-center text-sm mb-3" style={mutedTextStyle}>
        Word #{state.resolved + 1} of {state.total}
      </div>
      <div className="text-center mb-4">
        <div className="text-xs uppercase tracking-[0.25em] mb-2" style={mutedTextStyle}>
          {amAnswerer ? `from ${opponentName}` : `to ${opponentName}`}
        </div>
        <div className="text-2xl md:text-3xl font-bold">{word.prompt}</div>
      </div>
    </>
  );

  return (
    <main className="min-h-dvh md:flex md:items-center md:justify-center md:p-6 lg:p-8" style={{ color: colors.text.DEFAULT }}>
      <div
        className="w-full md:max-w-md lg:max-w-lg md:rounded-2xl md:border md:shadow-2xl flex flex-col min-h-dvh md:min-h-0 md:h-[85vh] md:max-h-[800px] bg-[var(--duel-bg)] md:bg-[var(--duel-bg-elevated)]"
        style={gameContainerStyle}
      >
        <header className="flex-shrink-0 flex items-center justify-between p-3 md:p-4 border-b" style={subtleBorderStyle}>
          <Scoreboard myName={myName} theirName={opponentName} myScore={myScore} theirScore={theirScore} />
          {!finished && (
            <button
              onClick={onLeave}
              className="font-bold py-2 px-5 rounded-lg text-base flex-shrink-0 transition hover:brightness-110"
              style={exitButtonStyle}
              data-testid="relay-exit"
            >
              Exit Duel
            </button>
          )}
        </header>

        <div className="flex-1 flex flex-col items-center justify-center px-4 py-4 overflow-y-auto">
          {finished ? (
            <FinalResultsPanel
              myName={myName}
              theirName={opponentName}
              myScore={myScore}
              theirScore={theirScore}
              onBackToHome={onLeave}
              dataTestIdBack="relay-back-home"
            />
          ) : data.room.status === "waiting" ? (
            <WaitingForOpponent code={data.room.code} colors={colors} />
          ) : state.phase === "pick" ? (
            amPicker ? (
              <div className="w-full max-w-md">
                <div className="text-center mb-3 text-sm" style={mutedTextStyle}>
                  Hand a word to {opponentName} · {state.pool.length} left
                </div>
                <div className="flex flex-col gap-2">
                  {state.pool.map((poolWord) => (
                    <button
                      key={poolWord.id}
                      type="button"
                      onClick={() => handlePick(poolWord.id)}
                      className="flex items-center justify-between gap-3 px-4 py-3 rounded-lg border-2 transition-all hover:brightness-110 active:scale-[0.98]"
                      style={wordCardStyle}
                      data-testid={`relay-pick-${poolWord.id}`}
                    >
                      <span className="text-base font-semibold">{poolWord.prompt}</span>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <Waiting>Waiting for {opponentName} to pick a word…</Waiting>
            )
          ) : amAnswerer ? (
            <>
              {wordHeader}
              {renderAnswerGrid(!showFeedback)}
              {showFeedback && state.lastResult && <FeedbackLine result={state.lastResult} mine colors={colors} />}
            </>
          ) : (
            // Picker's view while the rival answers / during the reveal.
            <>
              {wordHeader}
              {showFeedback ? (
                <>
                  {renderAnswerGrid(false)}
                  {state.lastResult && <FeedbackLine result={state.lastResult} mine={false} colors={colors} />}
                </>
              ) : (
                <Waiting>Waiting for {opponentName} to answer…</Waiting>
              )}
            </>
          )}
        </div>

        <footer className="flex-shrink-0 flex flex-col items-center gap-2 w-full px-4 py-3 md:pb-4 border-t" style={subtleBorderStyle}>
          {!finished && state.phase === "answer" && amAnswerer && (
            <button className={footerButtonClass} style={selectedAnswer ? ctaEnabledStyle : ctaDisabledStyle} disabled={!selectedAnswer} onClick={handleConfirm} data-testid="relay-confirm">
              Confirm Answer
            </button>
          )}
          {!finished && showFeedback && amAnswerer && (
            <button className={footerButtonClass} style={ctaEnabledStyle} onClick={handleNext} data-testid="relay-continue">
              {state.pool.length === 0 ? "See Results" : "Continue"}
            </button>
          )}
          {finished && (
            <button
              className="w-full rounded-xl px-6 py-2.5 sm:py-3 font-bold text-base sm:text-lg border-2 transition-all active:scale-95 hover:brightness-110"
              style={{ borderColor: colors.primary.dark, backgroundColor: colors.background.elevated, color: colors.text.DEFAULT }}
              onClick={handleRestart}
              data-testid="relay-restart"
            >
              Play Again
            </button>
          )}
        </footer>
      </div>
    </main>
  );
}

type Colors = ReturnType<typeof useAppearanceColors>;

function WaitingForOpponent({ code, colors }: { code: string; colors: Colors }) {
  return (
    <div className="w-full max-w-md text-center">
      <div className="text-sm mb-3" style={{ color: colors.text.muted }}>
        Share this code — the duel starts the moment they join.
      </div>
      <div className="rounded-xl border-2 p-5 mb-3" style={{ borderColor: colors.cta.dark, backgroundColor: `${colors.cta.DEFAULT}1A` }}>
        <div className="text-xs font-bold uppercase tracking-[0.24em] mb-1" style={{ color: colors.text.muted }}>
          Room code
        </div>
        <div className="title-font text-5xl tracking-[0.3em]" data-testid="relay-room-code" style={{ color: colors.cta.light }}>
          {code}
        </div>
      </div>
      <div className="text-sm font-semibold animate-pulse" style={{ color: colors.status.warning.light }} data-testid="relay-waiting-opponent">
        Waiting for opponent…
      </div>
    </div>
  );
}

function FeedbackLine({
  result,
  mine,
  colors,
}: {
  result: NonNullable<RelayState["lastResult"]>;
  mine: boolean;
  colors: Colors;
}) {
  const who = mine ? "You" : "They";
  const text = result.correct ? `${who} got it — +1` : `${who} missed — answer: ${result.answer}`;
  return (
    <div
      className="mt-4 text-center text-sm font-medium"
      style={{ color: result.correct ? colors.status.success.light : colors.status.danger.light }}
      data-testid="relay-feedback"
    >
      {text}
    </div>
  );
}

function Waiting({ children }: { children: ReactNode }) {
  const colors = useAppearanceColors();
  return (
    <div className="py-10 text-center text-xl md:text-2xl font-bold" data-testid="relay-waiting" style={{ color: colors.text.DEFAULT }}>
      {children}
    </div>
  );
}
