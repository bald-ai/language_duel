/**
 * Context Clues prototype — a single-player "deduce the answer from a short
 * Spanish text" game. Three modes, each grounded in a different evidence-based
 * comprehensible-input method:
 *  - infer_word:      infer an unknown word's meaning from the surrounding sentence
 *  - story_detective: answer a comprehension question about a tiny passage
 *  - spot_pattern:    induce a grammar rule from examples, then apply it
 */

export type ContextCluesVariant = "infer_word" | "story_detective" | "spot_pattern";

export interface ContextCluesOption {
  text: string;
  isCorrect: boolean;
}

interface ContextCluesItemBase {
  /** Globally unique id, also used to seed option shuffling. */
  id: string;
  /** Three answer options; exactly one has isCorrect: true. */
  options: ContextCluesOption[];
  /** Shown after answering: restates the clue / confirms the rule. */
  explanation: string;
}

export interface InferWordItem extends ContextCluesItemBase {
  variant: "infer_word";
  /** Full Spanish sentence. `target` must appear in it verbatim. */
  sentence: string;
  /** The single Spanish word the learner deduces. */
  target: string;
  /** English context with the target's meaning blanked, e.g. "The ___ runs." */
  glossWithBlank: string;
}

export interface StoryDetectiveItem extends ContextCluesItemBase {
  variant: "story_detective";
  /** Short, simple Spanish passage, one sentence per line. */
  passage: string[];
  /** English comprehension question answerable from the passage alone. */
  question: string;
}

export interface PatternExample {
  from: string;
  to: string;
}

export interface SpotPatternItem extends ContextCluesItemBase {
  variant: "spot_pattern";
  /** Worked examples that isolate one rule. */
  examples: PatternExample[];
  /** The new case to transform, e.g. "un coche → ?". */
  prompt: string;
}

export type ContextCluesItem = InferWordItem | StoryDetectiveItem | SpotPatternItem;

export interface PreparedOption {
  id: string;
  text: string;
  isCorrect: boolean;
}

export interface PreparedItem {
  item: ContextCluesItem;
  options: PreparedOption[];
}

export type RoundStatus = "answering" | "answered" | "complete";

export interface ContextCluesRound {
  variant: ContextCluesVariant;
  items: PreparedItem[];
  index: number;
  selectedOptionId: string | null;
  status: RoundStatus;
  correctCount: number;
}

export interface VariantMeta {
  variant: ContextCluesVariant;
  label: string;
  tagline: string;
  instruction: string;
}
