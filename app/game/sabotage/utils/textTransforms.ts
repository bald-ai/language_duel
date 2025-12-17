// Text transformation utilities for sabotage effects

export function reverseText(text: string): string {
  return Array.from(text).reverse().join("");
}

export function scrambleTextKeepSpaces(text: string): string {
  const chars = Array.from(text);
  const letters = chars.filter((c) => c !== " ");
  for (let i = letters.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [letters[i], letters[j]] = [letters[j], letters[i]];
  }
  let letterIndex = 0;
  return chars.map((c) => (c === " " ? " " : (letters[letterIndex++] ?? ""))).join("");
}

