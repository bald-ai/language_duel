/**
 * Static mock data for the "tap a word to keep it permanently translated"
 * feature exploration. NOT wired to Convex — these screens are visual mocks so
 * the maintainer can compare layouts. Each sentence carries word-level glosses
 * and a `defaultPinned` set (usually the connector/filler words we don't care
 * about teaching: ands, buts, ors).
 */

export interface MockWord {
  es: string;
  en: string;
  /** Connector / filler word we don't really teach (and, but, or, not…). */
  connector?: boolean;
}

export interface MockSentence {
  englishPrompt: string;
  words: MockWord[];
  /** Word indices that start out "freed" (perma-translated). */
  defaultPinned: number[];
}

export const MOCK_THEME_NAME = "Café Talk";

export const MOCK_SENTENCES: MockSentence[] = [
  {
    englishPrompt: "I want coffee but I have no money",
    words: [
      { es: "Quiero", en: "I want" },
      { es: "café", en: "coffee" },
      { es: "pero", en: "but", connector: true },
      { es: "no", en: "no", connector: true },
      { es: "tengo", en: "I have" },
      { es: "dinero", en: "money" },
    ],
    defaultPinned: [2, 3],
  },
  {
    englishPrompt: "She is tired and wants to sleep",
    words: [
      { es: "Ella", en: "she" },
      { es: "está", en: "is" },
      { es: "cansada", en: "tired" },
      { es: "y", en: "and", connector: true },
      { es: "quiere", en: "wants" },
      { es: "dormir", en: "to sleep" },
    ],
    defaultPinned: [3],
  },
  {
    englishPrompt: "We can eat now or later",
    words: [
      { es: "Podemos", en: "we can" },
      { es: "comer", en: "to eat" },
      { es: "ahora", en: "now" },
      { es: "o", en: "or", connector: true },
      { es: "más", en: "more", connector: true },
      { es: "tarde", en: "late" },
    ],
    defaultPinned: [3, 4],
  },
];

/** The single sentence used to demo the in-duel variants. */
export const MOCK_DUEL_SENTENCE: MockSentence = MOCK_SENTENCES[0];
