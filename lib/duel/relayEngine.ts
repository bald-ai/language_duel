/**
 * Pure relay-duel rules: index-into-`itemOrder` engine that returns
 * `Partial<Doc<"duels">>` patches, mirroring the style of
 * `convex/rules/duelGameplayRules.ts`. Uses challenger/opponent roles plus
 * hard-upgrade / budget / answer-timeout — the real-duel mechanics.
 *
 * All indices below are positions into `itemOrder` — the same basis as
 * `duelQuestions` / `relayHardQuestions`, so the snapshot for an assigned
 * position is `set[assignedIndex]`.
 */

import type { Doc } from "../../convex/_generated/dataModel";
import type { DuelRole } from "../duelRole";
import { buildRelayQuestionSet, type DuelQuestionSnapshot } from "../answerShuffle";
import { RELAY_ANSWER_TIMEOUT_MS, RELAY_HARD_BUDGET_DIVISOR } from "../duelConstants";
import { SENTENCE_RELAY_TIMEOUT_MS } from "../themes/sentenceConstants";
import type { SessionItem } from "../sessionItems";

type RelayQuestion = NonNullable<Doc<"duels">["duelQuestions"]>[number];

export interface RelayInitialState {
  relayPicker: DuelRole;
  relayPhase: "pick";
  relayResolvedIndices: number[];
  relayHardUpgradeIndices: number[];
  relayHardBudget: { challenger: number; opponent: number };
  relayHardQuestions: DuelQuestionSnapshot[];
}

/** Each player's hard-upgrade tokens = ceil(poolSize / divisor) (decision #13). */
export function relayHardBudgetForPool(poolSize: number): number {
  return Math.ceil(poolSize / RELAY_HARD_BUDGET_DIVISOR);
}

/** Relay-specific fields set once at duel creation. The challenger picks first. */
export function buildInitialRelayState(
  items: SessionItem[],
  itemOrder: number[]
): RelayInitialState {
  const budget = relayHardBudgetForPool(itemOrder.length);
  // Mixed word + sentence decks are allowed. Every position is playable on its
  // own answer surface (MC grid for words, tile board for sentences), so no
  // pre-resolution is needed.
  return {
    relayPicker: "challenger",
    relayPhase: "pick",
    relayResolvedIndices: [],
    relayHardUpgradeIndices: [],
    relayHardBudget: { challenger: budget, opponent: budget },
    relayHardQuestions: buildRelayQuestionSet(items, itemOrder, "hard"),
  };
}

function otherRole(role: DuelRole): DuelRole {
  return role === "challenger" ? "opponent" : "challenger";
}

/** The rival of the current picker — the one who answers the handed word. */
export function relayAnswerer(duel: Pick<Doc<"duels">, "relayPicker">): DuelRole {
  return otherRole(duel.relayPicker ?? "challenger");
}

export function isRelayFinished(
  duel: Pick<Doc<"duels">, "itemOrder" | "relayResolvedIndices" | "relayAssignedIndex">
): boolean {
  const resolved = duel.relayResolvedIndices ?? [];
  return duel.relayAssignedIndex === undefined && resolved.length === duel.itemOrder.length;
}

/** Positions the picker may still hand over: unresolved and not currently assigned. */
export function relayRemainingPositions(
  duel: Pick<Doc<"duels">, "itemOrder" | "relayResolvedIndices" | "relayAssignedIndex">
): number[] {
  const resolved = new Set(duel.relayResolvedIndices ?? []);
  const remaining: number[] = [];
  for (let position = 0; position < duel.itemOrder.length; position++) {
    if (resolved.has(position)) continue;
    if (position === duel.relayAssignedIndex) continue;
    remaining.push(position);
  }
  return remaining;
}

/** The snapshot served for the assigned position, hard variant when upgraded. */
export function relayServedQuestion(
  duel: Pick<
    Doc<"duels">,
    "relayAssignedIndex" | "relayHardUpgradeIndices" | "duelQuestions" | "relayHardQuestions"
  >
): RelayQuestion | undefined {
  const position = duel.relayAssignedIndex;
  if (position === undefined) return undefined;
  const upgraded = (duel.relayHardUpgradeIndices ?? []).includes(position);
  const set = upgraded ? duel.relayHardQuestions : duel.duelQuestions;
  return set?.[position];
}

/**
 * The answer window for the currently served position: sentences get the longer
 * 60s window, words keep the 21s window. Single source used by the scheduler
 * delay, the stale-timeout check, and (mirrored client-side) the countdown.
 */
export function relayAnswerWindowMs(
  duel: Pick<
    Doc<"duels">,
    "relayAssignedIndex" | "relayHardUpgradeIndices" | "duelQuestions" | "relayHardQuestions"
  >
): number {
  const served = relayServedQuestion(duel);
  return served?.kind === "sentence" ? SENTENCE_RELAY_TIMEOUT_MS : RELAY_ANSWER_TIMEOUT_MS;
}

export function buildRelayPickPatch(params: {
  duel: Doc<"duels">;
  wordIndex: number;
  hardUpgrade: boolean;
  now: number;
}): Partial<Doc<"duels">> {
  const { duel, wordIndex, hardUpgrade, now } = params;
  const picker = duel.relayPicker ?? "challenger";

  const patch: Partial<Doc<"duels">> = {
    relayAssignedIndex: wordIndex,
    relayPhase: "answer",
    relayAnswerStartedAt: now,
  };

  if (hardUpgrade) {
    patch.relayHardUpgradeIndices = [...(duel.relayHardUpgradeIndices ?? []), wordIndex];
    const budget = duel.relayHardBudget ?? { challenger: 0, opponent: 0 };
    patch.relayHardBudget = {
      challenger:
        picker === "challenger" ? Math.max(0, budget.challenger - 1) : budget.challenger,
      opponent: picker === "opponent" ? Math.max(0, budget.opponent - 1) : budget.opponent,
    };
  }

  return patch;
}

export function buildRelayAnswerPatch(params: {
  duel: Doc<"duels">;
  value: string;
}): Partial<Doc<"duels">> {
  const { duel, value } = params;
  const question = relayServedQuestion(duel);
  const assignedIndex = duel.relayAssignedIndex;
  if (!question || assignedIndex === undefined) return {};
  // This builder serves the word-only MC path; sentence positions are scored by
  // `relaySentenceConfirm`, and the `relayAnswer` mutation rejects a sentence
  // served question before reaching here.
  if (question.kind !== "word") return {};

  const answerer = relayAnswerer(duel);
  const correct = value === question.correctOption;
  const scorer: DuelRole | null = correct ? answerer : null;

  const patch: Partial<Doc<"duels">> = {
    relayPhase: "feedback",
    relayAnswerStartedAt: undefined,
    relayTimeoutScheduledFunctionId: undefined,
    relayLastResult: { wordIndex: assignedIndex, chosen: value, correct, scorer },
  };

  if (scorer === "challenger") {
    patch.challengerScore = duel.challengerScore + question.points;
  } else if (scorer === "opponent") {
    patch.opponentScore = duel.opponentScore + question.points;
  }

  return patch;
}

/** Leave the feedback reveal: the rival who just answered becomes next picker. */
export function buildRelayAdvancePatch(duel: Doc<"duels">): Partial<Doc<"duels">> {
  return resolveAndHandOff(duel, {});
}

/**
 * Timeout: count the assigned word as wrong (no score) and resolve+advance in a
 * single step — the answerer is likely gone, so we never park in `feedback`
 * (decision #16). Identical hand-off to `buildRelayAdvancePatch`, plus clearing
 * the scheduled-timeout handle.
 */
export function buildRelayTimeoutPatch(duel: Doc<"duels">): Partial<Doc<"duels">> {
  return resolveAndHandOff(duel, { clearScheduledTimeout: true });
}

function resolveAndHandOff(
  duel: Doc<"duels">,
  opts: { clearScheduledTimeout?: boolean }
): Partial<Doc<"duels">> {
  const answerer = relayAnswerer(duel);
  const assignedIndex = duel.relayAssignedIndex;
  const resolved = duel.relayResolvedIndices ?? [];

  const patch: Partial<Doc<"duels">> = {
    relayPicker: answerer,
    relayPhase: "pick",
    relayAssignedIndex: undefined,
    relayResolvedIndices:
      assignedIndex === undefined ? resolved : [...resolved, assignedIndex],
    relayLastResult: undefined,
    relayAnswerStartedAt: undefined,
  };

  if (opts.clearScheduledTimeout) {
    patch.relayTimeoutScheduledFunctionId = undefined;
  }

  return patch;
}
