import type {
  ContextCluesItem,
  ContextCluesVariant,
  InferWordItem,
  SpotPatternItem,
  StoryDetectiveItem,
  VariantMeta,
} from "./types";

/**
 * Infer the meaning of the highlighted Spanish word from context.
 * Ordered easy → harder: a transparent cognate first to build confidence,
 * then sentences where the surrounding clue does the work.
 */
const INFER_WORD_ITEMS: InferWordItem[] = [
  {
    variant: "infer_word",
    id: "infer-doctor",
    sentence: "El doctor ayuda a las personas enfermas.",
    target: "doctor",
    glossWithBlank: "The ___ helps sick people.",
    options: [
      { text: "doctor", isCorrect: true },
      { text: "painter", isCorrect: false },
      { text: "driver", isCorrect: false },
    ],
    explanation: "“doctor” is a cognate — nearly the same word in English. Cognates are free vocabulary.",
  },
  {
    variant: "infer_word",
    id: "infer-perro",
    sentence: "El perro corre en el parque.",
    target: "perro",
    glossWithBlank: "The ___ runs in the park.",
    options: [
      { text: "dog", isCorrect: true },
      { text: "river", isCorrect: false },
      { text: "tree", isCorrect: false },
    ],
    explanation: "“corre” means runs — only a living thing runs in a park, so perro = dog.",
  },
  {
    variant: "infer_word",
    id: "infer-agua",
    sentence: "Bebo agua cuando tengo sed.",
    target: "agua",
    glossWithBlank: "I drink ___ when I am thirsty.",
    options: [
      { text: "water", isCorrect: true },
      { text: "bread", isCorrect: false },
      { text: "shoes", isCorrect: false },
    ],
    explanation: "You drink it when you are thirsty: agua = water.",
  },
  {
    variant: "infer_word",
    id: "infer-manzana",
    sentence: "Como una manzana roja y dulce.",
    target: "manzana",
    glossWithBlank: "I eat a sweet red ___.",
    options: [
      { text: "apple", isCorrect: true },
      { text: "chair", isCorrect: false },
      { text: "cloud", isCorrect: false },
    ],
    explanation: "Something red and sweet that you eat: manzana = apple.",
  },
  {
    variant: "infer_word",
    id: "infer-luna",
    sentence: "Por la noche, la luna brilla en el cielo.",
    target: "luna",
    glossWithBlank: "At night, the ___ shines in the sky.",
    options: [
      { text: "moon", isCorrect: true },
      { text: "fish", isCorrect: false },
      { text: "door", isCorrect: false },
    ],
    explanation: "It shines in the night sky: luna = moon.",
  },
  {
    variant: "infer_word",
    id: "infer-vuela",
    sentence: "El pájaro vuela sobre los árboles.",
    target: "vuela",
    glossWithBlank: "The bird ___ over the trees.",
    options: [
      { text: "flies", isCorrect: true },
      { text: "sleeps", isCorrect: false },
      { text: "eats", isCorrect: false },
    ],
    explanation: "A bird above the trees: vuela = flies.",
  },
];

/** Read a tiny Spanish passage, then answer using clues from the whole text. */
const STORY_DETECTIVE_ITEMS: StoryDetectiveItem[] = [
  {
    variant: "story_detective",
    id: "story-gato-negro",
    passage: ["María tiene un gato.", "El gato es negro.", "El gato bebe leche."],
    question: "What colour is María's cat?",
    options: [
      { text: "Black", isCorrect: true },
      { text: "White", isCorrect: false },
      { text: "Grey", isCorrect: false },
    ],
    explanation: "“El gato es negro” — negro = black.",
  },
  {
    variant: "story_detective",
    id: "story-pedro-futbol",
    passage: ["Pedro va a la escuela.", "Estudia matemáticas.", "Después juega al fútbol."],
    question: "What does Pedro do after studying?",
    options: [
      { text: "Plays soccer", isCorrect: true },
      { text: "Eats lunch", isCorrect: false },
      { text: "Goes home", isCorrect: false },
    ],
    explanation: "“Después juega al fútbol” — después = after, fútbol = soccer.",
  },
  {
    variant: "story_detective",
    id: "story-ana-playa",
    passage: ["Hoy hace mucho calor.", "Ana va a la playa.", "Nada en el mar."],
    question: "Where does Ana go?",
    options: [
      { text: "The beach", isCorrect: true },
      { text: "The mountains", isCorrect: false },
      { text: "The school", isCorrect: false },
    ],
    explanation: "“Ana va a la playa” — playa = beach (it is hot and she swims in the sea).",
  },
  {
    variant: "story_detective",
    id: "story-bebe-agua",
    passage: ["La familia come en la cocina.", "Hay sopa y pan.", "El bebé bebe agua."],
    question: "What is the baby drinking?",
    options: [
      { text: "Water", isCorrect: true },
      { text: "Soup", isCorrect: false },
      { text: "Milk", isCorrect: false },
    ],
    explanation: "“El bebé bebe agua” — agua = water, not the sopa on the table.",
  },
  {
    variant: "story_detective",
    id: "story-dos-perros",
    passage: ["Carlos tiene dos perros.", "Un perro es grande.", "El otro es pequeño."],
    question: "How many dogs does Carlos have?",
    options: [
      { text: "Two", isCorrect: true },
      { text: "One", isCorrect: false },
      { text: "Three", isCorrect: false },
    ],
    explanation: "“dos perros” — dos = two.",
  },
  {
    variant: "story_detective",
    id: "story-noche",
    passage: ["Es de noche.", "Las estrellas brillan.", "Todos duermen."],
    question: "What time of day is it?",
    options: [
      { text: "Night", isCorrect: true },
      { text: "Morning", isCorrect: false },
      { text: "Noon", isCorrect: false },
    ],
    explanation: "“Es de noche” — noche = night; the stars shine and everyone sleeps.",
  },
];

/** Induce the rule from the examples, apply it, then read the confirmed rule. */
const SPOT_PATTERN_ITEMS: SpotPatternItem[] = [
  {
    variant: "spot_pattern",
    id: "pattern-plural",
    examples: [
      { from: "un libro", to: "dos libros" },
      { from: "una flor", to: "tres flores" },
    ],
    prompt: "un coche → ?",
    options: [
      { text: "coches", isCorrect: true },
      { text: "cochs", isCorrect: false },
      { text: "coche", isCorrect: false },
    ],
    explanation: "Plurals add -s after a vowel and -es after a consonant. “coche” ends in a vowel → coches.",
  },
  {
    variant: "spot_pattern",
    id: "pattern-article",
    examples: [
      { from: "gato", to: "el gato" },
      { from: "casa", to: "la casa" },
    ],
    prompt: "perro → ?",
    options: [
      { text: "el perro", isCorrect: true },
      { text: "la perro", isCorrect: false },
      { text: "los perro", isCorrect: false },
    ],
    explanation: "Nouns ending in -o are usually masculine (el); -a usually feminine (la). perro → el perro.",
  },
  {
    variant: "spot_pattern",
    id: "pattern-ar-verb",
    examples: [
      { from: "hablar", to: "yo hablo" },
      { from: "cantar", to: "yo canto" },
    ],
    prompt: "bailar → ?",
    options: [
      { text: "yo bailo", isCorrect: true },
      { text: "yo baila", isCorrect: false },
      { text: "yo bailar", isCorrect: false },
    ],
    explanation: "For -ar verbs the “yo” form drops -ar and adds -o. bailar → bailo.",
  },
  {
    variant: "spot_pattern",
    id: "pattern-adjective",
    examples: [
      { from: "el gato (negro)", to: "el gato negro" },
      { from: "la casa (negro)", to: "la casa negra" },
    ],
    prompt: "la flor (rojo) → ?",
    options: [
      { text: "la flor roja", isCorrect: true },
      { text: "la flor rojo", isCorrect: false },
      { text: "la flor rojos", isCorrect: false },
    ],
    explanation: "Adjectives match the noun's gender. “flor” is feminine → roja.",
  },
  {
    variant: "spot_pattern",
    id: "pattern-gustar",
    examples: [
      { from: "el café", to: "me gusta el café" },
      { from: "los libros", to: "me gustan los libros" },
    ],
    prompt: "las flores → ?",
    options: [
      { text: "me gustan las flores", isCorrect: true },
      { text: "me gusta las flores", isCorrect: false },
      { text: "me gustas las flores", isCorrect: false },
    ],
    explanation: "Use “gusta” for one thing and “gustan” for plural. “las flores” is plural → me gustan.",
  },
];

export const CONTEXT_CLUES_CONTENT: Record<ContextCluesVariant, ContextCluesItem[]> = {
  infer_word: INFER_WORD_ITEMS,
  story_detective: STORY_DETECTIVE_ITEMS,
  spot_pattern: SPOT_PATTERN_ITEMS,
};

export const VARIANT_META: Record<ContextCluesVariant, VariantMeta> = {
  infer_word: {
    variant: "infer_word",
    label: "Infer the Word",
    tagline: "Deduce the highlighted word from context",
    instruction: "Read the sentence and use the clues to deduce what the highlighted Spanish word means.",
  },
  story_detective: {
    variant: "story_detective",
    label: "Story Detective",
    tagline: "Read the mini-story, crack the question",
    instruction: "Read the short Spanish story, then answer the question using clues from the text.",
  },
  spot_pattern: {
    variant: "spot_pattern",
    label: "Spot the Pattern",
    tagline: "Learn the rule from examples, then apply it",
    instruction: "Study the examples, work out the pattern, then pick the form that fits.",
  },
};
