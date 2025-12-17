/**
 * Deterministic (pure) PRNG utilities to avoid Math.random during render
 * Used for consistent shuffling that doesn't change between renders
 */

/**
 * FNV-1a 32-bit hash function for seeding
 */
export const hashSeed = (input: string): number => {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
};

/**
 * Mulberry32 PRNG - returns a function that generates random numbers
 */
export const mulberry32 = (seed: number) => {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

/**
 * Shuffle array using seeded PRNG for deterministic results
 */
export const seededShuffle = <T>(arr: T[], seed: number): T[] => {
  const a = [...arr];
  const rand = mulberry32(seed);
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

/**
 * Generate a shuffled anagram for a word/phrase (spaces are preserved by caller)
 * Uses nonce to generate different shuffles
 */
export const generateAnagramLetters = (answer: string, nonce = 0): string[] => {
  const letters = answer.replace(/\s+/g, "").split("");
  if (letters.length <= 1) return letters;

  const seed = hashSeed(`${answer}::${nonce}`);
  let shuffled = seededShuffle(letters, seed);
  if (shuffled.join("") === letters.join("")) {
    shuffled = seededShuffle(letters, seed + 1);
  }
  return shuffled;
};

/**
 * Insert shuffled letters back into their spaced layout
 */
export const buildAnagramWithSpaces = (answer: string, shuffledLetters: string[]): string => {
  const withSpaces: string[] = [];
  let idx = 0;
  answer.split("").forEach((char) => {
    if (char === " ") {
      withSpaces.push(" ");
    } else {
      withSpaces.push(shuffledLetters[idx] || "");
      idx += 1;
    }
  });
  return withSpaces.join("");
};

