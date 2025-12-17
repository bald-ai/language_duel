/**
 * Shared types for Level input components
 * These components work for both solo study and duel modes
 */

// Explicit game mode type
export type GameMode = "solo" | "duel";

// Base props shared by all level components
export interface BaseLevelProps {
  answer: string;
  onSkip: () => void;
  mode?: GameMode; // Explicit mode prop (optional for backwards compatibility)
}

// Props for Level0 (intro/reveal mode - solo only)
export interface Level0Props {
  word: string;
  answer: string;
  onGotIt: () => void;
  onNotYet: () => void;
}

// Hint system props - all optional (only used in duel mode)
// Note: onRequestHint is defined per-level since each has different signature
export interface HintProps {
  canRequestHint?: boolean;
  hintRequested?: boolean;
  hintAccepted?: boolean;
  hintType?: string;
  hintRevealedPositions?: number[];
  eliminatedOptions?: string[];
  onCancelHint?: () => void;
  onUpdateHintState?: (typedLetters: string[], revealedPositions: number[]) => void;
}

// Level 1 - Guided typing with letter slots
export interface Level1Props extends BaseLevelProps, HintProps {
  onCorrect: (submittedAnswer: string) => void;
  // L1 specific hint callback
  onRequestHint?: (typedLetters: string[], revealedPositions: number[]) => void;
}

// Level 2 Typing - Free typing with dashes hint
export interface Level2TypingProps extends BaseLevelProps, HintProps {
  onCorrect: (submittedAnswer: string) => void;
  onWrong: (submittedAnswer: string) => void;
  onRequestHint?: () => void;
}

// Level 2 Multiple Choice
export interface Level2MultipleChoiceProps extends BaseLevelProps, HintProps {
  wrongAnswers: string[];
  onCorrect: (submittedAnswer: string) => void;
  onWrong: (submittedAnswer: string) => void;
  onRequestHint?: (options: string[]) => void;
}

// Level 3 - Free typing (hardest)
export interface Level3Props extends BaseLevelProps {
  onCorrect: (submittedAnswer: string) => void;
  onWrong: (submittedAnswer: string) => void;
}

