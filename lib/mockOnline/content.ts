// Basic Spanish content baked into the prototype so it has no dependency on the
// real themes/words system. Small curated sets, enough for a quick duel.

// Sentence Builder (co-op / duel). Short, simple sentences with no repeated
// word inside a sentence, so each tapped tile maps to one position. Each
// round ships with a few distractors (wrong tiles that don't belong in the
// sentence) so the board has bad options mixed in, not only the answer
// words. Distractors must not match any solution word in the same round, or
// the engine would accept them as correct picks.
export interface SentenceContentRound {
  english: string;
  correct: string[];
  distractors: string[];
}

export const SENTENCE_ROUNDS: readonly SentenceContentRound[] = [
  { english: "I drink water", correct: ["Yo", "bebo", "agua"], distractors: ["como", "tú", "leche"] },
  { english: "We eat bread", correct: ["Nosotros", "comemos", "pan"], distractors: ["bebemos", "Ellos", "queso"] },
  { english: "They speak Spanish", correct: ["Ellos", "hablan", "español"], distractors: ["Yo", "estudian", "inglés"] },
  { english: "She has a book", correct: ["Ella", "tiene", "un", "libro"], distractors: ["es", "mesa"] },
  { english: "The cat is small", correct: ["El", "gato", "es", "pequeño"], distractors: ["perro", "grande"] },
  { english: "The house is big", correct: ["La", "casa", "es", "grande"], distractors: ["calle", "pequeña"] },
  { english: "You have a dog", correct: ["Tú", "tienes", "un", "perro"], distractors: ["soy", "gato"] },
  { english: "I go to the park", correct: ["Yo", "voy", "al", "parque"], distractors: ["vamos", "casa"] },
];
