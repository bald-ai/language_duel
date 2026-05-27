import { v, type Infer } from "convex/values";

// The online prototypes the homepage exposes. The two `sentence_*` games share
// the `sentence` engine (coop / duel modes).
export const MOCK_GAMES = ["sentence_coop", "sentence_duel"] as const;
export type MockGame = (typeof MOCK_GAMES)[number];

export const mockGameValidator = v.union(
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

// --- Sentence Builder: one engine, two modes with separate state shapes. ---
//  coop: one shared board, players alternate placing the next word. A wrong
//        tap passes the turn so the partner can place the right word. A
//        finished sentence banks a shared point.
//  duel: each player has their own copy of the same sentence and builds it
//        independently. A wrong tap is rejected (nothing placed) and adds a
//        mistake. Round advances once BOTH players complete the sentence.
//        Fewer mistakes wins at the end.
export const sentenceModeValidator = v.union(
  v.literal("coop"),
  v.literal("duel")
);
export type SentenceMode = Infer<typeof sentenceModeValidator>;

const sentenceRoundValidator = v.object({
  english: v.string(),
  words: v.array(v.string()),
  solution: v.array(v.string()),
  correctText: v.string(),
});

const sentenceResolvedValidator = v.object({
  index: v.number(),
  correctText: v.string(),
});

const sentenceCoopStateValidator = v.object({
  kind: v.literal("sentence"),
  mode: v.literal("coop"),
  rounds: v.array(sentenceRoundValidator),
  index: v.number(),
  // Shared sentences completed (host and guest stay equal).
  scores: scoresValidator,
  // Shared board: tile indices placed so far, and whose turn it is.
  placed: v.array(v.number()),
  turn: playerSlotValidator,
  // The slot whose last tap was wrong (cleared on the next valid move).
  lastError: v.union(playerSlotValidator, v.null()),
  lastResolved: v.union(sentenceResolvedValidator, v.null()),
});
export type SentenceCoopState = Infer<typeof sentenceCoopStateValidator>;

const sentenceDuelStateValidator = v.object({
  kind: v.literal("sentence"),
  mode: v.literal("duel"),
  rounds: v.array(sentenceRoundValidator),
  index: v.number(),
  // Wrong taps per player (lower wins at the end).
  mistakes: scoresValidator,
  // Per-player boards: each player builds their own copy.
  placedHost: v.array(v.number()),
  placedGuest: v.array(v.number()),
  // Whether each player has finished the current sentence and is waiting.
  doneHost: v.boolean(),
  doneGuest: v.boolean(),
  // The slot whose last tap was wrong (cleared on the next valid move).
  lastError: v.union(playerSlotValidator, v.null()),
  lastResolved: v.union(sentenceResolvedValidator, v.null()),
});
export type SentenceDuelState = Infer<typeof sentenceDuelStateValidator>;

const sentenceStateValidator = v.union(
  sentenceCoopStateValidator,
  sentenceDuelStateValidator
);
export type SentenceState = Infer<typeof sentenceStateValidator>;
export type SentenceRound = Infer<typeof sentenceRoundValidator>;

export const gameStateValidator = sentenceStateValidator;
export type GameState = Infer<typeof gameStateValidator>;

export const moveValidator = v.object({ kind: v.literal("tap"), tile: v.number() });
export type Move = Infer<typeof moveValidator>;
