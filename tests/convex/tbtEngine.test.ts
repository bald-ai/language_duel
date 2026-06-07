import { describe, expect, it } from "vitest";
import type { Doc } from "@/convex/_generated/dataModel";
import {
  TBT_BOARD_ROLE,
  buildInitialTbtState,
  buildTbtAdvancePatch,
  isTbtLastSentence,
  otherRole,
  tbtOpener,
} from "@/lib/duel/tbtEngine";

// A deck of `n` placeholder sentence questions. The engine only reads `.length`,
// so the content is irrelevant — it just has to type-check as a sentence question.
function deck(n: number): NonNullable<Doc<"duels">["duelQuestions"]> {
  return Array.from({ length: n }, () => ({
    kind: "sentence" as const,
    englishPrompt: "I eat bread",
    spanishSentence: "Yo como pan",
    tilePool: ["Yo", "como", "pan"],
    tileMeanings: [null, null, null],
  }));
}

describe("tbtEngine", () => {
  describe("tbtOpener / otherRole / TBT_BOARD_ROLE", () => {
    it("alternates the opener by sentence index (even → challenger, odd → opponent)", () => {
      expect(tbtOpener(0)).toBe("challenger");
      expect(tbtOpener(1)).toBe("opponent");
      expect(tbtOpener(2)).toBe("challenger");
      expect(tbtOpener(3)).toBe("opponent");
    });

    it("flips the role", () => {
      expect(otherRole("challenger")).toBe("opponent");
      expect(otherRole("opponent")).toBe("challenger");
    });

    it("uses the challenger slot as the single shared board", () => {
      expect(TBT_BOARD_ROLE).toBe("challenger");
    });
  });

  describe("buildInitialTbtState", () => {
    it("opens sentence 0 with the challenger (timing rides on questionStartTime)", () => {
      expect(buildInitialTbtState()).toEqual({ tbtTurn: "challenger" });
    });
  });

  describe("isTbtLastSentence", () => {
    it("is true only on the final sentence", () => {
      expect(isTbtLastSentence({ currentItemIndex: 0, duelQuestions: deck(3) })).toBe(false);
      expect(isTbtLastSentence({ currentItemIndex: 1, duelQuestions: deck(3) })).toBe(false);
      expect(isTbtLastSentence({ currentItemIndex: 2, duelQuestions: deck(3) })).toBe(true);
    });

    it("treats a single-sentence deck as already last", () => {
      expect(isTbtLastSentence({ currentItemIndex: 0, duelQuestions: deck(1) })).toBe(true);
    });
  });

  describe("buildTbtAdvancePatch", () => {
    it("on a finished sentence, banks a SHARED point (+1 both) and re-anchors the clock", () => {
      const patch = buildTbtAdvancePatch(
        { currentItemIndex: 0, duelQuestions: deck(3), challengerScore: 2, opponentScore: 2 },
        999,
        { bankPoint: true }
      );
      expect(patch).toEqual({
        challengerScore: 3,
        opponentScore: 3,
        currentItemIndex: 1,
        tbtTurn: "opponent", // opener of sentence 1
        questionStartTime: 999,
        // Countdown reset is also in the patch (toEqual ignores the explicit
        // `undefined`s) — covered separately below.
      });
    });

    it("on a timed-out sentence, banks NOTHING but still advances and re-anchors", () => {
      const patch = buildTbtAdvancePatch(
        { currentItemIndex: 0, duelQuestions: deck(3), challengerScore: 2, opponentScore: 2 },
        999,
        { bankPoint: false }
      );
      expect(patch).toEqual({
        // No score keys — a timeout earns no point.
        currentItemIndex: 1,
        tbtTurn: "opponent",
        questionStartTime: 999,
      });
    });

    it("banks the final shared point, clamps the index, and clears the turn pointer", () => {
      const patch = buildTbtAdvancePatch(
        { currentItemIndex: 2, duelQuestions: deck(3), challengerScore: 2, opponentScore: 2 },
        999,
        { bankPoint: true }
      );
      expect(patch).toEqual({
        challengerScore: 3,
        opponentScore: 3,
        currentItemIndex: 2,
        tbtTurn: undefined,
        questionStartTime: undefined,
      });
    });

    it("resets the shared countdown fields so the next reveal starts fresh", () => {
      const patch = buildTbtAdvancePatch(
        { currentItemIndex: 0, duelQuestions: deck(3), challengerScore: 0, opponentScore: 0 },
        100,
        { bankPoint: true }
      );
      // Keys must be PRESENT (set to undefined) so a prior pause / mutual-skip
      // can't carry into the next between-sentence countdown.
      expect(patch).toHaveProperty("countdownPausedBy", undefined);
      expect(patch).toHaveProperty("countdownPausedAt", undefined);
      expect(patch).toHaveProperty("countdownUnpauseRequestedBy", undefined);
      expect(patch).toHaveProperty("countdownSkipRequestedBy", undefined);
    });

    it("keeps both scores equal across a full deck of finishes (cooperative — no winner)", () => {
      let challengerScore = 0;
      let opponentScore = 0;
      for (let i = 0; i < 3; i++) {
        const patch = buildTbtAdvancePatch(
          { currentItemIndex: i, duelQuestions: deck(3), challengerScore, opponentScore },
          i,
          { bankPoint: true }
        );
        challengerScore = patch.challengerScore as number;
        opponentScore = patch.opponentScore as number;
      }
      expect(challengerScore).toBe(3);
      expect(opponentScore).toBe(3);
    });
  });
});
