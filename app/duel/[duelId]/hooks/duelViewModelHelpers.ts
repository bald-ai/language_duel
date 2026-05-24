import { formatVisibleUser } from "@/lib/userDisplay";
import { PVP_HINT_ELIMINATION_PICKS } from "@/lib/hintPool/constants";
import type { DuelPlayerSummary } from "./useDuelSessionViewModel";

type DuelRole = "challenger" | "opponent";

export type DuelHintFlags = {
  canRequestHint: boolean;
  iRequestedHint: boolean;
  theyRequestedHint: boolean;
  hintAccepted: boolean;
  canAcceptHint: boolean;
  isHintProvider: boolean;
  canEliminate: boolean;
};

/**
 * The seven cooperative-hint flags for the viewer. This is the single source of
 * truth for hint policy: PvE has no cooperative hints, so it short-circuits to
 * all-false here rather than having a downstream layer discard the result.
 */
export function deriveHintFlags(args: {
  isPve: boolean;
  hasAnswered: boolean;
  opponentHasAnswered: boolean;
  hintRequestedBy: string | undefined;
  hintAccepted: boolean | undefined;
  eliminatedOptions: string[];
  myRole: DuelRole;
  theirRole: DuelRole;
}): DuelHintFlags {
  if (args.isPve) {
    return {
      canRequestHint: false,
      iRequestedHint: false,
      theyRequestedHint: false,
      hintAccepted: false,
      canAcceptHint: false,
      isHintProvider: false,
      canEliminate: false,
    };
  }

  const iRequestedHint = args.hintRequestedBy === args.myRole;
  const theyRequestedHint = args.hintRequestedBy === args.theirRole;
  const canAcceptHint = args.hasAnswered && theyRequestedHint && !args.hintAccepted;
  const isHintProvider = args.hasAnswered && theyRequestedHint && !!args.hintAccepted;
  const canEliminate =
    isHintProvider && args.eliminatedOptions.length < PVP_HINT_ELIMINATION_PICKS;

  return {
    canRequestHint:
      !args.hasAnswered && args.opponentHasAnswered && !args.hintRequestedBy,
    iRequestedHint,
    theyRequestedHint,
    hintAccepted: !!args.hintAccepted,
    canAcceptHint,
    isHintProvider,
    canEliminate,
  };
}

/** Resolve the viewer's and opponent's display names for the scoreboard. */
export function deriveScoreNames(
  isChallenger: boolean,
  challenger: DuelPlayerSummary | null,
  opponent: DuelPlayerSummary | null
): { myName: string; theirName: string } {
  return {
    myName: formatVisibleUser(isChallenger ? challenger : opponent, "You"),
    theirName: formatVisibleUser(isChallenger ? opponent : challenger, "Opponent"),
  };
}
