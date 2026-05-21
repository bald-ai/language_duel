import { v, type Infer } from "convex/values";

// The online prototypes the homepage exposes. `memory` is its own engine;
// `missing_chunk` and `speed` share the `mcq` engine; `rebuild_sentence` uses
// `order`; `relay` and `relay_stakes` share the turn-based `relay` engine.
export const MOCK_GAMES = [
  "memory",
  "missing_chunk",
  "rebuild_sentence",
  "speed",
  "relay",
  "relay_stakes",
] as const;
export type MockGame = (typeof MOCK_GAMES)[number];

export const mockGameValidator = v.union(
  v.literal("memory"),
  v.literal("missing_chunk"),
  v.literal("rebuild_sentence"),
  v.literal("speed"),
  v.literal("relay"),
  v.literal("relay_stakes")
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

// --- Relay duel (relay + relay_stakes): one shared pool, players alternate ---
// roles — the picker hands a word to the rival, who answers it, then becomes the
// next picker. `stakes` decides whether harder words are worth more points.
export const relayDifficultyValidator = v.union(
  v.literal("easy"),
  v.literal("medium"),
  v.literal("hard")
);
const relayWordValidator = v.object({
  id: v.string(),
  prompt: v.string(),
  answer: v.string(),
  options: v.array(v.string()),
  difficulty: relayDifficultyValidator,
});
const relayResultValidator = v.object({
  prompt: v.string(),
  answer: v.string(),
  chosen: v.string(),
  correct: v.boolean(),
  scorer: v.union(playerSlotValidator, v.null()),
  gained: v.number(),
});
const relayStateValidator = v.object({
  kind: v.literal("relay"),
  stakes: v.boolean(),
  pool: v.array(relayWordValidator),
  total: v.number(),
  picker: playerSlotValidator,
  phase: v.union(v.literal("pick"), v.literal("answer")),
  assigned: v.union(relayWordValidator, v.null()),
  scores: scoresValidator,
  resolved: v.number(),
  lastResult: v.union(relayResultValidator, v.null()),
});
export type RelayState = Infer<typeof relayStateValidator>;
export type RelayWord = Infer<typeof relayWordValidator>;
export type RelayDifficulty = Infer<typeof relayDifficultyValidator>;

export const gameStateValidator = v.union(
  memoryStateValidator,
  mcqStateValidator,
  orderStateValidator,
  relayStateValidator
);
export type GameState = Infer<typeof gameStateValidator>;

export const moveValidator = v.union(
  v.object({ kind: v.literal("flip"), index: v.number() }),
  v.object({ kind: v.literal("answer"), value: v.string() }),
  v.object({ kind: v.literal("order"), order: v.array(v.number()) }),
  v.object({ kind: v.literal("pick"), wordId: v.string() })
);
export type Move = Infer<typeof moveValidator>;
