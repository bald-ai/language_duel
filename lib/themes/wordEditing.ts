import type { FieldType } from "@/lib/themes/api";
import type { WordEntry } from "@/lib/types";

export function areThemeWordsEqual(left: readonly WordEntry[], right: readonly WordEntry[]): boolean {
  if (left.length !== right.length) return false;

  for (let i = 0; i < left.length; i += 1) {
    const leftWord = left[i];
    const rightWord = right[i];

    if (!leftWord || !rightWord) return false;
    if (leftWord.word !== rightWord.word) return false;
    if (leftWord.answer !== rightWord.answer) return false;
    if ((leftWord.ttsStorageId ?? undefined) !== (rightWord.ttsStorageId ?? undefined)) return false;

    if (leftWord.wrongAnswers.length !== rightWord.wrongAnswers.length) return false;
    for (let j = 0; j < leftWord.wrongAnswers.length; j += 1) {
      if (leftWord.wrongAnswers[j] !== rightWord.wrongAnswers[j]) return false;
    }
  }

  return true;
}

export function getWordFieldValue(word: WordEntry, field: FieldType, wrongIndex = 0): string {
  if (field === "word") return word.word;
  if (field === "answer") return word.answer;
  return word.wrongAnswers[wrongIndex] ?? "";
}

export function invalidateWordTtsIfNeeded(previousWord: WordEntry, nextWord: WordEntry): WordEntry {
  const hasWordOrAnswerChange =
    previousWord.word !== nextWord.word || previousWord.answer !== nextWord.answer;

  if (!hasWordOrAnswerChange || nextWord.ttsStorageId === undefined) {
    return nextWord;
  }

  const { ttsStorageId: _dropTtsStorageId, ...withoutTts } = nextWord;
  return withoutTts;
}

export function applyGeneratedWordEdit(params: {
  previousWord: WordEntry;
  field: FieldType;
  generatedValue: string;
  generatedWordData: WordEntry | null;
  wrongIndex: number;
}): WordEntry {
  const { previousWord, field, generatedValue, generatedWordData, wrongIndex } = params;

  if (field === "word") {
    return generatedWordData
      ? invalidateWordTtsIfNeeded(previousWord, generatedWordData)
      : previousWord;
  }

  if (field === "answer") {
    return invalidateWordTtsIfNeeded(previousWord, {
      ...previousWord,
      answer: generatedValue,
    });
  }

  const wrongAnswers = [...previousWord.wrongAnswers];
  wrongAnswers[wrongIndex] = generatedValue;
  return { ...previousWord, wrongAnswers };
}

export function applyManualWordEdit(params: {
  previousWord: WordEntry;
  field: FieldType;
  manualValue: string;
  wrongIndex: number;
}): WordEntry {
  const { previousWord, field, manualValue, wrongIndex } = params;

  if (field === "word") {
    return invalidateWordTtsIfNeeded(previousWord, {
      ...previousWord,
      word: manualValue,
    });
  }

  if (field === "answer") {
    return invalidateWordTtsIfNeeded(previousWord, {
      ...previousWord,
      answer: manualValue,
    });
  }

  const wrongAnswers = [...previousWord.wrongAnswers];
  wrongAnswers[wrongIndex] = manualValue;
  return { ...previousWord, wrongAnswers };
}

export function applyRegeneratedManualWord(params: {
  previousWord: WordEntry;
  pendingWord: string;
  answer: string;
  wrongAnswers: string[];
}): WordEntry {
  return invalidateWordTtsIfNeeded(params.previousWord, {
    word: params.pendingWord,
    answer: params.answer,
    wrongAnswers: params.wrongAnswers,
  });
}
