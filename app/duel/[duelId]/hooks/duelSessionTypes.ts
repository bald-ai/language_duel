import type { Doc } from "@/convex/_generated/dataModel";

type RawDuelQuestion = NonNullable<Doc<"duels">["duelQuestions"]>[number];
type RawSessionItem = Doc<"duels">["sessionWords"][number];

/**
 * A duel question as seen through the viewer-safe `getDuel` DTO: the base
 * question fields plus the two viewer-only fields the backend reveals once the
 * viewer has answered. Declared once and shared by the view-model and the phase
 * machine so the cast lives in a single place.
 *
 * Mixed-content duels can serve either a word or sentence shape per position.
 * Use the narrowing helpers below to assert the expected kind at the boundary
 * — the word-only hooks crash loudly on a sentence position rather than
 * silently rendering an empty MC grid.
 */
export type ViewerSafeDuelQuestion = RawDuelQuestion & {
  correctOption?: string;
  answerRevealedToViewer?: boolean;
};

export type ViewerSafeWordQuestion = Extract<ViewerSafeDuelQuestion, { kind: "word" }>;
export type ViewerSafeSentenceQuestion = Extract<ViewerSafeDuelQuestion, { kind: "sentence" }>;

export type ViewerSafeWordSessionItem = Extract<RawSessionItem, { kind: "word" }>;
export type ViewerSafeSentenceSessionItem = Extract<RawSessionItem, { kind: "sentence" }>;

/**
 * Narrow a polymorphic duel question to its word variant. Throws if the
 * caller landed on a sentence position by mistake — the word-only view-model
 * hooks (`useDuelSessionViewModel`, `useDuelPhaseState`) call this to keep
 * sentence content from silently rendering an empty MC grid.
 */
export function requireWordQuestion(question: ViewerSafeDuelQuestion): ViewerSafeWordQuestion {
  if (question.kind !== "word") {
    throw new Error("Expected a word duel question but got a sentence question");
  }
  return question;
}

export function requireWordSessionItem(item: RawSessionItem): ViewerSafeWordSessionItem {
  if (item.kind !== "word") {
    throw new Error("Expected a word session item but got a sentence item");
  }
  return item;
}

export function isWordQuestion(question: ViewerSafeDuelQuestion | undefined): question is ViewerSafeWordQuestion {
  return question?.kind === "word";
}

export function isSentenceQuestion(question: ViewerSafeDuelQuestion | undefined): question is ViewerSafeSentenceQuestion {
  return question?.kind === "sentence";
}
