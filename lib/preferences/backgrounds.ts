export const BACKGROUND_OPTIONS = [
  { filename: "background.jpg", label: "Castle Lights" },
  { filename: "background_2.jpg", label: "Mystic Forest" },
] as const;

export type BackgroundFilename = (typeof BACKGROUND_OPTIONS)[number]["filename"];

export const VALID_BACKGROUNDS: readonly BackgroundFilename[] = BACKGROUND_OPTIONS.map(
  (option) => option.filename
);

export const DEFAULT_BACKGROUND = BACKGROUND_OPTIONS[0].filename;

export function isValidBackground(value: string): value is BackgroundFilename {
  return (VALID_BACKGROUNDS as readonly string[]).includes(value);
}
