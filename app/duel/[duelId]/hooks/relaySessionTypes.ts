import type { Doc } from "@/convex/_generated/dataModel";

type BaseQuestion = NonNullable<Doc<"duels">["duelQuestions"]>[number];
type WordBaseQuestion = Extract<BaseQuestion, { kind: "word" }>;
type SentenceBaseQuestion = Extract<BaseQuestion, { kind: "sentence" }>;

/**
 * The relay served question as shipped by `getDuel`: revealed (with answer key)
 * during feedback / after the duel ends, masked during the answer phase. A
 * position is either a word (MC grid, `correctOption` hidden while masked) or a
 * sentence (tile board, `spanishSentence` hidden while masked); both keep
 * `tilePool`/`englishPrompt`/`options`. Mirrors `buildRelaySafeDuel` in
 * `convex/duels.ts`.
 */
export type RelayServedQuestion =
  | (WordBaseQuestion & { answerRevealedToViewer: true })
  | (Omit<WordBaseQuestion, "correctOption"> & { answerRevealedToViewer: false })
  | (SentenceBaseQuestion & { answerRevealedToViewer: true })
  | (Omit<SentenceBaseQuestion, "spanishSentence"> & { answerRevealedToViewer: false });

/**
 * A relay duel as seen through the viewer-safe DTO: the stored doc minus the
 * server-only answer keys, plus the two computed relay fields. The page hands
 * down a `Doc<"duels">` (relay state fields live on it already); the relay
 * session recovers the computed fields with a single cast to this type.
 */
export type RelaySafeDuel = Doc<"duels"> & {
  relayServedQuestion: RelayServedQuestion | null;
  relayRemainingPositions: number[];
};
