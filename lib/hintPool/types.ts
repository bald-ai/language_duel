export const HINT_TYPES = [
  "fifty_fifty",
  "plus_ten_seconds",
  "anagram",
  "letter_count",
] as const;

export type HintType = (typeof HINT_TYPES)[number];

export type HintReveal =
  | { kind: "anagram"; value: string }
  | { kind: "letterCount"; value: number[] };

export type HintQuestion = {
  options: string[];
  correctOption: string;
};

export type HintEffect = {
  type: HintType;
  eliminatedOptions: string[];
  timerBonusSeconds: number;
  reveal?: HintReveal;
};
