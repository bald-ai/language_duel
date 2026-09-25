"use client";

import type { Doc } from "@/convex/_generated/dataModel";
import { useAppearanceColors } from "@/app/components/AppearanceProvider";
import { Scoreboard } from "@/app/game/components/duel/Scoreboard";
import { CountdownControls } from "@/app/game/components/duel/CountdownControls";
import { SpeakerIcon } from "@/app/components/icons";
import { useTTS } from "@/hooks/useTTS";
import { forRole } from "@/lib/duelRole";
import { deriveScoreNames } from "../hooks/duelViewModelHelpers";
import { duelCardBackground } from "./duelViewStyles";
import { getListenButtonStyle } from "@/lib/sentenceGameplay/listenButton";
import type { DuelPlayerSummary } from "../hooks/useDuelSessionViewModel";
import type { CrossKindTransition } from "../hooks/useCrossKindRoundTransition";
import { useDuelCountdownActions } from "../hooks/useDuelCountdownActions";

interface CrossKindTransitionViewProps {
  duel: Doc<"duels">;
  challenger: DuelPlayerSummary | null;
  opponent: DuelPlayerSummary | null;
  viewerRole: "challenger" | "opponent";
  transition: CrossKindTransition;
  secondsLeft: number;
  // Per-player pause/skip for the final reveal only — see
  // `useCrossKindRoundTransition`'s `CrossKindRoundTransition` docs for why the
  // last screen intentionally drops the shared (server-coordinated) handshake.
  localPaused: boolean;
  onLocalPause: () => void;
  onLocalUnpause: () => void;
  onLocalSkip: () => void;
}

/**
 * Static reveal of the prior round, shown when `DuelSession` is about to
 * cross between word and sentence views (or finish on a sentence-last
 * round). Reads the prior round from the viewer-safe duel: past questions
 * always carry `answerRevealedToViewer: true` and the unmasked answer key,
 * so we can render the correct Spanish answer without any extra mutation.
 */
export function CrossKindTransitionView({
  duel,
  challenger,
  opponent,
  viewerRole,
  transition,
  secondsLeft,
  localPaused,
  onLocalPause,
  onLocalUnpause,
  onLocalSkip,
}: CrossKindTransitionViewProps) {
  const colors = useAppearanceColors();
  const countdownActions = useDuelCountdownActions(duel);
  const { isPlaying: isPlayingAudio, playTTS } = useTTS();

  const { myScore, theirScore } = forRole(duel, viewerRole);
  const { myName, theirName } = deriveScoreNames(
    viewerRole === "challenger",
    challenger,
    opponent,
  );
  const priorQuestion = duel.duelQuestions?.[transition.prevIndex];
  const priorItem = duel.sessionItems[duel.itemOrder[transition.prevIndex]];
  const { prompt, correctAnswer } = priorRoundReveal(priorQuestion, priorItem);
  const sentenceAudio = priorSentenceAudio(priorQuestion, priorItem);
  const handlePlaySentenceAudio = () => {
    if (!sentenceAudio) return;
    void playTTS(
      `cross-kind-sentence-${duel._id}-${transition.prevIndex}`,
      sentenceAudio.text,
      {
        storageId: sentenceAudio.storageId,
        themeId: sentenceAudio.themeId,
      },
    );
  };

  return (
    <main
      className="min-h-dvh md:flex md:items-center md:justify-center md:p-6 lg:p-8"
      style={{ color: colors.text.DEFAULT }}
      data-testid="cross-kind-transition"
    >
      <div
        className="w-full md:max-w-md lg:max-w-lg md:rounded-2xl md:border md:shadow-2xl flex flex-col min-h-dvh md:min-h-0 md:h-[85vh] md:max-h-[800px] backdrop-blur-xl"
        style={
          {
            // Eclipse fade: solid top/bottom, see-through middle (see duelCardBackground).
            background: duelCardBackground(colors),
            borderColor: colors.primary.dark,
          } as React.CSSProperties
        }
      >
        <header
          className="flex-shrink-0 flex items-center justify-between p-3 md:p-4 pt-[max(0.75rem,var(--sat))] md:pt-4 border-b"
          style={{ borderColor: `${colors.primary.dark}66` }}
        >
          <Scoreboard
            myName={myName}
            theirName={theirName}
            myScore={myScore}
            theirScore={theirScore}
            livesRemaining={duel.livesRemaining}
          />
        </header>

        <div className="flex-1 flex flex-col items-center justify-center px-4 py-4 overflow-y-auto">
          <div
            className="text-center text-xs uppercase tracking-widest"
            style={{ color: colors.text.muted }}
            data-testid="cross-kind-transition-round"
          >
            Round {transition.prevIndex + 1} of {duel.sessionItems.length}
          </div>

          {/* Prompt and answer share one typographic scale and stack directly
              on top of each other so the learner can line the languages up
              word-for-word. Colour is the only differentiator: default for the
              prompt, success-green for the revealed answer. */}
          <div className="mt-6 w-full flex flex-col items-center gap-3 text-center">
            <h1
              className="text-2xl sm:text-3xl font-bold leading-snug"
              style={{ color: colors.text.DEFAULT }}
              data-testid="cross-kind-transition-prompt"
            >
              {prompt}
            </h1>
            <div
              className="h-px w-16"
              style={{ backgroundColor: `${colors.text.muted}55` }}
              aria-hidden
            />
            <p
              className="text-2xl sm:text-3xl font-bold leading-snug"
              style={{ color: colors.status.success.light }}
              data-testid="cross-kind-transition-answer"
            >
              {correctAnswer ?? ""}
            </p>
            {sentenceAudio && (
              <button
                type="button"
                onClick={handlePlaySentenceAudio}
                disabled={isPlayingAudio}
                className="inline-flex items-center gap-2 rounded-xl border-2 px-5 py-2 text-sm font-bold shadow-lg transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-70"
                style={getListenButtonStyle(colors, isPlayingAudio)}
                data-testid="cross-kind-transition-listen"
              >
                <SpeakerIcon className="h-4 w-4" />
                <span>{isPlayingAudio ? "Playing..." : "Listen"}</span>
              </button>
            )}
          </div>

          <CrossKindCountdown
            duel={duel}
            viewerRole={viewerRole}
            secondsLeft={secondsLeft}
            countdownActions={countdownActions}
            localPaused={localPaused}
            onLocalPause={onLocalPause}
            onLocalUnpause={onLocalUnpause}
            onLocalSkip={onLocalSkip}
          />
        </div>
      </div>
    </main>
  );
}

type PriorQuestion = NonNullable<Doc<"duels">["duelQuestions"]>[number];
type PriorItem = Doc<"duels">["sessionItems"][number];

function priorWordReveal(
  question: Extract<PriorQuestion, { kind: "word" }>,
  item: PriorItem | undefined,
) {
  return {
    prompt: item?.kind === "word" ? item.word : "",
    correctAnswer: question.correctOption ?? null,
  };
}

function priorRoundReveal(
  question: PriorQuestion | undefined,
  item: PriorItem | undefined,
) {
  if (question?.kind === "word") return priorWordReveal(question, item);
  if (question?.kind === "sentence")
    return {
      prompt: question.englishPrompt,
      correctAnswer: question.spanishSentence ?? null,
    };
  return { prompt: "", correctAnswer: null };
}

function priorSentenceAudio(
  question: PriorQuestion | undefined,
  item: PriorItem | undefined,
) {
  if (
    question?.kind !== "sentence" ||
    item?.kind !== "sentence" ||
    !question.spanishSentence ||
    !item.ttsStorageId
  )
    return null;
  return {
    text: question.spanishSentence,
    storageId: item.ttsStorageId,
    themeId: String(item.themeId),
  };
}

function CrossKindCountdown({
  duel,
  viewerRole,
  secondsLeft,
  countdownActions,
  localPaused,
  onLocalPause,
  onLocalUnpause,
  onLocalSkip,
}: Pick<
  CrossKindTransitionViewProps,
  | "duel"
  | "viewerRole"
  | "secondsLeft"
  | "localPaused"
  | "onLocalPause"
  | "onLocalUnpause"
  | "onLocalSkip"
> & { countdownActions: ReturnType<typeof useDuelCountdownActions> }) {
  return (
    <>
      {duel.status !== "completed" && (
        <div className="mt-6">
          <CountdownControls
            countdown={secondsLeft}
            countdownPausedBy={duel.countdownPausedBy}
            countdownUnpauseRequestedBy={duel.countdownUnpauseRequestedBy}
            userRole={viewerRole}
            countdownSkipRequestedBy={duel.countdownSkipRequestedBy ?? []}
            onPause={countdownActions.pauseCountdown}
            onRequestUnpause={countdownActions.requestUnpauseForControls}
            onConfirmUnpause={countdownActions.confirmUnpauseCountdown}
            onSkip={countdownActions.skipCountdown}
            dataTestIdBase="cross-kind-transition"
          />
        </div>
      )}
      {duel.status === "completed" && (
        <div className="mt-6">
          {/*
                Final reveal: the duel is already decided, so these controls are
                PER-PLAYER, not the shared/coordinated pause used between live
                rounds. We reuse CountdownControls for visual consistency by
                mapping the local hold onto its paused state — `countdownPausedBy`
                is faked to the viewer's own role (never the real server field)
                and `countdownUnpauseRequestedBy` stays undefined so it renders
                the plain Pause <-> Unpause toggle with no opponent handshake.
                Skip is single-click (empty `countdownSkipRequestedBy`) and only
                collapses this player's countdown. See `useCrossKindRoundTransition`.
              */}
          <CountdownControls
            countdown={secondsLeft}
            countdownPausedBy={localPaused ? viewerRole : undefined}
            countdownUnpauseRequestedBy={undefined}
            userRole={viewerRole}
            countdownSkipRequestedBy={[]}
            countdownLabel="Results"
            onPause={onLocalPause}
            onRequestUnpause={onLocalUnpause}
            onConfirmUnpause={onLocalUnpause}
            onSkip={onLocalSkip}
            dataTestIdBase="cross-kind-transition-final"
          />
        </div>
      )}
    </>
  );
}
