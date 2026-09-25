import { describe, expect, it } from "vitest";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import {
  applySentenceTap,
  appendSentenceTile,
  removeLastSentenceTile,
  clearSentenceBoard,
  confirmSentenceRound,
  buildSentenceAnswerPatch,
  scorePvpSentenceSubmission,
  validateTimedOutFlag,
} from "@/convex/rules/sentenceGameplayRules";
import {
  SENTENCE_PVP_CLEAN_CONFIRM_POINTS,
  SENTENCE_PVP_SINGLE_FAIL_POINTS,
  SENTENCE_PVP_FLOOR_POINTS,
} from "@/lib/themes/sentenceConstants";

function baseDuel(overrides: Partial<Doc<"duels">> = {}): Doc<"duels"> {
  return {
    _id: "duel_1" as Id<"duels">,
    _creationTime: Date.now(),
    challengerId: "user_1" as Id<"users">,
    opponentId: "user_2" as Id<"users">,
    themeIds: [],
    sessionItems: [],
    sourceType: "normal",
    status: "active",
    createdAt: Date.now(),
    currentItemIndex: 0,
    itemOrder: [0],
    challengerAnswered: false,
    opponentAnswered: false,
    challengerScore: 0,
    opponentScore: 0,
    duelMode: "pvp",
    hintPoolUsed: [],
    sentenceHintPoolUsed: [],
    currentQuestionHintFired: false,
    seed: 1,
    ...overrides,
  };
}

/**
 * A two-token sentence ("Quiero cafe") with one distractor. Tile pool indices
 * for the correct sequence are [0, 1]; index 2 is a distractor that should be
 * counted as a mistake.
 */
function sentenceDuel(
  progress?: Partial<Doc<"duels">>["sentenceProgress"],
  overrides: Partial<Doc<"duels">> = {}
): Doc<"duels"> {
  return baseDuel({
    duelQuestions: [
      {
        kind: "sentence",
        englishPrompt: "I want coffee",
        spanishSentence: "Quiero cafe",
        tilePool: ["Quiero", "cafe", "leche"],
        tileMeanings: [null, null, null],
      },
    ],
    sentenceProgress: progress,
    ...overrides,
  });
}

/**
 * A PvP build-and-confirm duel with a repeated word so positional coloring can
 * be exercised. Spanish "el gato el perro" (the cat the dog). Tile pool:
 *   [0]=el  [1]=gato  [2]=el  [3]=perro  [4]=raton (distractor)
 * Indices [0,1,2,3] build the correct sentence in order.
 */
function duplicateWordPvpDuel(
  progress?: Partial<Doc<"duels">>["sentenceProgress"]
): Doc<"duels"> {
  return baseDuel({
    duelMode: "pvp",
    duelQuestions: [
      {
        kind: "sentence",
        englishPrompt: "the cat the dog",
        spanishSentence: "el gato el perro",
        tilePool: ["el", "gato", "el", "perro", "raton"],
        tileMeanings: [null, null, null, null, null],
      },
    ],
    sentenceProgress: progress,
  });
}

function pvpProgress(
  entry: Partial<NonNullable<Doc<"duels">["sentenceProgress"]>[number]>
): Doc<"duels">["sentenceProgress"] {
  return [
    {
      questionIndex: 0,
      role: "challenger",
      placedTileIndices: [],
      mistakes: 0,
      completed: false,
      finalized: false,
      failedConfirms: 0,
      ...entry,
    },
  ];
}

/**
 * A boss can be launched as PvP, which puts it on the build-and-confirm model
 * AND makes it lives-tracked. This duel exercises that overlap.
 */
function pvpBossDuel(
  progress: Doc<"duels">["sentenceProgress"],
  overrides: Partial<Doc<"duels">> = {}
): Doc<"duels"> {
  return baseDuel({
    duelMode: "pvp",
    sourceType: "boss",
    weeklyGoalId: "goal_1" as Id<"weeklyGoals">,
    bossType: "mini",
    livesRemaining: 3,
    challengerPerfectRun: true,
    opponentPerfectRun: true,
    duelQuestions: [
      {
        kind: "sentence",
        englishPrompt: "the cat the dog",
        spanishSentence: "el gato el perro",
        tilePool: ["el", "gato", "el", "perro", "raton"],
        tileMeanings: [null, null, null, null, null],
      },
    ],
    sentenceProgress: progress,
    ...overrides,
  });
}

describe("applySentenceTap (retained for the cooperative turn-by-turn board)", () => {
  it("accepts the first correct tile and records it in sentenceProgress", () => {
    const duel = sentenceDuel();
    const { patch, accepted } = applySentenceTap({
      duel,
      questionIndex: 0,
      role: "challenger",
      tileIndex: 0,
    });
    expect(accepted).toBe(true);
    expect(patch.sentenceProgress).toEqual([
      expect.objectContaining({
        questionIndex: 0,
        role: "challenger",
        placedTileIndices: [0],
        mistakes: 0,
        completed: false,
      }),
    ]);
  });

  it("flags the round complete when the last correct tile is placed", () => {
    const duel = sentenceDuel([
      {
        questionIndex: 0,
        role: "challenger",
        placedTileIndices: [0],
        mistakes: 0,
        completed: false,
        finalized: false,
      },
    ]);
    const { patch, accepted } = applySentenceTap({
      duel,
      questionIndex: 0,
      role: "challenger",
      tileIndex: 1,
    });
    expect(accepted).toBe(true);
    expect(patch.sentenceProgress?.[0]).toEqual(
      expect.objectContaining({ completed: true, placedTileIndices: [0, 1] })
    );
  });

  it("increments mistakes for a wrong tap (distractor) and keeps placed unchanged", () => {
    const duel = sentenceDuel();
    const { patch, accepted } = applySentenceTap({
      duel,
      questionIndex: 0,
      role: "challenger",
      tileIndex: 2, // distractor "leche"
    });
    expect(accepted).toBe(false);
    expect(patch.sentenceProgress?.[0]).toEqual(
      expect.objectContaining({ mistakes: 1, placedTileIndices: [] })
    );
  });

  it("rejects out-of-range tile indices with no state change", () => {
    const duel = sentenceDuel();
    const { patch, accepted } = applySentenceTap({
      duel,
      questionIndex: 0,
      role: "challenger",
      tileIndex: 99,
    });
    expect(accepted).toBe(false);
    expect(patch).toEqual({});
  });

  it("rejects re-taps on an already-placed tile", () => {
    const duel = sentenceDuel([
      {
        questionIndex: 0,
        role: "challenger",
        placedTileIndices: [0],
        mistakes: 0,
        completed: false,
        finalized: false,
      },
    ]);
    const { patch, accepted } = applySentenceTap({
      duel,
      questionIndex: 0,
      role: "challenger",
      tileIndex: 0,
    });
    expect(accepted).toBe(false);
    expect(patch).toEqual({});
  });

  it("ignores taps after the round is finalized", () => {
    const duel = sentenceDuel([
      {
        questionIndex: 0,
        role: "challenger",
        placedTileIndices: [0, 1],
        mistakes: 0,
        completed: true,
        finalized: true,
      },
    ]);
    const { patch, accepted } = applySentenceTap({
      duel,
      questionIndex: 0,
      role: "challenger",
      tileIndex: 2,
    });
    expect(accepted).toBe(false);
    expect(patch).toEqual({});
  });

  it("rejects taps on a word position", () => {
    const duel = baseDuel({
      duelQuestions: [
        { kind: "word", options: ["a", "b", "c", "d"], correctOption: "a", difficulty: "easy", points: 1 },
      ],
    });
    expect(() =>
      applySentenceTap({ duel, questionIndex: 0, role: "challenger", tileIndex: 0 })
    ).toThrow(/sentence positions/i);
  });
});

describe("buildSentenceAnswerPatch — PvE uses the unified build-and-confirm ladder", () => {
  // After unification a real two-player PvE duel scores off the SAME
  // failed-Confirm ladder as PvP (the old clean/messy per-tap scale is gone).
  it("clean Confirm in a PvE duel scores +1, same ladder as PvP", () => {
    const duel = duplicateWordPvpDuel(
      pvpProgress({ placedTileIndices: [0, 1, 2, 3], completed: true, failedConfirms: 0 })
    );
    duel.duelMode = "pve";
    const patch = buildSentenceAnswerPatch({
      duel,
      playerRole: "challenger",
      isChallenger: true,
      timedOut: false,
      questionIndex: 0,
    });
    expect(patch.challengerScore).toBe(SENTENCE_PVP_CLEAN_CONFIRM_POINTS);
    expect(patch.challengerLastAnswer).toBe("sentence:confirms=0");
  });

  it("a PvE timeout with no failed Confirms scores 0 (timedOut flag is not used for scoring)", () => {
    const duel = duplicateWordPvpDuel(
      pvpProgress({ placedTileIndices: [0, 1], completed: false, failedConfirms: 0 })
    );
    duel.duelMode = "pve";
    const patch = buildSentenceAnswerPatch({
      duel,
      playerRole: "challenger",
      isChallenger: true,
      timedOut: true,
      questionIndex: 0,
    });
    expect(patch.challengerScore).toBe(0);
    expect(patch.challengerLastAnswer).toBe("__TIMEOUT__");
  });

  it("mirrors a completed challenger onto the opponent in a self-duel", () => {
    // Self-duel: challengerId === opponentId (forced pve mode). The patch mirror
    // copies the challenger's answer/score onto the opponent half.
    const duel = duplicateWordPvpDuel(
      pvpProgress({ placedTileIndices: [0, 1, 2, 3], completed: true, failedConfirms: 0 })
    );
    duel.duelMode = "pve";
    duel.opponentId = duel.challengerId;
    const patch = buildSentenceAnswerPatch({
      duel,
      playerRole: "challenger",
      isChallenger: true,
      timedOut: false,
      questionIndex: 0,
    });
    expect(patch.challengerAnswered).toBe(true);
    expect(patch.opponentAnswered).toBe(true);
    expect(patch.opponentScore).toBe(patch.challengerScore);
  });
});

describe("scorePvpSentenceSubmission (build-and-confirm ladder)", () => {
  it("clean first-try Confirm = +1", () => {
    expect(scorePvpSentenceSubmission({ completed: true, failedConfirms: 0 })).toBe(
      SENTENCE_PVP_CLEAN_CONFIRM_POINTS
    );
  });

  it("one failed Confirm then correct = 0", () => {
    expect(scorePvpSentenceSubmission({ completed: true, failedConfirms: 1 })).toBe(
      SENTENCE_PVP_SINGLE_FAIL_POINTS
    );
  });

  it("two or more failed Confirms then correct = −1 floor", () => {
    expect(scorePvpSentenceSubmission({ completed: true, failedConfirms: 2 })).toBe(
      SENTENCE_PVP_FLOOR_POINTS
    );
    expect(scorePvpSentenceSubmission({ completed: true, failedConfirms: 9 })).toBe(
      SENTENCE_PVP_FLOOR_POINTS
    );
  });

  it("timeout with zero failed Confirms = 0", () => {
    expect(scorePvpSentenceSubmission({ completed: false, failedConfirms: 0 })).toBe(0);
  });

  it("timeout after at least one failed Confirm = −1 floor", () => {
    expect(scorePvpSentenceSubmission({ completed: false, failedConfirms: 1 })).toBe(
      SENTENCE_PVP_FLOOR_POINTS
    );
    expect(scorePvpSentenceSubmission({ completed: false, failedConfirms: 5 })).toBe(
      SENTENCE_PVP_FLOOR_POINTS
    );
  });
});

describe("appendSentenceTile (build-and-confirm placement, no validation)", () => {
  it("appends any tile without validating, never touching mistakes", () => {
    const duel = duplicateWordPvpDuel();
    // index 4 is the distractor "raton" — in per-tap mode this would be a
    // mistake, but build-confirm placement accepts it.
    const { patch, accepted } = appendSentenceTile({
      duel,
      questionIndex: 0,
      role: "challenger",
      tileIndex: 4,
    });
    expect(accepted).toBe(true);
    expect(patch.sentenceProgress?.[0]).toEqual(
      expect.objectContaining({ placedTileIndices: [4], mistakes: 0, completed: false })
    );
  });

  it("rejects a re-tap of an already-placed index", () => {
    const duel = duplicateWordPvpDuel(pvpProgress({ placedTileIndices: [0] }));
    const { patch, accepted } = appendSentenceTile({
      duel,
      questionIndex: 0,
      role: "challenger",
      tileIndex: 0,
    });
    expect(accepted).toBe(false);
    expect(patch).toEqual({});
  });

  it("rejects out-of-bounds indices", () => {
    const duel = duplicateWordPvpDuel();
    const { accepted } = appendSentenceTile({
      duel,
      questionIndex: 0,
      role: "challenger",
      tileIndex: 99,
    });
    expect(accepted).toBe(false);
  });

  it("caps the board at the target sentence length", () => {
    // "el gato el perro" has 4 tokens; placing a 5th tile is rejected.
    const duel = duplicateWordPvpDuel(pvpProgress({ placedTileIndices: [0, 1, 2, 3] }));
    const { patch, accepted } = appendSentenceTile({
      duel,
      questionIndex: 0,
      role: "challenger",
      tileIndex: 4,
    });
    expect(accepted).toBe(false);
    expect(patch).toEqual({});
  });
});

describe("removeLastSentenceTile / clearSentenceBoard (free edits)", () => {
  it("peels only the most recently placed tile", () => {
    const duel = duplicateWordPvpDuel(pvpProgress({ placedTileIndices: [0, 1, 2] }));
    const { patch } = removeLastSentenceTile({ duel, questionIndex: 0, role: "challenger" });
    expect(patch.sentenceProgress?.[0]).toEqual(
      expect.objectContaining({ placedTileIndices: [0, 1] })
    );
  });

  it("is a no-op on an empty board", () => {
    const duel = duplicateWordPvpDuel(pvpProgress({ placedTileIndices: [] }));
    const { patch } = removeLastSentenceTile({ duel, questionIndex: 0, role: "challenger" });
    expect(patch).toEqual({});
  });

  it("clears the whole board but keeps the failed-Confirm count", () => {
    const duel = duplicateWordPvpDuel(
      pvpProgress({ placedTileIndices: [0, 1, 2], failedConfirms: 2 })
    );
    const { patch } = clearSentenceBoard({ duel, questionIndex: 0, role: "challenger" });
    expect(patch.sentenceProgress?.[0]).toEqual(
      expect.objectContaining({ placedTileIndices: [], failedConfirms: 2 })
    );
  });

  it("does not edit a completed round", () => {
    const duel = duplicateWordPvpDuel(
      pvpProgress({ placedTileIndices: [0, 1, 2, 3], completed: true })
    );
    expect(
      removeLastSentenceTile({ duel, questionIndex: 0, role: "challenger" }).patch
    ).toEqual({});
    expect(
      clearSentenceBoard({ duel, questionIndex: 0, role: "challenger" }).patch
    ).toEqual({});
  });
});

describe("confirmSentenceRound (whole-sentence validation point)", () => {
  it("correct build → completed, all-true mask, no failed Confirm", () => {
    const duel = duplicateWordPvpDuel(pvpProgress({ placedTileIndices: [0, 1, 2, 3] }));
    const { patch, result } = confirmSentenceRound({
      duel,
      questionIndex: 0,
      role: "challenger",
    });
    expect(result.completed).toBe(true);
    expect(result.correctnessMask).toEqual([true, true, true, true]);
    expect(result.failedConfirms).toBe(0);
    expect(patch.sentenceProgress?.[0]).toEqual(
      expect.objectContaining({ completed: true })
    );
  });

  it("wrong build → positional mask + failedConfirms++, not finalized", () => {
    // Placed "gato el el perro" (indices [1,0,2,3]) for target "el gato el perro".
    // Position 0 expects "el" but got "gato" → false; position 1 expects "gato"
    // but got "el" → false; positions 2,3 happen to match.
    const duel = duplicateWordPvpDuel(pvpProgress({ placedTileIndices: [1, 0, 2, 3] }));
    const { patch, result } = confirmSentenceRound({
      duel,
      questionIndex: 0,
      role: "challenger",
    });
    expect(result.completed).toBe(false);
    expect(result.correctnessMask).toEqual([false, false, true, true]);
    expect(result.failedConfirms).toBe(1);
    expect(patch.sentenceProgress?.[0]).toEqual(
      expect.objectContaining({ completed: false, failedConfirms: 1 })
    );
  });

  it("duplicate word is positional: a 'the' tile is green only in a 'the' slot", () => {
    // Place "el gato el" then a distractor in slot 3: [0,1,2,4].
    // Slots 0,1,2 match (el/gato/el); slot 3 expects "perro" but got "raton".
    const duel = duplicateWordPvpDuel(pvpProgress({ placedTileIndices: [0, 1, 2, 4] }));
    const { result } = confirmSentenceRound({ duel, questionIndex: 0, role: "challenger" });
    expect(result.correctnessMask).toEqual([true, true, true, false]);
    expect(result.completed).toBe(false);
  });

  it("a 'the' tile placed in a non-'the' slot is red (not membership-matched)", () => {
    // Place "el el ..." → slot 1 expects "gato" but got the second "el" (index 2).
    const duel = duplicateWordPvpDuel(pvpProgress({ placedTileIndices: [0, 2] }));
    const { result } = confirmSentenceRound({ duel, questionIndex: 0, role: "challenger" });
    // Slot 0 = "el" ✓; slot 1 = "el" where "gato" expected ✗.
    expect(result.correctnessMask).toEqual([true, false]);
  });

  it("an empty board is a no-op (no penalty)", () => {
    const duel = duplicateWordPvpDuel(pvpProgress({ placedTileIndices: [] }));
    const { patch, result } = confirmSentenceRound({
      duel,
      questionIndex: 0,
      role: "challenger",
    });
    expect(patch).toEqual({});
    expect(result.failedConfirms).toBe(0);
    expect(result.completed).toBe(false);
  });

  it("accumulates failed Confirms across attempts", () => {
    const duel = duplicateWordPvpDuel(
      pvpProgress({ placedTileIndices: [1, 0, 2, 3], failedConfirms: 1 })
    );
    const { result } = confirmSentenceRound({ duel, questionIndex: 0, role: "challenger" });
    expect(result.failedConfirms).toBe(2);
  });
});

describe("buildSentenceAnswerPatch — PvP build-and-confirm ladder", () => {
  it("clean Confirm (0 failed) scores +1 with a confirms marker", () => {
    const duel = duplicateWordPvpDuel(
      pvpProgress({ placedTileIndices: [0, 1, 2, 3], completed: true, failedConfirms: 0 })
    );
    const patch = buildSentenceAnswerPatch({
      duel,
      playerRole: "challenger",
      isChallenger: true,
      timedOut: false,
      questionIndex: 0,
    });
    expect(patch.challengerScore).toBe(0 + SENTENCE_PVP_CLEAN_CONFIRM_POINTS);
    expect(patch.challengerLastAnswer).toBe("sentence:confirms=0");
  });

  it("Confirm after two fails scores the −1 floor (allows a negative running score)", () => {
    const duel = duplicateWordPvpDuel(
      pvpProgress({ placedTileIndices: [0, 1, 2, 3], completed: true, failedConfirms: 3 })
    );
    duel.challengerScore = 0;
    const patch = buildSentenceAnswerPatch({
      duel,
      playerRole: "challenger",
      isChallenger: true,
      timedOut: false,
      questionIndex: 0,
    });
    expect(patch.challengerScore).toBe(SENTENCE_PVP_FLOOR_POINTS);
  });

  it("timeout with failed Confirms scores −1; timeout with none scores 0", () => {
    const withFails = duplicateWordPvpDuel(
      pvpProgress({ placedTileIndices: [0, 1], completed: false, failedConfirms: 2 })
    );
    withFails.challengerScore = 0;
    expect(
      buildSentenceAnswerPatch({
        duel: withFails,
        playerRole: "challenger",
        isChallenger: true,
        timedOut: true,
        questionIndex: 0,
      }).challengerScore
    ).toBe(SENTENCE_PVP_FLOOR_POINTS);

    const noFails = duplicateWordPvpDuel(
      pvpProgress({ placedTileIndices: [0, 1], completed: false, failedConfirms: 0 })
    );
    const patch = buildSentenceAnswerPatch({
      duel: noFails,
      playerRole: "challenger",
      isChallenger: true,
      timedOut: true,
      questionIndex: 0,
    });
    expect(patch.challengerScore).toBe(0);
    expect(patch.challengerLastAnswer).toBe("__TIMEOUT__");
  });
});

describe("buildSentenceAnswerPatch — PvP boss (build-and-confirm lives)", () => {
  it("deducts one life and breaks the perfect run on an unsolved sentence", () => {
    const duel = pvpBossDuel(
      pvpProgress({ placedTileIndices: [0, 1], completed: false, failedConfirms: 1 })
    );
    const patch = buildSentenceAnswerPatch({
      duel,
      playerRole: "challenger",
      isChallenger: true,
      timedOut: true,
      questionIndex: 0,
    });
    expect(patch.livesRemaining).toBe(2);
    expect(patch.challengerPerfectRun).toBe(false);
  });

  it("costs no life when the sentence is solved (even with failed Confirms)", () => {
    const duel = pvpBossDuel(
      pvpProgress({ placedTileIndices: [0, 1, 2, 3], completed: true, failedConfirms: 2 })
    );
    const patch = buildSentenceAnswerPatch({
      duel,
      playerRole: "challenger",
      isChallenger: true,
      timedOut: false,
      questionIndex: 0,
    });
    expect(patch.livesRemaining).toBeUndefined();
    expect(patch.challengerPerfectRun).toBeUndefined();
  });

  it("ends the boss attempt when an unsolved sentence empties the lives pool", () => {
    const duel = pvpBossDuel(
      pvpProgress({ placedTileIndices: [0], completed: false, failedConfirms: 0 }),
      { livesRemaining: 1 }
    );
    const patch = buildSentenceAnswerPatch({
      duel,
      playerRole: "challenger",
      isChallenger: true,
      timedOut: true,
      questionIndex: 0,
    });
    expect(patch.livesRemaining).toBe(0);
    expect(patch.status).toBe("completed");
    expect(patch.challengerPerfectRun).toBe(false);
  });
});

describe("validateTimedOutFlag", () => {
  it("accepts boolean values", () => {
    expect(() => validateTimedOutFlag(true)).not.toThrow();
    expect(() => validateTimedOutFlag(false)).not.toThrow();
  });
  it("rejects non-boolean values", () => {
    expect(() => validateTimedOutFlag("yes")).toThrow(/boolean/i);
    expect(() => validateTimedOutFlag(0)).toThrow(/boolean/i);
  });
});

describe("sentence round lifecycle boundaries", () => {
  const player = { questionIndex: 0, role: "challenger" as const };

  it.each([applySentenceTap, appendSentenceTile])("rejects negative, completed and finalized placement without writing (%#)", (place) => {
    for (const progress of [{ completed: true }, { finalized: true }]) {
      const duel = sentenceDuel(pvpProgress(progress));
      expect(place({ duel, ...player, tileIndex: 0 })).toEqual({ patch: {}, accepted: false });
    }
    expect(place({ duel: sentenceDuel(), ...player, tileIndex: -1 })).toEqual({ patch: {}, accepted: false });
  });

  it("ignores cooperative taps after all target slots are occupied", () => {
    const duel = sentenceDuel(pvpProgress({ placedTileIndices: [0, 1] }));
    expect(applySentenceTap({ duel, ...player, tileIndex: 2 })).toEqual({ patch: {}, accepted: false });
  });

  it.each([appendSentenceTile, removeLastSentenceTile, clearSentenceBoard, confirmSentenceRound])("rejects missing sentence positions before editing (%#)", (edit) => {
    expect(() => edit({ duel: baseDuel(), ...player, tileIndex: 0 })).toThrow("This duel position is not a sentence round");
  });

  it("preserves progress belonging to another player or question", () => {
    const otherPlayer = pvpProgress({ role: "opponent", placedTileIndices: [1] })![0];
    const otherQuestion = pvpProgress({ questionIndex: 1, placedTileIndices: [2] })![0];
    const current = pvpProgress({ placedTileIndices: [] })![0];
    const duel = sentenceDuel([otherPlayer, current, otherQuestion]);
    const { patch } = appendSentenceTile({ duel, ...player, tileIndex: 0 });
    expect(patch.sentenceProgress).toEqual([otherPlayer, otherQuestion, { ...current, placedTileIndices: [0] }]);
    expect(duel.sentenceProgress).toEqual([otherPlayer, current, otherQuestion]);
  });

  it.each([removeLastSentenceTile, clearSentenceBoard])("does not create absent progress or edit finalized/empty boards (%#)", (edit) => {
    expect(edit({ duel: sentenceDuel(), ...player })).toEqual({ patch: {} });
    for (const progress of [{ finalized: true, placedTileIndices: [0] }, { placedTileIndices: [] }]) {
      expect(edit({ duel: sentenceDuel(pvpProgress(progress)), ...player })).toEqual({ patch: {} });
    }
  });

  it("charges one failed confirm per distinct wrong board, including changed length", () => {
    let duel = sentenceDuel(pvpProgress({ placedTileIndices: [2] }));
    const first = confirmSentenceRound({ duel, ...player });
    expect(first.result).toEqual({ completed: false, correctnessMask: [false], failedConfirms: 1 });
    duel = { ...duel, ...first.patch };
    expect(confirmSentenceRound({ duel, ...player })).toEqual({ patch: {}, result: first.result });
    duel = { ...duel, ...appendSentenceTile({ duel, ...player, tileIndex: 1 }).patch };
    const second = confirmSentenceRound({ duel, ...player });
    expect(second.result.failedConfirms).toBe(2);
    duel = { ...duel, ...second.patch };
    duel = { ...duel, ...clearSentenceBoard({ duel, ...player }).patch };
    duel = { ...duel, ...appendSentenceTile({ duel, ...player, tileIndex: 0 }).patch };
    duel = { ...duel, ...appendSentenceTile({ duel, ...player, tileIndex: 2 }).patch };
    const third = confirmSentenceRound({ duel, ...player });
    expect(third.result).toEqual({ completed: false, correctnessMask: [true, false], failedConfirms: 3 });
    expect(third.patch.sentenceProgress?.[0].lastFailedConfirmTileIndices).toEqual([0, 2]);
  });

  it("does not complete a correct but partial sentence", () => {
    const duel = sentenceDuel(pvpProgress({ placedTileIndices: [0] }));
    expect(confirmSentenceRound({ duel, ...player }).result).toEqual({ completed: false, correctnessMask: [true], failedConfirms: 1 });
  });

  it("returns the current mask without writes for completed or finalized progress", () => {
    for (const progress of [{ completed: true }, { finalized: true }]) {
      const duel = sentenceDuel(pvpProgress({ ...progress, placedTileIndices: [0, 1], failedConfirms: 2 }));
      expect(confirmSentenceRound({ duel, ...player })).toEqual({
        patch: {}, result: { correctnessMask: [true, true], completed: progress.completed === true, failedConfirms: 2 },
      });
    }
  });

  it("reports invalid and excess positions as incorrect without revealing the answer", () => {
    const duel = sentenceDuel(pvpProgress({ placedTileIndices: [0, 99, 1] }));
    expect(confirmSentenceRound({ duel, ...player }).result).toEqual({
      completed: false, failedConfirms: 1, correctnessMask: [true, false, false],
    });
  });

  it("an untouched board has no confirmation penalty", () => {
    expect(confirmSentenceRound({ duel: sentenceDuel(), ...player })).toEqual({
      patch: {}, result: { correctnessMask: [], completed: false, failedConfirms: 0 },
    });
  });

  it("records opponent score and finalization once without changing the challenger", () => {
    const duel = sentenceDuel(pvpProgress({ role: "opponent", completed: true }), { opponentScore: 5, challengerScore: 7 });
    const submission = { playerRole: "opponent" as const, isChallenger: false, timedOut: false, questionIndex: 0 };
    const patch = buildSentenceAnswerPatch({ duel, ...submission });
    expect(patch).toEqual({ opponentAnswered: true, opponentScore: 6, opponentLastAnswer: "sentence:confirms=0",
      sentenceProgress: [{ ...duel.sentenceProgress![0], finalized: true }] });
    expect(buildSentenceAnswerPatch({ duel: { ...duel, ...patch }, ...submission })).toEqual({});
    expect(buildSentenceAnswerPatch({ duel: { ...duel, challengerAnswered: true }, ...submission, isChallenger: true, playerRole: "challenger" })).toEqual({});
  });

  it("finalizes an untouched timeout and preserves an already finalized row", () => {
    const submission = { playerRole: "challenger" as const, isChallenger: true, timedOut: true, questionIndex: 0 };
    const patch = buildSentenceAnswerPatch({ duel: sentenceDuel(), ...submission });
    expect(patch.challengerLastAnswer).toBe("__TIMEOUT__");
    expect(patch.challengerScore).toBe(0);
    expect(patch.sentenceProgress).toEqual([{
      questionIndex: 0, role: "challenger", placedTileIndices: [], mistakes: 0, completed: false, finalized: true,
    }]);
    expect(buildSentenceAnswerPatch({ duel: sentenceDuel(pvpProgress({ finalized: true })), ...submission }).sentenceProgress).toBeUndefined();
  });
});
