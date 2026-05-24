import type { Doc } from "@/convex/_generated/dataModel";

type BaseQuestion = NonNullable<Doc<"duels">["duelQuestions"]>[number];

/**
 * The relay served question as shipped by `getDuel`: revealed (with
 * `correctOption`) during feedback / after the duel ends, masked during the
 * answer phase. Mirrors `buildRelaySafeDuel` in `convex/duels.ts`.
 */
export type RelayServedQuestion =
  | (BaseQuestion & { answerRevealedToViewer: true })
  | (Omit<BaseQuestion, "correctOption"> & { answerRevealedToViewer: false });

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
