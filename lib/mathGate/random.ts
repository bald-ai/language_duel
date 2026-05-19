import { mulberry32 } from "@/lib/prng";
import type { RandomFn } from "./types";

export function resolveRandom(options?: { seed?: number; random?: RandomFn }): RandomFn {
  if (options?.random) return options.random;
  if (options?.seed !== undefined) return mulberry32(options.seed);
  return Math.random;
}

export function randomInt(random: RandomFn, min: number, max: number): number {
  return Math.floor(random() * (max - min + 1)) + min;
}

export function pickOne<T>(random: RandomFn, items: readonly T[]): T {
  return items[randomInt(random, 0, items.length - 1)];
}

export function shuffleWithRandom<T>(random: RandomFn, items: readonly T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = randomInt(random, 0, i);
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}
