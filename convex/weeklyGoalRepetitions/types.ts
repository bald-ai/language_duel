import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { Doc } from "../_generated/dataModel";
import type { buildSessionItems } from "../../lib/sessionItems";

export type { UserSummary } from "../helpers/userSummary";

export type CtxWithDb = QueryCtx | MutationCtx;

export type SpacedRepetitionCompletion = "solo_practice" | "duel";

export type LoadedSnapshotContent =
  | {
      ok: true;
      sessionItems: ReturnType<typeof buildSessionItems>;
      themeCount: number;
      itemCount: number;
      themeSummary: string;
    }
  | {
      ok: false;
      message: string;
    };

export type ReadyRepetitionContext = {
  goal: Doc<"weeklyGoals">;
  record: Doc<"weeklyGoalRepetitions">;
  bucket: "ready";
  content: Extract<LoadedSnapshotContent, { ok: true }>;
  step: number;
};
