import type { Doc } from "../_generated/dataModel";
import type { PlayerRole } from "../helpers/auth";
import { isSelfDuel } from "../../lib/duel/selfDuel";

export type ConfirmUnpausePlan =
  | { kind: "noop" }
  | { kind: "clearImmediately"; questionStartTime: number | undefined }
  | { kind: "requirePeer" };

export function planConfirmUnpauseCountdown(
  duel: Doc<"duels">,
  now: number
): ConfirmUnpausePlan {
  if (!duel.countdownPausedBy) return { kind: "noop" };

  if (isSelfDuel(duel)) {
    const pauseDuration = duel.countdownPausedAt ? now - duel.countdownPausedAt : 0;
    const questionStartTime =
      typeof duel.questionStartTime === "number"
        ? duel.questionStartTime + pauseDuration
        : undefined;
    return { kind: "clearImmediately", questionStartTime };
  }

  return { kind: "requirePeer" };
}

export type SkipCountdownPlan = {
  skipRequestedBy: PlayerRole[];
  bothSkipped: boolean;
  alreadyRequested: boolean;
};

export function planSkipCountdown(
  duel: Doc<"duels">,
  userRole: PlayerRole
): SkipCountdownPlan {
  if (isSelfDuel(duel)) {
    return {
      skipRequestedBy: ["challenger", "opponent"],
      bothSkipped: true,
      alreadyRequested: false,
    };
  }

  const currentSkips = duel.countdownSkipRequestedBy ?? [];
  if (currentSkips.includes(userRole)) {
    return {
      skipRequestedBy: currentSkips,
      bothSkipped: false,
      alreadyRequested: true,
    };
  }
  const skipRequestedBy = [...currentSkips, userRole] as PlayerRole[];
  return {
    skipRequestedBy,
    bothSkipped:
      skipRequestedBy.includes("challenger") && skipRequestedBy.includes("opponent"),
    alreadyRequested: false,
  };
}
