import { stripIrr } from "@/lib/stringUtils";

export type TranslationDirection = "forward" | "reverse";

interface DirectionalWord {
  word: string;
  answer: string;
}

export function getDirectionalCopy(
  word: DirectionalWord,
  direction: TranslationDirection
) {
  if (direction === "reverse") {
    return {
      cueText: stripIrr(word.answer),
      helperText: "Translate to English",
      expectedAnswer: word.word,
      feedbackAnswer: word.word,
    };
  }

  return {
    cueText: word.word,
    helperText: "Translate to Spanish",
    expectedAnswer: word.answer,
    feedbackAnswer: word.answer,
  };
}
