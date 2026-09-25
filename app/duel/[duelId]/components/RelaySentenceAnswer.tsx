"use client";

import { useCallback, useMemo, useState } from "react";
import { useMutation } from "convex/react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import { useAppearanceColors } from "@/app/components/AppearanceProvider";
import { SpeakerIcon } from "@/app/components/icons";
import { useTTS } from "@/hooks/useTTS";
import { getListenButtonStyle } from "@/lib/sentenceGameplay/listenButton";
import { SENTENCE_RELAY_TIMEOUT_MS } from "@/lib/themes/sentenceConstants";
import { getErrorMessage } from "@/lib/errors";
import { SentenceBuildBoard } from "./SentenceBuildBoard";
import { relayFooterButtonClass } from "./relayStyles";
import { useRelayCountdown } from "../hooks/useRelayCountdown";
import type {
  RelaySafeDuel,
  RelayServedQuestion,
} from "../hooks/relaySessionTypes";
type Colors = ReturnType<typeof useAppearanceColors>;

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
  isLastItem: boolean;
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
export function RelaySentenceAnswer({
  duel,
  served,
  answerer,
  amAnswerer,
  showFeedback,
  active,
  startedAt,
  onTimeout,
  onAdvance,
  isLastItem,
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
  const [correctnessMask, setCorrectnessMask] = useState<boolean[] | null>(
    null,
  );
  const checked = correctnessMask !== null;

  const assignedIndex = duel.relayAssignedIndex;
  const secondsLeft = useRelayCountdown(
    active,
    startedAt,
    SENTENCE_RELAY_TIMEOUT_MS,
    onTimeout,
  );

  // Both players read the ANSWERER's progress row, so the picker mirrors the
  // answerer's placed tiles in real time.
  const placedTileIndices = useMemo(() => {
    const entry = (duel.sentenceProgress ?? []).find(
      (row) => row.questionIndex === assignedIndex && row.role === answerer,
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
          toast.error(getErrorMessage(error, "Could not place tile")),
        );
        return;
      }
      if (order === placedTileIndices.length - 1) {
        void removeLast({ duelId: duel._id }).catch((error) =>
          toast.error(getErrorMessage(error, "Could not remove tile")),
        );
      }
    },
    [locked, checked, placedTileIndices, tap, removeLast, duel._id],
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
      .catch((error) =>
        toast.error(getErrorMessage(error, "Could not check sentence")),
      );
  }, [confirmDisabled, confirm, duel._id]);

  const handleReset = useCallback(() => {
    if (locked || placedTileIndices.length === 0) return;
    setCorrectnessMask(null);
    void reset({ duelId: duel._id }).catch((error) =>
      toast.error(getErrorMessage(error, "Could not reset board")),
    );
  }, [locked, placedTileIndices.length, reset, duel._id]);

  return (
    <SentenceBuildBoard
      roundLabel={`${amAnswerer ? `from ${theirName}` : `to ${theirName}`} · Round ${index} of ${total}`}
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
      belowActions={
        <RelaySentenceFooter
          duel={duel}
          served={served}
          amAnswerer={amAnswerer}
          showFeedback={showFeedback}
          theirName={theirName}
          colors={colors}
          onAdvance={onAdvance}
          isLastItem={isLastItem}
        />
      }
    />
  );
}

type FooterProps = Pick<
  RelaySentenceAnswerProps,
  | "duel"
  | "served"
  | "amAnswerer"
  | "showFeedback"
  | "theirName"
  | "colors"
  | "onAdvance"
  | "isLastItem"
>;
function RelaySentenceFooter({
  duel,
  served,
  amAnswerer,
  showFeedback,
  theirName,
  colors,
  onAdvance,
  isLastItem,
}: FooterProps) {
  const revealed = served.answerRevealedToViewer === true;
  const spanishSentence =
    revealed && "spanishSentence" in served
      ? served.spanishSentence
      : undefined;
  return (
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

      <RelaySentenceAudio
        duel={duel}
        spanishSentence={spanishSentence}
        showFeedback={showFeedback}
        colors={colors}
      />
      <RelaySentenceContinue
        amAnswerer={amAnswerer}
        showFeedback={showFeedback}
        onAdvance={onAdvance}
        isLastItem={isLastItem}
        colors={colors}
      />
    </>
  );
}

function getAssignedSentenceItem(duel: RelaySafeDuel) {
  const assignedIndex = duel.relayAssignedIndex;
  const assignedItem =
    assignedIndex === undefined
      ? undefined
      : duel.sessionItems[duel.itemOrder[assignedIndex]];
  const sentenceItem =
    assignedItem?.kind === "sentence" ? assignedItem : undefined;
  return sentenceItem;
}

function RelaySentenceAudio({
  duel,
  spanishSentence,
  showFeedback,
  colors,
}: Pick<FooterProps, "duel" | "showFeedback" | "colors"> & {
  spanishSentence: string | undefined;
}) {
  const assignedIndex = duel.relayAssignedIndex;
  const sentenceItem = getAssignedSentenceItem(duel);
  const { isPlaying: isPlayingAudio, playTTS } = useTTS();
  const canPlaySentenceAudio =
    !!spanishSentence && !!sentenceItem?.ttsStorageId;
  const handlePlaySentenceAudio = useCallback(() => {
    if (!spanishSentence || !sentenceItem?.ttsStorageId) return;
    void playTTS(
      `relay-sentence-${duel._id}-${assignedIndex ?? "none"}`,
      spanishSentence,
      {
        storageId: sentenceItem.ttsStorageId,
        themeId: String(sentenceItem.themeId),
      },
    );
  }, [assignedIndex, duel._id, playTTS, sentenceItem, spanishSentence]);

  return (
    <>
      {showFeedback && canPlaySentenceAudio && (
        <button
          type="button"
          onClick={handlePlaySentenceAudio}
          disabled={isPlayingAudio}
          className="mt-3 inline-flex items-center gap-2 rounded-xl border-2 px-5 py-2 text-sm font-bold shadow-lg transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-70"
          style={getListenButtonStyle(colors, isPlayingAudio)}
          data-testid="relay-sentence-listen"
        >
          <SpeakerIcon className="h-4 w-4" />
          <span>{isPlayingAudio ? "Playing..." : "Listen"}</span>
        </button>
      )}
    </>
  );
}
function RelaySentenceContinue({
  amAnswerer,
  showFeedback,
  onAdvance,
  isLastItem,
  colors,
}: Pick<
  FooterProps,
  "amAnswerer" | "showFeedback" | "onAdvance" | "isLastItem" | "colors"
>) {
  return (
    <>
      {amAnswerer && showFeedback && (
        <button
          className={relayFooterButtonClass}
          style={{
            backgroundColor: colors.cta.DEFAULT,
            borderBottomColor: colors.cta.dark,
            color: colors.text.DEFAULT,
          }}
          onClick={onAdvance}
          data-testid="relay-continue"
        >
          {isLastItem ? "See Results" : "Continue"}
        </button>
      )}{" "}
    </>
  );
}
