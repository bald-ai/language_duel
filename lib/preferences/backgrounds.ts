export const VALID_BACKGROUNDS = ["background.jpg", "background_2.jpg"] as const;

export type BackgroundFilename = (typeof VALID_BACKGROUNDS)[number];

export const DEFAULT_BACKGROUND = VALID_BACKGROUNDS[0];

export const BACKGROUND_OPTIONS: ReadonlyArray<{
  filename: BackgroundFilename;
  label: string;
}> = [
  { filename: "background.jpg", label: "Castle Lights" },
  { filename: "background_2.jpg", label: "Mystic Forest" },
];

export function isValidBackground(value: string): value is BackgroundFilename {
  return (VALID_BACKGROUNDS as readonly string[]).includes(value);
}
