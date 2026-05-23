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

export interface RelayContentWord {
  id: string;
  prompt: string;
  answer: string;
  // Five distractors so the answer grid renders six total options to match
  // the medium difficulty layout (1 correct + 5 wrong) from the main duel.
  distractors: string[];
}

// Shared pool the two players hand back and forth in Relay Duel. Every word
// is one point — relay does not vary scoring by difficulty.
export const RELAY_WORDS: readonly RelayContentWord[] = [
  { id: "airport", prompt: "airport", answer: "aeropuerto", distractors: ["estación", "puerto", "frontera", "carretera", "muelle"] },
  { id: "ticket", prompt: "ticket", answer: "billete", distractors: ["maleta", "asiento", "puerta", "tarjeta", "recibo"] },
  { id: "map", prompt: "map", answer: "mapa", distractors: ["carta", "calle", "libro", "plano", "guía"] },
  { id: "luggage", prompt: "luggage", answer: "equipaje", distractors: ["paquete", "mochila", "bolsa", "cajón", "maletero"] },
  { id: "bread", prompt: "bread", answer: "pan", distractors: ["leche", "queso", "huevo", "harina", "mantequilla"] },
  { id: "water", prompt: "water", answer: "agua", distractors: ["vino", "zumo", "café", "leche", "té"] },
  { id: "spicy", prompt: "spicy", answer: "picante", distractors: ["dulce", "salado", "amargo", "ácido", "soso"] },
  { id: "breakfast", prompt: "breakfast", answer: "desayuno", distractors: ["almuerzo", "cena", "merienda", "postre", "tentempié"] },
];
