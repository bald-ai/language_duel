/** The server must publish answer details before feedback or audio can reveal them. */
type WordAnswerDisclosure = {
  correctAnswer: string | null;
  hasNoneOption: boolean | null;
  hasAnswered: boolean;
  isLocked: boolean;
};

function hasPublishedAnswer(answers: WordAnswerDisclosure): boolean {
  return answers.correctAnswer !== null && answers.hasNoneOption !== null;
}

export function isWordAnswerFeedbackVisible(
  answers: WordAnswerDisclosure,
  hasFrozenRound: boolean,
  status: string,
): boolean {
  return (
    hasPublishedAnswer(answers) &&
    (answers.hasAnswered ||
      answers.isLocked ||
      hasFrozenRound ||
      status === "completed")
  );
}

export function canPlayWordAnswerAudio(
  answers: WordAnswerDisclosure,
  hasFrozenRound: boolean,
  phase: "idle" | "answering" | "transition",
): boolean {
  return (
    hasPublishedAnswer(answers) &&
    (answers.hasAnswered ||
      answers.isLocked ||
      (phase === "transition" && hasFrozenRound))
  );
}
