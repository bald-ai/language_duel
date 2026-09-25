import type { FieldType } from "@/lib/themes/api";
import type { WordEntry } from "@/lib/types";

import { arraysEqual, scalarArraysEqual } from "./arrayEquality";

function wordsEqual(left: WordEntry, right: WordEntry): boolean {
  if (!left || !right) return false;
  if (left.word !== right.word || left.answer !== right.answer) return false;
  if ((left.ttsStorageId ?? undefined) !== (right.ttsStorageId ?? undefined)) return false;
  return scalarArraysEqual(left.wrongAnswers, right.wrongAnswers);
}

export function areThemeWordsEqual(left: readonly WordEntry[], right: readonly WordEntry[]): boolean {
  return arraysEqual(left, right, wordsEqual);
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
