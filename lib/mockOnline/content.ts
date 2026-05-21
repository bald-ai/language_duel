// Basic Spanish content baked into the prototype so it has no dependency on the
// real themes/words system. Small curated sets, enough for a quick duel.

export interface MemoryPair {
  es: string;
  en: string;
}

export const MEMORY_PAIRS: readonly MemoryPair[] = [
  { es: "casa", en: "house" },
  { es: "perro", en: "dog" },
  { es: "gato", en: "cat" },
  { es: "agua", en: "water" },
  { es: "libro", en: "book" },
  { es: "sol", en: "sun" },
];

export interface McqContentQuestion {
  prompt: string;
  sentenceStart?: string;
  sentenceEnd?: string;
  options: string[];
  correct: string;
}

export const MISSING_CHUNK_QUESTIONS: readonly McqContentQuestion[] = [
  { prompt: "I want water.", sentenceStart: "Yo", sentenceEnd: "agua.", options: ["quiero", "tengo", "bebo"], correct: "quiero" },
  { prompt: "We are at home.", sentenceStart: "Nosotros estamos", sentenceEnd: "casa.", options: ["en", "con", "para"], correct: "en" },
  { prompt: "She eats with friends.", sentenceStart: "Ella come", sentenceEnd: "amigos.", options: ["con", "sin", "sobre"], correct: "con" },
  { prompt: "I have a dog.", sentenceStart: "Yo", sentenceEnd: "un perro.", options: ["tengo", "quiero", "soy"], correct: "tengo" },
  { prompt: "The book is on the table.", sentenceStart: "El libro está", sentenceEnd: "la mesa.", options: ["sobre", "bajo", "entre"], correct: "sobre" },
  { prompt: "They go to the park.", sentenceStart: "Ellos", sentenceEnd: "al parque.", options: ["van", "vienen", "salen"], correct: "van" },
];

export const SPEED_QUESTIONS: readonly McqContentQuestion[] = [
  { prompt: "dog", options: ["perro", "gato", "pez"], correct: "perro" },
  { prompt: "house", options: ["casa", "calle", "coche"], correct: "casa" },
  { prompt: "water", options: ["agua", "fuego", "aire"], correct: "agua" },
  { prompt: "cat", options: ["gato", "perro", "ratón"], correct: "gato" },
  { prompt: "sun", options: ["sol", "luna", "mar"], correct: "sol" },
  { prompt: "book", options: ["libro", "mesa", "silla"], correct: "libro" },
  { prompt: "red", options: ["rojo", "azul", "verde"], correct: "rojo" },
  { prompt: "big", options: ["grande", "pequeño", "alto"], correct: "grande" },
];

export interface OrderContentRound {
  english: string;
  correct: string[];
}

export const REBUILD_SENTENCES: readonly OrderContentRound[] = [
  { english: "I want water", correct: ["Yo", "quiero", "agua"] },
  { english: "She has a cat", correct: ["Ella", "tiene", "un", "gato"] },
  { english: "We are at home", correct: ["Nosotros", "estamos", "en", "casa"] },
  { english: "The dog is big", correct: ["El", "perro", "es", "grande"] },
  { english: "I read a book", correct: ["Yo", "leo", "un", "libro"] },
];
