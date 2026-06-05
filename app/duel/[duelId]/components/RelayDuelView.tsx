"use client";

import {
  useCallback,
  useEffect,
  useMemo,
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
import { duelCardBackground } from "./duelViewStyles";
import { RELAY_ANSWER_TIMEOUT_MS, TIMER_UPDATE_INTERVAL_MS } from "@/lib/duelConstants";
import { SENTENCE_RELAY_TIMEOUT_MS } from "@/lib/themes/sentenceConstants";
import { formatVisibleUser } from "@/lib/userDisplay";
import { getErrorMessage } from "@/lib/errors";
import { SentenceBuildBoard } from "./SentenceBuildBoard";
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
  const total = duel.itemOrder.length;
  const resolvedCount = duel.relayResolvedIndices?.length ?? 0;
  const remaining = duel.relayRemainingPositions ?? [];

  // Each position renders its own answer surface based on its kind: word → MC
  // grid, sentence → tile board. The prompt is the word itself or the sentence's
  // English prompt.
  const itemAt = (position: number) => duel.sessionItems[duel.itemOrder[position]];
  const promptAt = (position: number) => {
    const item = itemAt(position);
    if (!item) return "";
    return item.kind === "sentence" ? item.englishPrompt : item.word;
  };
  const isSentenceAt = (position: number) => itemAt(position)?.kind === "sentence";
  const themeAt = (position: number) => itemAt(position)?.themeName ?? "";

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
        className="w-full md:max-w-md lg:max-w-lg md:rounded-2xl md:border md:shadow-2xl flex flex-col min-h-dvh md:min-h-0 md:h-[85vh] md:max-h-[800px] backdrop-blur-xl"
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
                isSentenceAt={isSentenceAt}
                theirName={theirName}
                budget={budget}
                onPick={handlePick}
                colors={colors}
              />
            ) : (
              <Waiting colors={colors}>Waiting for {theirName} to pick a word…</Waiting>
            )
          ) : served?.kind === "sentence" ? (
            <RelaySentenceAnswer
              key={duel.relayAssignedIndex}
              duel={duel}
              served={served}
              answerer={answerer}
              amAnswerer={amAnswerer}
              showFeedback={showFeedback}
              active={!showFeedback && duel.status === "active"}
              startedAt={duel.relayAnswerStartedAt}
              onTimeout={handleTimeout}
              onAdvance={handleAdvance}
              isLastWord={resolvedCount + 1 >= total}
              index={resolvedCount + 1}
              total={total}
              themeName={duel.relayAssignedIndex !== undefined ? themeAt(duel.relayAssignedIndex) : ""}
              theirName={theirName}
              colors={colors}
            />
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
      // Eclipse fade: solid top/bottom, see-through middle (see duelCardBackground).
      background: duelCardBackground(colors),
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
  isSentenceAt: (position: number) => boolean;
  theirName: string;
  budget: number;
  onPick: (position: number, hardUpgrade: boolean) => void;
  colors: Colors;
}

// Owns the hard-upgrade toggle. Rendered only on the picker's pick turn, so it
// unmounts between turns and the toggle resets without an effect. The 🔥 toggle
// is hidden on sentence rows (decision #3 — sentences are never hard-upgraded
// in v1; `relayPick` also rejects it server-side).
function RelayPickList({ remaining, promptAt, isSentenceAt, theirName, budget, onPick, colors }: RelayPickListProps) {
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
          const isSentence = isSentenceAt(position);
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
                className={`w-full text-left rounded-xl border-2 px-4 py-3 text-base font-semibold transition-all active:scale-[0.98] hover:brightness-110 disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:brightness-100 ${
                  isSentence ? "pr-4" : "pr-24"
                }`}
                style={rowStyle}
                data-testid={`relay-pick-${position}`}
              >
                <span className="block truncate">{promptAt(position)}</span>
              </button>
              {!isSentence && (
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
              )}
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
  const secondsLeft = useRelayCountdown(active, startedAt, RELAY_ANSWER_TIMEOUT_MS, onTimeout);

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

interface RelaySentenceAnswerProps {
  duel: RelaySafeDuel;
  served: Extract<RelayServedQuestion, { kind: "sentence" }>;
  answerer: "challenger" | "opponent";
  amAnswerer: boolean;
  showFeedback: boolean;
  active: boolean;
  startedAt: number | undefined;
  onTimeout: () => void;
  onAdvance: () => void;
  isLastWord: boolean;
  index: number;
  total: number;
  themeName: string;
  theirName: string;
  colors: Colors;
}

// The relay sentence answer surface. The assigned answerer builds the sentence
// on the shared tile board (build-and-confirm); the picker watches the same
// board fill live (read-only). A Confirm colors each placed tile green/red via
// the per-tile correctness mask (same feedback as PvP). Keyed on the assigned
// position by the parent, so a new round remounts it.
function RelaySentenceAnswer({
  duel,
  served,
  answerer,
  amAnswerer,
  showFeedback,
  active,
  startedAt,
  onTimeout,
  onAdvance,
  isLastWord,
  index,
  total,
  themeName,
  theirName,
  colors,
}: RelaySentenceAnswerProps) {
  const tap = useMutation(api.relayDuel.relaySentenceTap);
  const removeLast = useMutation(api.relayDuel.relaySentenceRemoveLast);
  const reset = useMutation(api.relayDuel.relaySentenceReset);
  const confirm = useMutation(api.relayDuel.relaySentenceConfirm);

  // Per-Confirm correctness snapshot (client-only). `null` = not checked yet.
  // Set from the Confirm result, cleared on any board edit — same as PvP. While
  // set, the Confirm button is disabled so repeated clicks can't re-fire.
  const [correctnessMask, setCorrectnessMask] = useState<boolean[] | null>(null);
  const checked = correctnessMask !== null;

  const assignedIndex = duel.relayAssignedIndex;
  const secondsLeft = useRelayCountdown(active, startedAt, SENTENCE_RELAY_TIMEOUT_MS, onTimeout);

  // Both players read the ANSWERER's progress row, so the picker mirrors the
  // answerer's placed tiles in real time.
  const placedTileIndices = useMemo(() => {
    const entry = (duel.sentenceProgress ?? []).find(
      (row) => row.questionIndex === assignedIndex && row.role === answerer
    );
    return entry?.placedTileIndices ?? [];
  }, [duel.sentenceProgress, assignedIndex, answerer]);

  const locked = !amAnswerer || showFeedback;

  const handleTileClick = useCallback(
    (tileIndex: number) => {
      if (locked) return;
      // Touching any tile clears the previous Confirm's colors.
      if (checked) setCorrectnessMask(null);
      const order = placedTileIndices.indexOf(tileIndex);
      if (order === -1) {
        void tap({ duelId: duel._id, tileIndex }).catch((error) =>
          toast.error(getErrorMessage(error, "Could not place tile"))
        );
        return;
      }
      if (order === placedTileIndices.length - 1) {
        void removeLast({ duelId: duel._id }).catch((error) =>
          toast.error(getErrorMessage(error, "Could not remove tile"))
        );
      }
    },
    [locked, checked, placedTileIndices, tap, removeLast, duel._id]
  );

  const confirmDisabled = locked || placedTileIndices.length === 0 || checked;

  const handleConfirm = useCallback(() => {
    if (confirmDisabled) return;
    void confirm({ duelId: duel._id })
      .then((result) => {
        // Color the placed tiles green/red. A correct Confirm also advances the
        // duel to the feedback phase server-side (the subscription re-renders).
        setCorrectnessMask(result.correctnessMask);
      })
      .catch((error) => toast.error(getErrorMessage(error, "Could not check sentence")));
  }, [confirmDisabled, confirm, duel._id]);

  const handleReset = useCallback(() => {
    if (locked || placedTileIndices.length === 0) return;
    setCorrectnessMask(null);
    void reset({ duelId: duel._id }).catch((error) =>
      toast.error(getErrorMessage(error, "Could not reset board"))
    );
  }, [locked, placedTileIndices.length, reset, duel._id]);

  const revealed = served.answerRevealedToViewer === true;
  const spanishSentence =
    revealed && "spanishSentence" in served ? served.spanishSentence : undefined;

  const belowActions = (
    <>
      {!amAnswerer && !showFeedback && (
        <div
          className="mt-4 text-sm"
          style={{ color: colors.text.muted }}
          data-testid="relay-watching"
        >
          {theirName} is building a sentence…
        </div>
      )}

      {showFeedback && spanishSentence && (
        <div
          className="mt-5 w-full max-w-md rounded-xl border-2 p-3 text-center text-sm font-semibold shadow"
          style={{
            borderColor: colors.status.success.dark,
            backgroundColor: colors.status.success.DEFAULT,
            color: "#fff",
          }}
          data-testid="relay-sentence-feedback"
        >
          Correct: {spanishSentence}
        </div>
      )}

      {amAnswerer && showFeedback && (
        <button
          className={footerButtonClass}
          style={{
            backgroundColor: colors.cta.DEFAULT,
            borderBottomColor: colors.cta.dark,
            color: colors.text.DEFAULT,
          }}
          onClick={onAdvance}
          data-testid="relay-continue"
        >
          {isLastWord ? "See Results" : "Continue"}
        </button>
      )}
    </>
  );

  return (
    <SentenceBuildBoard
      roundLabel={`${amAnswerer ? `from ${theirName}` : `to ${theirName}`} · ${index} of ${total}`}
      themeName={themeName}
      englishPrompt={served.englishPrompt}
      tilePool={served.tilePool}
      tileMeanings={served.tileMeanings}
      placedTileIndices={placedTileIndices}
      correctnessMask={correctnessMask}
      secondsLeft={secondsLeft ?? 0}
      showTimer={!showFeedback}
      locked={locked}
      showActions={amAnswerer && !showFeedback}
      confirmDisabled={confirmDisabled}
      onTileClick={handleTileClick}
      onConfirm={handleConfirm}
      onReset={handleReset}
      belowActions={belowActions}
    />
  );
}

function feedbackText(correct: boolean, mine: boolean, correctAnswer: string | null): string {
  const who = mine ? "You" : "They";
  if (correct) return `${who} got it`;
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

// `windowMs` is the per-position answer window (21s for words, 60s for
// sentences) — anchored on `relayAnswerStartedAt`, NOT `questionStartTime`
// (relay never sets that). Mirrors the server's `relayAnswerWindowMs`.
function useRelayCountdown(
  active: boolean,
  startedAt: number | undefined,
  windowMs: number,
  onExpire: () => void
): number | null {
  const [secondsLeft, setSecondsLeft] = useState<number | null>(() =>
    active && startedAt !== undefined
      ? Math.max(0, Math.ceil((startedAt + windowMs - Date.now()) / 1000))
      : null
  );
  const firedRef = useRef(false);

  useEffect(() => {
    if (!active || startedAt === undefined) return;
    const tick = () => {
      const msLeft = startedAt + windowMs - Date.now();
      setSecondsLeft(Math.max(0, Math.ceil(msLeft / 1000)));
      if (msLeft <= 0 && !firedRef.current) {
        firedRef.current = true;
        onExpire();
      }
    };
    const interval = setInterval(tick, TIMER_UPDATE_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [active, startedAt, windowMs, onExpire]);

  return secondsLeft;
}
