import { hashSeed, seededShuffle } from "@/lib/prng";
import { CONTEXT_CLUES_CONTENT } from "./content";
import type {
  ContextCluesItem,
  ContextCluesRound,
  ContextCluesVariant,
  PreparedItem,
  PreparedOption,
} from "./types";

export function getItems(variant: ContextCluesVariant): ContextCluesItem[] {
  return CONTEXT_CLUES_CONTENT[variant];
}

/** Assigns stable option ids, then shuffles so the correct answer moves around. */
export function prepareItem(item: ContextCluesItem, seed: number): PreparedItem {
  const options: PreparedOption[] = item.options.map((option, index) => ({
    id: `${item.id}-o${index}`,
    text: option.text,
    isCorrect: option.isCorrect,
  }));
  return {
    item,
    options: seededShuffle(options, hashSeed(`${item.id}::${seed}`)),
  };
}

export function createRound(variant: ContextCluesVariant, seed = 1): ContextCluesRound {
  const items = getItems(variant).map((item, index) => prepareItem(item, seed + index));
  return {
    variant,
    items,
    index: 0,
    selectedOptionId: null,
    status: "answering",
    correctCount: 0,
  };
}

export function currentItem(round: ContextCluesRound): PreparedItem {
  return round.items[round.index];
}

export function selectedOption(round: ContextCluesRound): PreparedOption | null {
  if (round.selectedOptionId === null) return null;
  return currentItem(round).options.find((option) => option.id === round.selectedOptionId) ?? null;
}

export function isSelectionCorrect(round: ContextCluesRound): boolean {
  return selectedOption(round)?.isCorrect ?? false;
}

export function answerOption(round: ContextCluesRound, optionId: string): ContextCluesRound {
  if (round.status !== "answering") return round;
  const option = currentItem(round).options.find((candidate) => candidate.id === optionId);
  if (!option) return round;
  return {
    ...round,
    selectedOptionId: optionId,
    status: "answered",
    correctCount: round.correctCount + (option.isCorrect ? 1 : 0),
  };
}

export function advanceRound(round: ContextCluesRound): ContextCluesRound {
  if (round.status !== "answered") return round;
  const isLast = round.index === round.items.length - 1;
  if (isLast) {
    return { ...round, status: "complete" };
  }
  return {
    ...round,
    index: round.index + 1,
    selectedOptionId: null,
    status: "answering",
  };
}

export function isLastItem(round: ContextCluesRound): boolean {
  return round.index === round.items.length - 1;
}
