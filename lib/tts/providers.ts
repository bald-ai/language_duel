export const TTS_PROVIDER_IDS = {
  RESEMBLE: "resemble",
  ELEVENLABS: "elevenlabs",
} as const;

export type TtsProvider = (typeof TTS_PROVIDER_IDS)[keyof typeof TTS_PROVIDER_IDS];

export const DEFAULT_TTS_PROVIDER: TtsProvider = TTS_PROVIDER_IDS.RESEMBLE;

export const TTS_PROVIDER_OPTIONS: Array<{
  id: TtsProvider;
  label: string;
  description: string;
}> = [
  {
    id: TTS_PROVIDER_IDS.RESEMBLE,
    label: "Resemble AI",
    description: "High quality, slow",
  },
  {
    id: TTS_PROVIDER_IDS.ELEVENLABS,
    label: "ElevenLabs",
    description: "Fast, normal quality",
  },
];

export function isTtsProvider(value: unknown): value is TtsProvider {
  return value === TTS_PROVIDER_IDS.RESEMBLE || value === TTS_PROVIDER_IDS.ELEVENLABS;
}

export function getTtsProviderLabel(provider: TtsProvider): string {
  return TTS_PROVIDER_OPTIONS.find((option) => option.id === provider)?.label ?? provider;
}
