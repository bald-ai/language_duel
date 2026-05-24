import { ConvexError } from "convex/values";
import type { Doc } from "../_generated/dataModel";
import {
  getSpacedRepetitionBucket,
  getSpacedRepetitionCurrentStep,
  getSpacedRepetitionDaysRemaining,
  getSpacedRepetitionDueAt,
  SPACED_REPETITION_TOTAL_STEPS,
} from "../../lib/spacedRepetition";
import type { LoadedSnapshotContent, UserSummary } from "./types";
import { getThemeNames } from "./rules";

export function buildBoardItem(args: {
  goal: Doc<"weeklyGoals">;
  record: Doc<"weeklyGoalRepetitions">;
  partner: UserSummary | null;
  content: LoadedSnapshotContent;
  now: number;
}) {
  const completedAt = args.goal.completedAt;
  if (typeof completedAt !== "number") {
    throw new ConvexError({ code: "INTERNAL_ERROR", message: "Completed goal is missing completion time." });
  }
  const dueAt = getSpacedRepetitionDueAt({
    completedSteps: args.record.completedSteps,
    goalCompletedAt: completedAt,
  });
  const bucket = getSpacedRepetitionBucket(
    {
      completedSteps: args.record.completedSteps,
      goalCompletedAt: completedAt,
    },
    args.now
  );
  const step = getSpacedRepetitionCurrentStep(args.record.completedSteps);

  const mode = args.goal.mode;
  return {
    weeklyGoalId: args.goal._id,
    mode,
    themeNames: getThemeNames(args.goal),
    partner: args.partner,
    themeCount: args.goal.themes.length,
    wordCount: args.content.ok ? args.content.wordCount : 0,
    completedSteps: args.record.completedSteps,
    step,
    totalSteps: SPACED_REPETITION_TOTAL_STEPS,
    bucket,
    dueAt,
    daysRemaining: getSpacedRepetitionDaysRemaining(dueAt, args.now),
    contentAvailable: args.content.ok,
    canStart: bucket === "ready" && args.content.ok,
    unavailableReason: args.content.ok ? undefined : args.content.message,
    completedAt,
    updatedAt: args.record.updatedAt,
    duelAvailable: mode === "shared" && args.partner !== null,
  };
}
