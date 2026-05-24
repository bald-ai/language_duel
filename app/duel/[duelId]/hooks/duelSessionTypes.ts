import type { Doc } from "@/convex/_generated/dataModel";

/**
 * A duel question as seen through the viewer-safe `getDuel` DTO: the base
 * question fields plus the two viewer-only fields the backend reveals once the
 * viewer has answered. Declared once and shared by the view-model and the phase
 * machine so the cast lives in a single place.
 */
export type ViewerSafeDuelQuestion = NonNullable<Doc<"duels">["duelQuestions"]>[number] & {
  correctOption?: string;
  answerRevealedToViewer?: boolean;
};
