/**
 * Hardcoded Spanish themes for the theme-sentences prototype.
 * Deliberately NOT connected to the real themes in Convex — this whole mock is
 * throwaway and read-nothing/write-nothing as far as the database goes.
 */

export interface MockThemeWord {
  word: string;
  answer: string;
}

export interface MockTheme {
  id: string;
  name: string;
  /** Accent color used to highlight this theme's words in generated sentences. */
  color: string;
  words: MockThemeWord[];
}

export const MOCK_THEMES: MockTheme[] = [
  {
    id: "food",
    name: "Food & Drink",
    color: "#f59e0b",
    words: [
      { word: "comer", answer: "to eat" },
      { word: "beber", answer: "to drink" },
      { word: "pan", answer: "bread" },
      { word: "queso", answer: "cheese" },
      { word: "manzana", answer: "apple" },
      { word: "café", answer: "coffee" },
      { word: "cena", answer: "dinner" },
      { word: "delicioso", answer: "delicious" },
    ],
  },
  {
    id: "travel",
    name: "Travel",
    color: "#38bdf8",
    words: [
      { word: "viajar", answer: "to travel" },
      { word: "tren", answer: "train" },
      { word: "maleta", answer: "suitcase" },
      { word: "playa", answer: "beach" },
      { word: "hotel", answer: "hotel" },
      { word: "billete", answer: "ticket" },
      { word: "mapa", answer: "map" },
      { word: "lejos", answer: "far" },
    ],
  },
  {
    id: "family",
    name: "Family",
    color: "#a78bfa",
    words: [
      { word: "madre", answer: "mother" },
      { word: "padre", answer: "father" },
      { word: "hermana", answer: "sister" },
      { word: "hermano", answer: "brother" },
      { word: "abuela", answer: "grandmother" },
      { word: "hijo", answer: "son" },
      { word: "familia", answer: "family" },
      { word: "visitar", answer: "to visit" },
    ],
  },
  {
    id: "emotions",
    name: "Emotions",
    color: "#fb7185",
    words: [
      { word: "feliz", answer: "happy" },
      { word: "triste", answer: "sad" },
      { word: "cansado", answer: "tired" },
      { word: "enojado", answer: "angry" },
      { word: "nervioso", answer: "nervous" },
      { word: "reír", answer: "to laugh" },
      { word: "llorar", answer: "to cry" },
      { word: "sentir", answer: "to feel" },
    ],
  },
  {
    id: "daily",
    name: "Daily Routine",
    color: "#4ade80",
    words: [
      { word: "despertarse", answer: "to wake up" },
      { word: "trabajar", answer: "to work" },
      { word: "dormir", answer: "to sleep" },
      { word: "ducharse", answer: "to shower" },
      { word: "temprano", answer: "early" },
      { word: "tarde", answer: "late" },
      { word: "siempre", answer: "always" },
      { word: "nunca", answer: "never" },
    ],
  },
];
