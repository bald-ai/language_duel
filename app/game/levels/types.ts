/**
 * Shared types for the Level input components (solo study mode).
 */

// Base props shared by all level components
export interface BaseLevelProps {
  answer: string;
  onSkip: () => void;
  dataTestIdBase?: string;
}

// Props for Level0 (intro/reveal mode)
export interface Level0Props {
  word: string;
  answer: string;
  onGotIt: () => void;
  onNotYet: () => void;
  dataTestIdBase?: string;
}

// Level 1 - Guided typing with letter slots
export interface Level1Props extends BaseLevelProps {
  onCorrect: (submittedAnswer: string) => void;
}

// Level 2 Typing - Free typing with dashes hint
export interface Level2TypingProps extends BaseLevelProps {
  onCorrect: (submittedAnswer: string) => void;
  onWrong: (submittedAnswer: string) => void;
}

// Level 2 Multiple Choice
export interface Level2MultipleChoiceProps extends BaseLevelProps {
  wrongAnswers: string[];
  onCorrect: (submittedAnswer: string) => void;
  onWrong: (submittedAnswer: string) => void;
}

// Level 3 - Free typing (hardest)
export interface Level3Props extends BaseLevelProps {
  onCorrect: (submittedAnswer: string) => void;
  onWrong: (submittedAnswer: string) => void;
}
