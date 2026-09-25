"use client";

import {
  useCallback,
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
import { formatVisibleUser } from "@/lib/userDisplay";
import { getErrorMessage } from "@/lib/errors";
import type { DuelPlayerSummary } from "../hooks/useDuelSessionViewModel";
import type { RelaySafeDuel } from "../hooks/relaySessionTypes";

import { RelaySentenceAnswer } from "./RelaySentenceAnswer";
import { buildRelayStyles } from "./relayStyles";
import { RelayAnswerArea } from "./RelayAnswerArea";

interface RelayDuelViewProps {
  duel: RelaySafeDuel;
  viewerRole: "challenger" | "opponent";
  challenger: DuelPlayerSummary | null;
  opponent: DuelPlayerSummary | null;
}

type Colors = ReturnType<typeof useAppearanceColors>;

export function RelayDuelView({
  duel,
  viewerRole,
  challenger,
  opponent,
}: RelayDuelViewProps) {
  const colors = useAppearanceColors();
  const router = useRouter();

  const pick = useMutation(api.relayDuel.relayPick);
  const answer = useMutation(api.relayDuel.relayAnswer);
  const advance = useMutation(api.relayDuel.relayAdvance);
  const timeout = useMutation(api.relayDuel.relayTimeout);
  const stopDuel = useMutation(api.duels.stopDuel);

  const finished = duel.status === "completed";

  const isChallenger = viewerRole === "challenger";
  const myScore = isChallenger ? duel.challengerScore : duel.opponentScore;
  const theirScore = isChallenger ? duel.opponentScore : duel.challengerScore;
  const myName = formatVisibleUser(isChallenger ? challenger : opponent, "You");
  const theirName = formatVisibleUser(
    isChallenger ? opponent : challenger,
    "Opponent",
  );

  const handleTimeout = useCallback(() => {
    // The server scheduler is the backstop; ignore client-side races here.
    void timeout({ duelId: duel._id }).catch(() => {});
  }, [timeout, duel._id]);

  const handlePick = (position: number, hardUpgrade: boolean) => {
    void pick({ duelId: duel._id, position, hardUpgrade }).catch((error) =>
      toast.error(getErrorMessage(error, "Could not hand over the round")),
    );
  };

  const handleAnswer = (value: string) => {
    void answer({ duelId: duel._id, value }).catch((error) =>
      toast.error(getErrorMessage(error, "Could not submit answer")),
    );
  };

  const handleAdvance = () => {
    void advance({ duelId: duel._id }).catch((error) =>
      toast.error(getErrorMessage(error, "Could not continue")),
    );
  };

  const handleExit = () => {
    void stopDuel({ duelId: duel._id })
      .then(() => router.push("/"))
      .catch((error) =>
        toast.error(getErrorMessage(error, "Could not exit duel")),
      );
  };

  const styles = buildRelayStyles(colors);

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
          <Scoreboard
            myName={myName}
            theirName={theirName}
            myScore={myScore}
            theirScore={theirScore}
          />
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
          ) : (
            <RelayActiveRound
              duel={duel}
              viewerRole={viewerRole}
              theirName={theirName}
              colors={colors}
              onPick={handlePick}
              onAnswer={handleAnswer}
              onAdvance={handleAdvance}
              onTimeout={handleTimeout}
            />
          )}
        </div>
      </div>
    </main>
  );
}

function RelayWordHeader({
  prompt,
  index,
  total,
  amAnswerer,
  theirName,
  colors,
}: {
  prompt: string;
  index: number;
  total: number;
  amAnswerer: boolean;
  theirName: string;
  colors: Colors;
}) {
  return (
    <div className="text-center mb-4">
      <div className="text-sm mb-2" style={{ color: colors.text.muted }}>
        Round {index} of {total}
      </div>
      <div
        className="text-xs uppercase tracking-[0.25em] mb-2"
        style={{ color: colors.text.muted }}
      >
        {amAnswerer ? `from ${theirName}` : `to ${theirName}`}
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
function RelayPickList({
  remaining,
  promptAt,
  isSentenceAt,
  theirName,
  budget,
  onPick,
  colors,
}: RelayPickListProps) {
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
          Hand the next round to {theirName} · {remaining.length} left
        </div>
        <span
          className="rounded-full px-3 py-1 text-xs font-bold"
          style={{
            backgroundColor: `${colors.cta.DEFAULT}22`,
            color: colors.cta.dark,
          }}
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
          const rowStyle = getRelayPickRowStyle(colors, isPicking, isHard);
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
                <RelayHardToggle
                  colors={colors}
                  budget={budget}
                  isHard={isHard}
                  pickInFlight={pickInFlight}
                  position={position}
                  onToggle={() =>
                    setHardPosition((current) =>
                      current === position ? null : position,
                    )
                  }
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Waiting({
  children,
  colors,
}: {
  children: ReactNode;
  colors: Colors;
}) {
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

type RelayActiveRoundProps = Pick<RelayDuelViewProps, "duel" | "viewerRole"> & {
  theirName: string;
  colors: Colors;
  onPick: (position: number, hardUpgrade: boolean) => void;
  onAnswer: (value: string) => void;
  onAdvance: () => void;
  onTimeout: () => void;
};
function getRelayItemLookup(duel: RelaySafeDuel) {
  // Each position renders its own answer surface based on its kind: word → MC
  // grid, sentence → tile board. The prompt is the word itself or the sentence's
  // English prompt.
  const itemAt = (position: number) =>
    duel.sessionItems[duel.itemOrder[position]];
  const promptAt = (position: number) => {
    const item = itemAt(position);
    if (!item) return "";
    return item.kind === "sentence" ? item.englishPrompt : item.word;
  };
  const isSentenceAt = (position: number) =>
    itemAt(position)?.kind === "sentence";
  const themeAt = (position: number) => itemAt(position)?.themeName ?? "";

  return { promptAt, isSentenceAt, themeAt };
}
function RelayActiveRound(props: RelayActiveRoundProps) {
  const { duel, viewerRole } = props;
  const phase = duel.relayPhase ?? "pick";
  const picker = duel.relayPicker ?? "challenger";
  const answerer = picker === "challenger" ? "opponent" : "challenger";
  if (phase === "pick")
    return <RelayPickingRound {...props} amPicker={viewerRole === picker} />;
  return (
    <RelayAssignedRound
      {...props}
      answerer={answerer}
      amAnswerer={viewerRole === answerer}
      showFeedback={phase === "feedback"}
    />
  );
}
function RelayPickingRound({
  duel,
  viewerRole,
  theirName,
  colors,
  onPick,
  amPicker,
}: RelayActiveRoundProps & { amPicker: boolean }) {
  const { promptAt, isSentenceAt } = getRelayItemLookup(duel);
  const budget = duel.relayHardBudget?.[viewerRole] ?? 0;
  const remaining = duel.relayRemainingPositions ?? [];
  if (!amPicker)
    return (
      <Waiting colors={colors}>
        Waiting for {theirName} to pick the next round…
      </Waiting>
    );
  return (
    <RelayPickList
      remaining={remaining}
      promptAt={promptAt}
      isSentenceAt={isSentenceAt}
      theirName={theirName}
      budget={budget}
      onPick={onPick}
      colors={colors}
    />
  );
}
function getAssignedRelayItem(duel: RelaySafeDuel) {
  const { promptAt, themeAt } = getRelayItemLookup(duel);
  if (duel.relayAssignedIndex === undefined)
    return { prompt: "", themeName: "" };
  return {
    prompt: promptAt(duel.relayAssignedIndex),
    themeName: themeAt(duel.relayAssignedIndex),
  };
}
function RelayAssignedRound({
  duel,
  theirName,
  colors,
  onAnswer,
  onAdvance,
  onTimeout,
  answerer,
  amAnswerer,
  showFeedback,
}: RelayActiveRoundProps & {
  answerer: "challenger" | "opponent";
  amAnswerer: boolean;
  showFeedback: boolean;
}) {
  const served = duel.relayServedQuestion;
  const total = duel.itemOrder.length;
  const resolvedCount = duel.relayResolvedIndices?.length ?? 0;
  const { prompt, themeName } = getAssignedRelayItem(duel);
  const active = !showFeedback && duel.status === "active";
  if (served?.kind === "sentence")
    return (
      <RelaySentenceAnswer
        key={duel.relayAssignedIndex}
        duel={duel}
        served={served}
        answerer={answerer}
        amAnswerer={amAnswerer}
        showFeedback={showFeedback}
        active={active}
        startedAt={duel.relayAnswerStartedAt}
        onTimeout={onTimeout}
        onAdvance={onAdvance}
        isLastItem={resolvedCount + 1 >= total}
        index={resolvedCount + 1}
        total={total}
        themeName={themeName}
        theirName={theirName}
        colors={colors}
      />
    );
  return (
    <>
      <RelayWordHeader
        prompt={prompt}
        index={resolvedCount + 1}
        total={total}
        amAnswerer={amAnswerer}
        theirName={theirName}
        colors={colors}
      />
      <RelayAnswerArea
        key={duel.relayAssignedIndex}
        served={served}
        amAnswerer={amAnswerer}
        showFeedback={showFeedback}
        active={active}
        startedAt={duel.relayAnswerStartedAt}
        onTimeout={onTimeout}
        lastResult={duel.relayLastResult ?? null}
        theirName={theirName}
        isLastItem={resolvedCount + 1 >= total}
        onAnswer={onAnswer}
        onAdvance={onAdvance}
        colors={colors}
      />
    </>
  );
}

function getRelayPickRowStyle(
  colors: Colors,
  isPicking: boolean,
  isHard: boolean,
): CSSProperties {
  return isPicking
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
}
function RelayHardToggle({
  colors,
  budget,
  isHard,
  pickInFlight,
  position,
  onToggle,
}: {
  colors: Colors;
  budget: number;
  isHard: boolean;
  pickInFlight: boolean;
  position: number;
  onToggle: () => void;
}) {
  const toggleDisabled = (budget <= 0 && !isHard) || pickInFlight;
  return (
    <button
      type="button"
      onClick={onToggle}
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
  );
}
