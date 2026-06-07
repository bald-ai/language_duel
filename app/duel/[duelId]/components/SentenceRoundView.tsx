"use client";

import { useCallback } from "react";
import { useMutation } from "convex/react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";
import { useAppearanceColors } from "@/app/components/AppearanceProvider";
import { Scoreboard } from "@/app/game/components/duel/Scoreboard";
import { formatVisibleUser } from "@/lib/userDisplay";
import { getErrorMessage } from "@/lib/errors";
import { buildDuelViewStyles } from "./duelViewStyles";
import { SentenceBoard } from "./SentenceBoard";
import type { ViewerSafeSentenceSessionItem } from "../hooks/duelSessionTypes";
import type { DuelPlayerSummary } from "../hooks/useDuelSessionViewModel";

interface SentenceRoundViewProps {
  duel: Doc<"duels">;
  challenger: DuelPlayerSummary | null;
  opponent: DuelPlayerSummary | null;
  viewerRole: "challenger" | "opponent";
  sessionItem: ViewerSafeSentenceSessionItem;
  /**
   * Server-shipped sentence question for the current position. Tile pool is
   * pre-shuffled. The `spanishSentence` answer key is masked during active
   * play and only present in the post-round reveal (`answerRevealedToViewer`).
   */
  question: {
    kind: "sentence";
    englishPrompt: string;
    tilePool: string[];
    tileMeanings?: Array<string | null>;
    spanishSentence?: string;
    answerRevealedToViewer?: boolean;
  };
}

/**
 * Per-player sentence round surface. Unified build-and-confirm for every mode
 * (PvE / PvP / self-duel): each player builds their own copy of the sentence,
 * peels the last tile, and verifies the whole sentence on Confirm; the result is
 * submitted via `answerSentenceRound` and the server advances once both players
 * submit (mirrors word rounds).
 *
 * Tools differ by mode exactly like word rounds — PvE gets the cooperative hint
 * pool, PvP gets sabotages — mounted in the board footer (see `SentenceBoard`).
 * The per-round board state resets via `key={duel.currentItemIndex}` on advance.
 */
export function SentenceRoundView({
  duel,
  challenger,
  opponent,
  viewerRole,
  sessionItem,
  question,
}: SentenceRoundViewProps) {
  const colors = useAppearanceColors();
  const styles = buildDuelViewStyles(colors);
  const router = useRouter();
  const stopDuel = useMutation(api.duels.stopDuel);

  const isChallenger = viewerRole === "challenger";
  const myScore = isChallenger ? duel.challengerScore : duel.opponentScore;
  const theirScore = isChallenger ? duel.opponentScore : duel.challengerScore;
  const myName = formatVisibleUser(isChallenger ? challenger : opponent, "You");
  const theirName = formatVisibleUser(isChallenger ? opponent : challenger, "Opponent");

  const handleExit = useCallback(() => {
    void stopDuel({ duelId: duel._id })
      .then(() => router.push("/"))
      .catch((error) => toast.error(getErrorMessage(error, "Could not exit duel")));
  }, [duel._id, router, stopDuel]);

  return (
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
            theirName={theirName}
            myScore={myScore}
            theirScore={theirScore}
            livesRemaining={duel.livesRemaining}
          />
          {duel.status !== "completed" && (
            <button
              onClick={handleExit}
              className="font-bold py-2 px-5 rounded-lg text-base flex-shrink-0 transition hover:brightness-110"
              style={styles.exitButton}
              data-testid="sentence-exit"
            >
              Exit Duel
            </button>
          )}
        </header>

        <SentenceBoard
          key={duel.currentItemIndex}
          duel={duel}
          question={question}
          sessionItem={sessionItem}
          viewerRole={viewerRole}
        />
      </div>
    </main>
  );
}
