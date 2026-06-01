"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useMutation } from "convex/react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";
import { useAppearanceColors } from "@/app/components/AppearanceProvider";
import { Scoreboard } from "@/app/game/components/duel/Scoreboard";
import { formatVisibleUser } from "@/lib/userDisplay";
import { getErrorMessage } from "@/lib/errors";
import { TBT_BOARD_ROLE } from "@/lib/duel/tbtEngine";
import {
  TBT_QUESTION_TIMEOUT_MS,
  TBT_QUESTION_TIMEOUT_SECONDS,
} from "@/lib/duelConstants";
import {
  clampTimerSeconds,
  getEffectiveQuestionStartTime,
} from "@/lib/duelTiming";
import { buildDuelViewStyles } from "./duelViewStyles";
import { SentenceBuildBoard } from "./SentenceBuildBoard";
import {
  isSentenceQuestion,
  type ViewerSafeDuelQuestion,
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
  const questionTimeout = useMutation(api.tbtDuel.tbtQuestionTimeout);
  const stopDuel = useMutation(api.duels.stopDuel);

  const isCompleted = duel.status === "completed";
  const questionIndex = duel.currentWordIndex;
  const total = duel.duelQuestions?.length ?? 0;
  const question = duel.duelQuestions?.[questionIndex] as
    | ViewerSafeDuelQuestion
    | undefined;

  const currentTurn = duel.tbtTurn;
  const myTurn = !isCompleted && currentTurn === viewerRole;

  // Both scores move in lockstep (a finished sentence is +1 to each), so either
  // one is "sentences the pair built together".
  const built = duel.challengerScore;

  const isChallenger = viewerRole === "challenger";
  const myName = formatVisibleUser(isChallenger ? challenger : opponent, "You");
  const partnerName = formatVisibleUser(
    isChallenger ? opponent : challenger,
    "Your partner"
  );

  // One shared clock for the WHOLE sentence (not per turn), anchored on
  // `questionStartTime` — the same timing the word/sentence duels use, so the
  // pause/transition handling comes for free. When it hits zero we nudge the
  // server via `tbtQuestionTimeout` (idempotent + self-verifying; either client
  // can drive it). Re-keyed by `questionIndex` so it fires once per sentence.
  const questionStartTime = duel.questionStartTime;
  const [secondsLeft, setSecondsLeft] = useState(TBT_QUESTION_TIMEOUT_SECONDS);
  const firedForRef = useRef<number | null>(null);

  useEffect(() => {
    if (isCompleted || questionStartTime === undefined) return;
    const tick = () => {
      const effectiveStart = getEffectiveQuestionStartTime(
        questionStartTime,
        questionIndex
      );
      const remainingMs = effectiveStart + TBT_QUESTION_TIMEOUT_MS - Date.now();
      setSecondsLeft(
        clampTimerSeconds(Math.ceil(remainingMs / 1000), TBT_QUESTION_TIMEOUT_SECONDS)
      );
      if (remainingMs <= 0 && firedForRef.current !== questionIndex) {
        firedForRef.current = questionIndex;
        questionTimeout({ duelId: duel._id, questionIndex }).catch(() => {
          // Best-effort; retry on the next sentence (the peer client can also
          // drive it, and the server self-verifies the window).
          firedForRef.current = null;
        });
      }
    };
    tick();
    const id = window.setInterval(tick, 250);
    return () => window.clearInterval(id);
  }, [questionStartTime, questionIndex, isCompleted, duel._id, questionTimeout]);

  const handleTap = useCallback(
    (tileIndex: number) => {
      tap({ duelId: duel._id, tileIndex }).catch((error) =>
        toast.error(getErrorMessage(error, "Could not place tile"))
      );
    },
    [tap, duel._id]
  );

  const handleExit = useCallback(() => {
    void stopDuel({ duelId: duel._id })
      .then(() => router.push("/"))
      .catch((error) => toast.error(getErrorMessage(error, "Could not exit duel")));
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
      </div>
    );
  }

  if (!question || !isSentenceQuestion(question)) {
    return renderShell(
      <div
        className="flex-1 flex items-center justify-center"
        style={{ color: colors.text.muted }}
      >
        Loading…
      </div>
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
      </div>
    );
  }

  const sharedRow = (duel.sentenceProgress ?? []).find(
    (row) => row.questionIndex === questionIndex && row.role === TBT_BOARD_ROLE
  );
  const placedTileIndices = sharedRow?.placedTileIndices ?? [];

  // Every placed tile is correct by construction: a wrong tap places nothing
  // and just passes the turn. So mark them all correct and let the board paint
  // them green (this also drops the PvP "peel back" red highlight on the last
  // tile, which has no meaning here).
  const correctnessMask = placedTileIndices.map(() => true);

  // The sentence question carries no theme label — it lives on the matching
  // session item. Read it defensively (we only need the optional display label).
  const sessionItem = duel.sessionWords[duel.wordOrder[questionIndex]] as unknown as
    | { themeName?: string }
    | undefined;
  const themeName = sessionItem?.themeName ?? "";

  const turnBanner = (
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
        {myTurn
          ? "Your turn — place the next tile"
          : `${partnerName}'s turn…`}
      </div>
      <div style={{ fontSize: 13, color: colors.text.muted }}>
        Built together: {built}
        {total ? ` of ${total}` : ""}
      </div>
    </div>
  );

  return renderShell(
    <SentenceBuildBoard
      roundLabel={`Sentence ${questionIndex + 1} of ${total}`}
      themeName={themeName}
      englishPrompt={question.englishPrompt}
      tilePool={question.tilePool}
      placedTileIndices={placedTileIndices}
      correctnessMask={correctnessMask}
      lastWrongTileIndex={duel.tbtLastWrongTileIndex ?? null}
      secondsLeft={secondsLeft}
      showTimer
      locked={!myTurn}
      showActions={false}
      confirmDisabled
      onTileClick={handleTap}
      onConfirm={() => {}}
      onReset={() => {}}
      belowActions={turnBanner}
    />
  );
}
