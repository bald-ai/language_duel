"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
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
} from "./AnswerOptionButton";
import { NONE_OF_ABOVE } from "@/lib/answerShuffle";
import { RELAY_ANSWER_TIMEOUT_MS, TIMER_UPDATE_INTERVAL_MS } from "@/lib/duelConstants";
import { formatVisibleUser } from "@/lib/userDisplay";
import { getErrorMessage } from "@/lib/errors";
import type { DuelPlayerSummary } from "../hooks/useDuelSessionViewModel";
import type { RelaySafeDuel, RelayServedQuestion } from "../hooks/relaySessionTypes";

interface RelayDuelViewProps {
  duel: RelaySafeDuel;
  viewerRole: "challenger" | "opponent";
  challenger: DuelPlayerSummary | null;
  opponent: DuelPlayerSummary | null;
}

type Colors = ReturnType<typeof useAppearanceColors>;

export function RelayDuelView({ duel, viewerRole, challenger, opponent }: RelayDuelViewProps) {
  const colors = useAppearanceColors();
  const router = useRouter();

  const pick = useMutation(api.relayDuel.relayPick);
  const answer = useMutation(api.relayDuel.relayAnswer);
  const advance = useMutation(api.relayDuel.relayAdvance);
  const timeout = useMutation(api.relayDuel.relayTimeout);
  const stopDuel = useMutation(api.duels.stopDuel);

  const phase = duel.relayPhase ?? "pick";
  const picker = duel.relayPicker ?? "challenger";
  const answerer = picker === "challenger" ? "opponent" : "challenger";
  const finished = duel.status === "completed";
  const amPicker = viewerRole === picker;
  const amAnswerer = viewerRole === answerer;
  const showFeedback = phase === "feedback";

  const isChallenger = viewerRole === "challenger";
  const myScore = isChallenger ? duel.challengerScore : duel.opponentScore;
  const theirScore = isChallenger ? duel.opponentScore : duel.challengerScore;
  const myName = formatVisibleUser(isChallenger ? challenger : opponent, "You");
  const theirName = formatVisibleUser(isChallenger ? opponent : challenger, "Opponent");

  const budget = duel.relayHardBudget?.[viewerRole] ?? 0;
  const served = duel.relayServedQuestion;
  const total = duel.wordOrder.length;
  const resolvedCount = duel.relayResolvedIndices?.length ?? 0;
  const remaining = duel.relayRemainingPositions ?? [];

  const promptAt = (position: number) => {
    const item = duel.sessionWords[duel.wordOrder[position]];
    if (!item) return "";
    return item.kind === "word" ? item.word : item.englishPrompt;
  };

  const handleTimeout = useCallback(() => {
    // The server scheduler is the backstop; ignore client-side races here.
    void timeout({ duelId: duel._id }).catch(() => {});
  }, [timeout, duel._id]);

  const handlePick = (position: number, hardUpgrade: boolean) => {
    void pick({ duelId: duel._id, wordIndex: position, hardUpgrade }).catch((error) =>
      toast.error(getErrorMessage(error, "Could not hand over the word"))
    );
  };

  const handleAnswer = (value: string) => {
    void answer({ duelId: duel._id, value }).catch((error) =>
      toast.error(getErrorMessage(error, "Could not submit answer"))
    );
  };

  const handleAdvance = () => {
    void advance({ duelId: duel._id }).catch((error) =>
      toast.error(getErrorMessage(error, "Could not continue"))
    );
  };

  const handleExit = () => {
    void stopDuel({ duelId: duel._id })
      .then(() => router.push("/"))
      .catch((error) => toast.error(getErrorMessage(error, "Could not exit duel")));
  };

  const styles = buildStyles(colors);

  return (
    <main
      className="min-h-dvh md:flex md:items-center md:justify-center md:p-6 lg:p-8"
      style={{ color: colors.text.DEFAULT }}
    >
      <div
        className="w-full md:max-w-md lg:max-w-lg md:rounded-2xl md:border md:shadow-2xl flex flex-col min-h-dvh md:min-h-0 md:h-[85vh] md:max-h-[800px] bg-[var(--duel-bg)] md:bg-[var(--duel-bg-elevated)]"
        style={styles.container}
      >
        <header
          className="flex-shrink-0 flex items-center justify-between p-3 md:p-4 border-b"
          style={styles.subtleBorder}
        >
          <Scoreboard myName={myName} theirName={theirName} myScore={myScore} theirScore={theirScore} />
          {!finished && (
            <button
              onClick={handleExit}
              className="font-bold py-2 px-5 rounded-lg text-base flex-shrink-0 transition hover:brightness-110"
              style={styles.exitButton}
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
              theirName={theirName}
              myScore={myScore}
              theirScore={theirScore}
              onBackToHome={() => router.push("/")}
              dataTestIdBack="relay-back-home"
            />
          ) : phase === "pick" ? (
            amPicker ? (
              <RelayPickList
                remaining={remaining}
                promptAt={promptAt}
                theirName={theirName}
                budget={budget}
                onPick={handlePick}
                colors={colors}
              />
            ) : (
              <Waiting colors={colors}>Waiting for {theirName} to pick a word…</Waiting>
            )
          ) : (
            <>
              <RelayWordHeader
                prompt={duel.relayAssignedIndex !== undefined ? promptAt(duel.relayAssignedIndex) : ""}
                index={resolvedCount + 1}
                total={total}
                fromOrTo={amAnswerer ? `from ${theirName}` : `to ${theirName}`}
                colors={colors}
              />
              <RelayAnswerArea
                key={duel.relayAssignedIndex}
                served={served}
                amAnswerer={amAnswerer}
                showFeedback={showFeedback}
                active={!showFeedback && duel.status === "active"}
                startedAt={duel.relayAnswerStartedAt}
                onTimeout={handleTimeout}
                lastResult={duel.relayLastResult ?? null}
                theirName={theirName}
                isLastWord={resolvedCount + 1 >= total}
                onAnswer={handleAnswer}
                onAdvance={handleAdvance}
                colors={colors}
              />
            </>
          )}
        </div>
      </div>
    </main>
  );
}

const footerButtonClass =
  "mt-5 w-full max-w-md rounded-xl px-6 sm:px-10 py-2.5 sm:py-3 font-bold text-base sm:text-lg shadow-2xl disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-95 border-b-4 hover:brightness-110";

function buildStyles(colors: Colors) {
  return {
    container: {
      "--duel-bg": `${colors.background.DEFAULT}E6`,
      "--duel-bg-elevated": `${colors.background.elevated}80`,
      borderColor: colors.primary.dark,
    } as CSSProperties,
    subtleBorder: { borderColor: `${colors.primary.dark}80` },
    muted: { color: colors.text.muted },
    exitButton: { backgroundColor: colors.status.danger.DEFAULT, color: colors.text.inverse },
    ctaEnabled: {
      backgroundColor: colors.cta.DEFAULT,
      borderBottomColor: colors.cta.dark,
      color: colors.text.DEFAULT,
    },
    ctaDisabled: {
      backgroundColor: colors.background.elevated,
      borderBottomColor: colors.neutral.dark,
      color: colors.text.muted,
    },
  };
}

function RelayWordHeader({
  prompt,
  index,
  total,
  fromOrTo,
  colors,
}: {
  prompt: string;
  index: number;
  total: number;
  fromOrTo: string;
  colors: Colors;
}) {
  return (
    <div className="text-center mb-4">
      <div className="text-sm mb-2" style={{ color: colors.text.muted }}>
        Word {index} of {total}
      </div>
      <div className="text-xs uppercase tracking-[0.25em] mb-2" style={{ color: colors.text.muted }}>
        {fromOrTo}
      </div>
      <div className="text-2xl md:text-3xl font-bold">{prompt}</div>
    </div>
  );
}

interface RelayPickListProps {
  remaining: number[];
  promptAt: (position: number) => string;
  theirName: string;
  budget: number;
  onPick: (position: number, hardUpgrade: boolean) => void;
  colors: Colors;
}

// Owns the hard-upgrade toggle. Rendered only on the picker's pick turn, so it
// unmounts between turns and the toggle resets without an effect.
function RelayPickList({ remaining, promptAt, theirName, budget, onPick, colors }: RelayPickListProps) {
  const [hardPosition, setHardPosition] = useState<number | null>(null);
  const [pickingPosition, setPickingPosition] = useState<number | null>(null);

  const handlePick = (position: number) => {
    if (pickingPosition !== null) return;
    setPickingPosition(position);
    onPick(position, hardPosition === position);
  };

  return (
    <div className="w-full max-w-md">
      <div className="flex items-center justify-between mb-3">
        <div className="text-sm" style={{ color: colors.text.muted }}>
          Hand a word to {theirName} · {remaining.length} left
        </div>
        <span
          className="rounded-full px-3 py-1 text-xs font-bold"
          style={{ backgroundColor: `${colors.cta.DEFAULT}22`, color: colors.cta.dark }}
          data-testid="relay-hard-budget"
        >
          🔥 {budget} left
        </span>
      </div>
      <div className="flex flex-col gap-2.5">
        {remaining.map((position) => {
          const isHard = hardPosition === position;
          const isPicking = pickingPosition === position;
          const pickInFlight = pickingPosition !== null;
          const toggleDisabled = (budget <= 0 && !isHard) || pickInFlight;
          const rowStyle: CSSProperties = isPicking
            ? {
                borderColor: colors.secondary.DEFAULT,
                backgroundColor: `${colors.secondary.DEFAULT}26`,
                color: colors.secondary.dark,
              }
            : isHard
              ? {
                  borderColor: colors.status.danger.DEFAULT,
                  backgroundColor: `${colors.status.danger.DEFAULT}14`,
                  color: colors.text.DEFAULT,
                }
              : {
                  borderColor: colors.primary.dark,
                  backgroundColor: colors.background.elevated,
                  color: colors.text.DEFAULT,
                };
          return (
            <div key={position} className="relative">
              <button
                type="button"
                onClick={() => handlePick(position)}
                disabled={pickInFlight && !isPicking}
                className="w-full text-left rounded-xl border-2 px-4 py-3 pr-24 text-base font-semibold transition-all active:scale-[0.98] hover:brightness-110 disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:brightness-100"
                style={rowStyle}
                data-testid={`relay-pick-${position}`}
              >
                <span className="block truncate">{promptAt(position)}</span>
              </button>
              <button
                type="button"
                onClick={() => setHardPosition((current) => (current === position ? null : position))}
                disabled={toggleDisabled}
                aria-pressed={isHard}
                className="absolute right-2 top-1/2 -translate-y-1/2 inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-[11px] font-bold uppercase tracking-wide transition disabled:opacity-40 disabled:cursor-not-allowed"
                style={
                  isHard
                    ? {
                        borderColor: colors.status.danger.DEFAULT,
                        backgroundColor: colors.status.danger.DEFAULT,
                        color: colors.text.inverse,
                      }
                    : {
                        borderColor: colors.primary.dark,
                        backgroundColor: "transparent",
                        color: colors.text.muted,
                      }
                }
                data-testid={`relay-hard-toggle-${position}`}
              >
                <span
                  className="inline-flex h-3 w-3 items-center justify-center rounded-sm border"
                  style={{
                    borderColor: isHard ? colors.text.inverse : colors.text.muted,
                    backgroundColor: isHard ? colors.text.inverse : "transparent",
                  }}
                >
                  {isHard && (
                    <span
                      style={{ color: colors.status.danger.DEFAULT }}
                      className="text-[9px] leading-none"
                    >
                      ✓
                    </span>
                  )}
                </span>
                Hard
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

interface RelayAnswerAreaProps {
  served: RelayServedQuestion | null;
  amAnswerer: boolean;
  showFeedback: boolean;
  active: boolean;
  startedAt: number | undefined;
  onTimeout: () => void;
  lastResult: RelaySafeDuel["relayLastResult"] | null;
  theirName: string;
  isLastWord: boolean;
  onAnswer: (value: string) => void;
  onAdvance: () => void;
  colors: Colors;
}

// Owns the answerer's tentative selection. Keyed on the assigned position by the
// parent, so a new word remounts it and the selection resets without an effect.
function RelayAnswerArea({
  served,
  amAnswerer,
  showFeedback,
  active,
  startedAt,
  onTimeout,
  lastResult,
  theirName,
  isLastWord,
  onAnswer,
  onAdvance,
  colors,
}: RelayAnswerAreaProps) {
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const secondsLeft = useRelayCountdown(active, startedAt, onTimeout);

  const revealed = served?.answerRevealedToViewer === true;
  const correctAnswer = revealed && served && "correctOption" in served ? served.correctOption : null;

  const optionContext: OptionContext = {
    answer: "",
    selectedAnswer: showFeedback ? lastResult?.chosen ?? null : selectedAnswer,
    correctAnswer,
    hasNoneOption: correctAnswer !== null ? correctAnswer === NONE_OF_ABOVE : null,
    isShowingFeedback: showFeedback,
    eliminatedOptions: [],
    canEliminate: false,
    opponentAnswer: null,
    showOpponentPick: false,
  };

  const styles = buildStyles(colors);

  return (
    <>
      {!showFeedback && secondsLeft !== null && (
        <div
          className="mb-4 text-3xl font-bold tabular-nums"
          style={{ color: colors.text.DEFAULT }}
          data-testid="relay-timer"
        >
          {secondsLeft}
          <span className="text-xs ml-1" style={{ color: colors.text.muted }}>
            sec
          </span>
        </div>
      )}

      {served && served.kind === "word" && (
        <div className="grid grid-cols-2 gap-2 sm:gap-3 w-full max-w-md">
          {served.options.map((option: string, index: number) => {
            const state = computeOptionState(option, { ...optionContext, answer: option });
            return (
              <AnswerOptionButton
                key={`${option}-${index}`}
                answer={option}
                displayText={option}
                state={state}
                onClick={() => {
                  if (amAnswerer && !showFeedback) setSelectedAnswer(option);
                }}
                isShowingFeedback={showFeedback}
                hasNoneOption={correctAnswer === NONE_OF_ABOVE}
                dataTestId={`relay-answer-${index}`}
              />
            );
          })}
        </div>
      )}

      {served && served.kind === "sentence" && (
        <div
          className="w-full max-w-md text-center text-sm"
          style={{ color: colors.text.muted }}
          data-testid="relay-sentence-placeholder"
        >
          Sentence rounds in Relay aren&apos;t playable in this view yet. The
          assigned answerer should switch to a self-duel session to build the
          sentence.
        </div>
      )}

      {showFeedback && lastResult ? (
        <div
          className="mt-4 text-center text-sm font-medium"
          style={{
            color: lastResult.correct ? colors.status.success.light : colors.status.danger.light,
          }}
          data-testid="relay-feedback"
        >
          {feedbackText(lastResult.correct, amAnswerer, correctAnswer)}
        </div>
      ) : (
        !amAnswerer && (
          <div className="mt-4 text-sm" style={{ color: colors.text.muted }} data-testid="relay-watching">
            {theirName} is answering…
          </div>
        )
      )}

      {amAnswerer && !showFeedback && (
        <button
          className={footerButtonClass}
          style={selectedAnswer ? styles.ctaEnabled : styles.ctaDisabled}
          disabled={!selectedAnswer}
          onClick={() => selectedAnswer && onAnswer(selectedAnswer)}
          data-testid="relay-confirm"
        >
          Confirm Answer
        </button>
      )}
      {amAnswerer && showFeedback && (
        <button
          className={footerButtonClass}
          style={styles.ctaEnabled}
          onClick={onAdvance}
          data-testid="relay-continue"
        >
          {isLastWord ? "See Results" : "Continue"}
        </button>
      )}
    </>
  );
}

function feedbackText(correct: boolean, mine: boolean, correctAnswer: string | null): string {
  const who = mine ? "You" : "They";
  if (correct) return `${who} got it — +1`;
  return `${who} missed${correctAnswer ? ` — answer: ${correctAnswer}` : ""}`;
}

function Waiting({ children, colors }: { children: ReactNode; colors: Colors }) {
  return (
    <div
      className="py-10 text-center text-xl md:text-2xl font-bold"
      data-testid="relay-waiting"
      style={{ color: colors.text.DEFAULT }}
    >
      {children}
    </div>
  );
}

function useRelayCountdown(
  active: boolean,
  startedAt: number | undefined,
  onExpire: () => void
): number | null {
  const [secondsLeft, setSecondsLeft] = useState<number | null>(() =>
    active && startedAt !== undefined
      ? Math.max(0, Math.ceil((startedAt + RELAY_ANSWER_TIMEOUT_MS - Date.now()) / 1000))
      : null
  );
  const firedRef = useRef(false);

  useEffect(() => {
    if (!active || startedAt === undefined) return;
    const tick = () => {
      const msLeft = startedAt + RELAY_ANSWER_TIMEOUT_MS - Date.now();
      setSecondsLeft(Math.max(0, Math.ceil(msLeft / 1000)));
      if (msLeft <= 0 && !firedRef.current) {
        firedRef.current = true;
        onExpire();
      }
    };
    const interval = setInterval(tick, TIMER_UPDATE_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [active, startedAt, onExpire]);

  return secondsLeft;
}
