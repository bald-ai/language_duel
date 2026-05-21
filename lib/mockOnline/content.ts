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

export type RelayDifficulty = "easy" | "medium" | "hard";

export interface RelayContentWord {
  id: string;
  prompt: string;
  answer: string;
  distractors: string[];
  difficulty: RelayDifficulty;
}

// Shared pool the two players hand back and forth in Relay Duel.
export const RELAY_WORDS: readonly RelayContentWord[] = [
  { id: "airport", prompt: "airport", answer: "aeropuerto", distractors: ["estación", "puerto", "frontera"], difficulty: "hard" },
  { id: "ticket", prompt: "ticket", answer: "billete", distractors: ["maleta", "asiento", "puerta"], difficulty: "medium" },
  { id: "map", prompt: "map", answer: "mapa", distractors: ["carta", "calle", "libro"], difficulty: "easy" },
  { id: "luggage", prompt: "luggage", answer: "equipaje", distractors: ["paquete", "mochila", "bolsa"], difficulty: "hard" },
  { id: "bread", prompt: "bread", answer: "pan", distractors: ["leche", "queso", "huevo"], difficulty: "easy" },
  { id: "water", prompt: "water", answer: "agua", distractors: ["vino", "zumo", "café"], difficulty: "easy" },
  { id: "spicy", prompt: "spicy", answer: "picante", distractors: ["dulce", "salado", "amargo"], difficulty: "medium" },
  { id: "breakfast", prompt: "breakfast", answer: "desayuno", distractors: ["almuerzo", "cena", "merienda"], difficulty: "hard" },
];
