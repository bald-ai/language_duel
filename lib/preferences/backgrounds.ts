export const VALID_BACKGROUNDS = ["background.jpg", "background_2.jpg"] as const;

export type BackgroundFilename = (typeof VALID_BACKGROUNDS)[number];

export const DEFAULT_BACKGROUND = VALID_BACKGROUNDS[0];

export function isValidBackground(value: string): value is BackgroundFilename {
  return (VALID_BACKGROUNDS as readonly string[]).includes(value);
}
