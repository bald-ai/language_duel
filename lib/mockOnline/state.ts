import { v, type Infer } from "convex/values";

// The online prototypes the homepage exposes. `memory` is its own engine;
// `missing_chunk` and `speed` share the `mcq` engine; `rebuild_sentence` uses
// `order`; the three `sentence_*` games share the `sentence` engine (one engine,
// three modes: race / coop / duel).
export const MOCK_GAMES = [
  "memory",
  "missing_chunk",
  "rebuild_sentence",
  "speed",
  "sentence_race",
  "sentence_coop",
  "sentence_duel",
] as const;
export type MockGame = (typeof MOCK_GAMES)[number];

export const mockGameValidator = v.union(
  v.literal("memory"),
  v.literal("missing_chunk"),
  v.literal("rebuild_sentence"),
  v.literal("speed"),
  v.literal("sentence_race"),
  v.literal("sentence_coop"),
  v.literal("sentence_duel")
);

export const roomStatusValidator = v.union(
  v.literal("waiting"),
  v.literal("active"),
  v.literal("finished")
);
export type RoomStatus = Infer<typeof roomStatusValidator>;

export const playerSlotValidator = v.union(v.literal("host"), v.literal("guest"));
export type PlayerSlot = Infer<typeof playerSlotValidator>;

const scoresValidator = v.object({ host: v.number(), guest: v.number() });
export type Scores = Infer<typeof scoresValidator>;

// --- Memory: shared board, alternate turns, match keeps the turn, most pairs wins. ---
const memoryStateValidator = v.object({
  kind: v.literal("memory"),
  cards: v.array(v.object({ pairId: v.number(), face: v.string() })),
  matched: v.array(v.number()),
  firstPick: v.union(v.number(), v.null()),
  lastMismatch: v.union(v.array(v.number()), v.null()),
  turn: playerSlotValidator,
  scores: scoresValidator,
});
export type MemoryState = Infer<typeof memoryStateValidator>;

// --- MCQ race (missing_chunk + speed): same questions, first correct scores. ---
const mcqResolvedValidator = v.object({
  index: v.number(),
  correct: v.string(),
  scorer: v.union(playerSlotValidator, v.null()),
});
const mcqStateValidator = v.object({
  kind: v.literal("mcq"),
  questions: v.array(
    v.object({
      prompt: v.string(),
      sentenceStart: v.optional(v.string()),
      sentenceEnd: v.optional(v.string()),
      options: v.array(v.string()),
      correct: v.string(),
    })
  ),
  index: v.number(),
  scores: scoresValidator,
  lockedHost: v.boolean(),
  lockedGuest: v.boolean(),
  lastResolved: v.union(mcqResolvedValidator, v.null()),
});
export type McqState = Infer<typeof mcqStateValidator>;
export type McqQuestion = McqState["questions"][number];

// --- Order race (rebuild_sentence): same scrambled sentence, first correct order scores. ---
const orderResolvedValidator = v.object({
  index: v.number(),
  correctText: v.string(),
  scorer: v.union(playerSlotValidator, v.null()),
});
const orderStateValidator = v.object({
  kind: v.literal("order"),
  rounds: v.array(
    v.object({
      english: v.string(),
      words: v.array(v.string()),
      correctText: v.string(),
    })
  ),
  index: v.number(),
  scores: scoresValidator,
  lockedHost: v.boolean(),
  lockedGuest: v.boolean(),
  lastResolved: v.union(orderResolvedValidator, v.null()),
});
export type OrderState = Infer<typeof orderStateValidator>;
export type OrderRound = OrderState["rounds"][number];

// --- Sentence Builder: one engine, three modes. ---
//  race: each player builds their own copy of the same sentence; first correct
//        submission scores, a wrong submission locks that player for the round.
//  coop: one shared board, players alternate placing the next word; a finished
//        sentence banks a shared point.
//  duel: one shared board; placing the correct next word scores you and keeps
//        your turn, a wrong word ends your turn and hands it to the opponent.
export const SENTENCE_MODES = ["race", "coop", "duel"] as const;
export const sentenceModeValidator = v.union(
  v.literal("race"),
  v.literal("coop"),
  v.literal("duel")
);
export type SentenceMode = Infer<typeof sentenceModeValidator>;

const sentenceResolvedValidator = v.object({
  index: v.number(),
  correctText: v.string(),
  scorer: v.union(playerSlotValidator, v.literal("shared"), v.null()),
});
const sentenceStateValidator = v.object({
  kind: v.literal("sentence"),
  mode: sentenceModeValidator,
  rounds: v.array(
    v.object({
      english: v.string(),
      words: v.array(v.string()),
      solution: v.array(v.string()),
      correctText: v.string(),
    })
  ),
  index: v.number(),
  scores: scoresValidator,
  // race-only per-round lockout after a wrong submission.
  lockedHost: v.boolean(),
  lockedGuest: v.boolean(),
  // coop/duel shared board: tile indices placed so far, and whose turn it is.
  placed: v.array(v.number()),
  turn: playerSlotValidator,
  // coop/duel: the slot whose last tap was wrong (cleared on the next valid move).
  lastError: v.union(playerSlotValidator, v.null()),
  lastResolved: v.union(sentenceResolvedValidator, v.null()),
});
export type SentenceState = Infer<typeof sentenceStateValidator>;
export type SentenceRound = SentenceState["rounds"][number];

export const gameStateValidator = v.union(
  memoryStateValidator,
  mcqStateValidator,
  orderStateValidator,
  sentenceStateValidator
);
export type GameState = Infer<typeof gameStateValidator>;

export const moveValidator = v.union(
  v.object({ kind: v.literal("flip"), index: v.number() }),
  v.object({ kind: v.literal("answer"), value: v.string() }),
  v.object({ kind: v.literal("order"), order: v.array(v.number()) }),
  // sentence race: submit a full ordering of tile indices.
  v.object({ kind: v.literal("submit"), order: v.array(v.number()) }),
  // sentence coop/duel: place one tile into the shared board.
  v.object({ kind: v.literal("tap"), tile: v.number() })
);
export type Move = Infer<typeof moveValidator>;
