import type { Id } from "../convex/_generated/dataModel";

export interface SessionWordEntry {
  word: string;
  answer: string;
  wrongAnswers: string[];
  ttsStorageId?: Id<"_storage">;
  themeId: Id<"themes">;
  themeName: string;
}

export interface SessionThemeInput {
  _id: Id<"themes">;
  name: string;
  words: Array<{
    word: string;
    answer: string;
    wrongAnswers: string[];
    ttsStorageId?: Id<"_storage">;
  }>;
}

export function buildSessionWords(themes: SessionThemeInput[]): SessionWordEntry[] {
  return themes.flatMap((theme) =>
    theme.words.map((word) => ({
      ...word,
      themeId: theme._id,
      themeName: theme.name,
    }))
  );
}

export function getUniqueThemeIds(
  sessionWords: Array<Pick<SessionWordEntry, "themeId">>
): Id<"themes">[] {
  const seen = new Set<string>();
  const themeIds: Id<"themes">[] = [];

  for (const word of sessionWords) {
    const key = String(word.themeId);
    if (seen.has(key)) continue;
    seen.add(key);
    themeIds.push(word.themeId);
  }

  return themeIds;
}

export function getUniqueThemeNames(
  sessionWords: Array<Pick<SessionWordEntry, "themeName" | "themeId">>
): string[] {
  const seen = new Set<string>();
  const themeNames: string[] = [];

  for (const word of sessionWords) {
    const key = `${String(word.themeId)}:${word.themeName}`;
    if (seen.has(key)) continue;
    seen.add(key);
    themeNames.push(word.themeName);
  }

  return themeNames;
}

export function summarizeThemeNames(themeNames: string[]): string {
  if (themeNames.length === 0) return "Theme";
  if (themeNames.length === 1) return themeNames[0];
  if (themeNames.length === 2) return `${themeNames[0]} + ${themeNames[1]}`;
  return `${themeNames[0]} + ${themeNames.length - 1} more themes`;
}

export function summarizeThemes(themes: Array<Pick<SessionThemeInput, "name">>): string {
  return summarizeThemeNames(themes.map((theme) => theme.name));
}
