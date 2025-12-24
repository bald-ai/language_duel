"use client";

type DuelRole = "challenger" | "opponent";

interface UseDuelHintStateParams {
  duel?: {
    challengerAnswered?: boolean;
    opponentAnswered?: boolean;
    hintRequestedBy?: DuelRole | null;
    hintAccepted?: boolean | null;
    eliminatedOptions?: string[] | null;
  } | null;
  viewerRole?: DuelRole;
}

export interface DuelHintState {
  isChallenger: boolean;
  isOpponent: boolean;
  hasAnswered: boolean;
  opponentHasAnswered: boolean;
  hintRequestedBy: DuelRole | null;
  hintAccepted: boolean;
  eliminatedOptions: string[];
  canRequestHint: boolean;
  iRequestedHint: boolean;
  theyRequestedHint: boolean;
  canAcceptHint: boolean;
  isHintProvider: boolean;
  canEliminate: boolean;
}

export function useDuelHintState({ duel, viewerRole }: UseDuelHintStateParams): DuelHintState {
  const isChallenger = viewerRole === "challenger";
  const isOpponent = viewerRole === "opponent";

  const hasAnswered = isChallenger
    ? !!duel?.challengerAnswered
    : isOpponent
      ? !!duel?.opponentAnswered
      : false;
  const opponentHasAnswered = isChallenger
    ? !!duel?.opponentAnswered
    : isOpponent
      ? !!duel?.challengerAnswered
      : false;

  const hintRequestedBy = duel?.hintRequestedBy ?? null;
  const hintAccepted = !!duel?.hintAccepted;
  const eliminatedOptions = duel?.eliminatedOptions ?? [];

  const myRole = isChallenger ? "challenger" : isOpponent ? "opponent" : null;
  const theirRole = myRole ? (myRole === "challenger" ? "opponent" : "challenger") : null;

  const canRequestHint = !hasAnswered && opponentHasAnswered && !hintRequestedBy;
  const iRequestedHint = myRole ? hintRequestedBy === myRole : false;
  const theyRequestedHint = theirRole ? hintRequestedBy === theirRole : false;
  const canAcceptHint = hasAnswered && theyRequestedHint && !hintAccepted;
  const isHintProvider = hasAnswered && theyRequestedHint && hintAccepted;
  const canEliminate = isHintProvider && eliminatedOptions.length < 2;

  return {
    isChallenger,
    isOpponent,
    hasAnswered,
    opponentHasAnswered,
    hintRequestedBy,
    hintAccepted,
    eliminatedOptions,
    canRequestHint,
    iRequestedHint,
    theyRequestedHint,
    canAcceptHint,
    isHintProvider,
    canEliminate,
  };
}
