"use client";

import { useCallback, type ReactNode } from "react";
import { useMutation } from "convex/react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";
import { useAppearanceColors } from "@/app/components/AppearanceProvider";
import { Scoreboard } from "@/app/game/components/duel/Scoreboard";
import { formatVisibleUser } from "@/lib/userDisplay";
import { getErrorMessage } from "@/lib/errors";
import { TBT_BOARD_ROLE, otherRole } from "@/lib/duel/tbtEngine";
import { useTbtQuestionClock } from "../hooks/useTbtQuestionClock";
import { buildDuelViewStyles } from "./duelViewStyles";
import { SentenceBuildBoard } from "./SentenceBuildBoard";
import {
  isSentenceQuestion,
  type ViewerSafeDuelQuestion,
  type ViewerSafeSentenceQuestion,
} from "../hooks/duelSessionTypes";
import type { DuelPlayerSummary } from "../hooks/useDuelSessionViewModel";

interface TurnByTurnViewProps {
  duel: Doc<"duels">;
  viewerRole: "challenger" | "opponent";
  challenger: DuelPlayerSummary | null;
  opponent: DuelPlayerSummary | null;
}

/**
 * PvE turn-by-turn (TbT) board. Both players share ONE sentence board and
 * alternate turns placing the next tile; finishing a sentence banks a shared
 * point for both. Cooperative — no winner. The board, validation and progress
 * reuse the existing sentence machinery (`SentenceBuildBoard`,
 * `api.tbtDuel.tbtTap`, the shared `sentenceProgress` row); this view only adds
 * the turn indicator, the shared-score readout, and the shared sentence clock.
 *
 * The between-sentence reveal (the shared 5s countdown + pause/skip) is NOT
 * here — it's the same `CrossKindTransitionView` every other sentence duel
 * uses, wired up one level up in `DuelSession`'s `TbtSession`.
 */
export function TurnByTurnView({
  duel,
  viewerRole,
  challenger,
  opponent,
}: TurnByTurnViewProps) {
  const colors = useAppearanceColors();
  const styles = buildDuelViewStyles(colors);
  const router = useRouter();
  const tap = useMutation(api.tbtDuel.tbtTap);
  const stopDuel = useMutation(api.duels.stopDuel);

  const isCompleted = duel.status === "completed";
  const questionIndex = duel.currentItemIndex;
  const question = duel.duelQuestions?.[questionIndex] as
    | ViewerSafeDuelQuestion
    | undefined;

  const currentTurn = duel.tbtTurn;

  // Both scores move in lockstep (a finished sentence is +1 to each), so either
  // one is "sentences the pair built together".
  const built = duel.challengerScore;

  const participants = { challenger, opponent };
  const myName = formatVisibleUser(participants[viewerRole], "You");
  const partnerName = formatVisibleUser(
    participants[otherRole(viewerRole)],
    "Your partner",
  );
  const secondsLeft = useTbtQuestionClock(duel);

  const handleTap = useCallback(
    (tileIndex: number) => {
      tap({ duelId: duel._id, tileIndex }).catch((error) =>
        toast.error(getErrorMessage(error, "Could not place tile")),
      );
    },
    [tap, duel._id],
  );

  const handleExit = useCallback(() => {
    void stopDuel({ duelId: duel._id })
      .then(() => router.push("/"))
      .catch((error) =>
        toast.error(getErrorMessage(error, "Could not exit duel")),
      );
  }, [duel._id, router, stopDuel]);

  // Shared chrome — scoreboard + Exit, matching `SentenceRoundView`. Both score
  // slots show the same shared total (cooperative — no winner).
  const renderShell = (body: ReactNode) => (
    <main
      className="min-h-dvh md:flex md:items-center md:justify-center md:p-6 lg:p-8"
      style={{ color: colors.text.DEFAULT }}
    >
      <div
        className="w-full md:max-w-md lg:max-w-lg md:rounded-2xl md:border md:shadow-2xl flex flex-col min-h-dvh md:min-h-0 md:h-[85vh] md:max-h-[800px] backdrop-blur-xl"
        style={styles.gameContainer}
      >
        <header
          className="flex-shrink-0 flex items-center justify-between p-3 md:p-4 pt-[max(0.75rem,var(--sat))] md:pt-4 border-b"
          style={styles.subtleBorder}
        >
          <Scoreboard
            myName={myName}
            theirName={partnerName}
            myScore={built}
            theirScore={built}
            livesRemaining={duel.livesRemaining}
          />
          {!isCompleted && (
            <button
              onClick={handleExit}
              className="font-bold py-2 px-5 rounded-lg text-base flex-shrink-0 transition hover:brightness-110"
              style={styles.exitButton}
              data-testid="tbt-exit"
            >
              Exit Duel
            </button>
          )}
        </header>
        {body}
      </div>
    </main>
  );

  if (isCompleted) {
    return renderShell(
      <div
        className="flex-1 flex flex-col items-center justify-center px-4 py-8 text-center"
        style={{ gap: 16, color: colors.text.DEFAULT }}
      >
        <div style={{ fontSize: 56 }}>🎉</div>
        <h2 style={{ fontSize: 24, fontWeight: 700 }}>Nice teamwork!</h2>
        <p style={{ color: colors.text.muted }}>
          You built {built} sentence{built === 1 ? "" : "s"} together.
        </p>
        <button
          type="button"
          onClick={() => router.push("/")}
          style={{
            marginTop: 8,
            padding: "10px 24px",
            borderRadius: 9999,
            border: "none",
            cursor: "pointer",
            fontWeight: 600,
            backgroundColor: colors.primary.DEFAULT,
            color: colors.background.DEFAULT,
          }}
        >
          Back to Home
        </button>
      </div>,
    );
  }

  if (!question || !isSentenceQuestion(question)) {
    return renderShell(
      <div
        className="flex-1 flex items-center justify-center"
        style={{ color: colors.text.muted }}
      >
        Loading…
      </div>,
    );
  }

  if (!currentTurn) {
    return renderShell(
      <div
        className="flex-1 flex items-center justify-center px-4 text-center"
        style={{ color: colors.text.muted }}
        data-testid="tbt-state-error"
      >
        Tag Team duel is missing turn data.
      </div>,
    );
  }

  return renderShell(
    <TbtSentenceBoard
      duel={duel}
      question={question}
      viewerRole={viewerRole}
      partnerName={partnerName}
      secondsLeft={secondsLeft}
      onTap={handleTap}
    />,
  );
}

function TbtSentenceBoard({
  duel,
  question,
  viewerRole,
  partnerName,
  secondsLeft,
  onTap,
}: {
  duel: Doc<"duels">;
  question: ViewerSafeSentenceQuestion;
  viewerRole: TurnByTurnViewProps["viewerRole"];
  partnerName: string;
  secondsLeft: number;
  onTap: (tileIndex: number) => void;
}) {
  const questionIndex = duel.currentItemIndex;
  const total = duel.duelQuestions?.length ?? 0;
  const myTurn = duel.tbtTurn === viewerRole;
  const { placedTileIndices, correctnessMask } = sharedBoardProgress(duel);

  // The sentence question carries no theme label — it lives on the matching
  // session item. Read its typed display label.
  const sessionItem = duel.sessionItems[
    duel.itemOrder[questionIndex]
  ];
  const themeName = sessionItem?.themeName ?? "";

  return (
    <SentenceBuildBoard
      roundLabel={`Sentence ${questionIndex + 1} of ${total}`}
      themeName={themeName}
      englishPrompt={question.englishPrompt}
      tilePool={question.tilePool}
      tileMeanings={question.tileMeanings}
      placedTileIndices={placedTileIndices}
      correctnessMask={correctnessMask}
      lastWrongTileIndex={duel.tbtLastWrongTileIndex ?? null}
      secondsLeft={secondsLeft}
      showTimer
      locked={!myTurn}
      showActions={false}
      confirmDisabled
      onTileClick={onTap}
      onConfirm={() => {}}
      onReset={() => {}}
      belowActions={
        <TbtTurnBanner
          myTurn={myTurn}
          partnerName={partnerName}
          built={duel.challengerScore}
          total={total}
        />
      }
    />
  );
}

function TbtTurnBanner({
  myTurn,
  partnerName,
  built,
  total,
}: {
  myTurn: boolean;
  partnerName: string;
  built: number;
  total: number;
}) {
  const colors = useAppearanceColors();
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 4,
        marginTop: 12,
        textAlign: "center",
      }}
    >
      <div
        style={{
          fontWeight: 700,
          color: myTurn ? colors.primary.DEFAULT : colors.text.muted,
        }}
      >
        {myTurn ? "Your turn — place the next tile" : `${partnerName}'s turn…`}
      </div>
      <div style={{ fontSize: 13, color: colors.text.muted }}>
        Built together: {built}
        {total ? ` of ${total}` : ""}
      </div>
    </div>
  );
}

function sharedBoardProgress(duel: Doc<"duels">) {
  const questionIndex = duel.currentItemIndex;
  const sharedRow = (duel.sentenceProgress ?? []).find(
    (row) => row.questionIndex === questionIndex && row.role === TBT_BOARD_ROLE,
  );
  const placedTileIndices = sharedRow?.placedTileIndices ?? [];

  // Every placed tile is correct by construction: a wrong tap places nothing
  // and just passes the turn. So mark them all correct and let the board paint
  // them green (this also drops the PvP "peel back" red highlight on the last
  // tile, which has no meaning here).
  const correctnessMask = placedTileIndices.map(() => true);

  return { placedTileIndices, correctnessMask };
}
