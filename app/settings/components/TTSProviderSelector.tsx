"use client";

import { useAppearanceColors } from "@/app/components/AppearanceProvider";
import { useTTSProvider, type TtsProvider } from "../hooks/useTTSProvider";
import { TTS_PROVIDER_IDS, TTS_PROVIDER_OPTIONS } from "@/lib/tts/providers";

const TTS_PROVIDER_ICONS: Record<TtsProvider, string> = {
  [TTS_PROVIDER_IDS.RESEMBLE]: "🗣️",
  [TTS_PROVIDER_IDS.ELEVENLABS]: "🎙️",
};

const DISABLED_TTS_PROVIDERS = new Set<TtsProvider>([TTS_PROVIDER_IDS.ELEVENLABS]);

/**
 * TTSProviderSelector - Allows users to select their preferred TTS provider
 */
export function TTSProviderSelector() {
  const colors = useAppearanceColors();
  const { provider, setProvider, isUpdating } = useTTSProvider();

  return (
    <section
      className="rounded-2xl border-2 overflow-hidden"
      style={{
        backgroundColor: colors.background.elevated,
        borderColor: colors.primary.dark,
      }}
    >
      <div
        className="px-4 py-3 border-b-2"
        style={{ borderColor: colors.primary.dark }}
      >
        <h2
          className="text-lg font-bold uppercase tracking-wide"
          style={{ color: colors.text.DEFAULT }}
        >
          Voice Provider
        </h2>
        <p className="text-xs mt-1" style={{ color: colors.text.muted }}>
          Choose your text-to-speech engine
        </p>
      </div>

      <div className="p-4 grid gap-2">
        {TTS_PROVIDER_OPTIONS.map((option) => {
          const isActive = option.id === provider;
          const isDisabledProvider = DISABLED_TTS_PROVIDERS.has(option.id);
          const isDisabled = isUpdating || isDisabledProvider;

          return (
            <button
              key={option.id}
              onClick={() => {
                if (isDisabledProvider) return;
                void setProvider(option.id);
              }}
              disabled={isDisabled}
              className="w-full flex items-center justify-between rounded-xl border-2 px-3 py-3 transition hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                backgroundColor: isActive
                  ? `${colors.primary.DEFAULT}26`
                  : colors.background.DEFAULT,
                borderColor: isActive ? colors.primary.DEFAULT : colors.primary.dark,
              }}
              aria-pressed={isActive}
              data-testid={`settings-tts-${option.id}`}
            >
              <div className="flex items-center gap-3">
                <span className="text-xl">{TTS_PROVIDER_ICONS[option.id]}</span>
                <div className="text-left">
                  <span
                    className="text-sm font-semibold uppercase tracking-wide block"
                    style={{ color: colors.text.DEFAULT }}
                  >
                    {option.label}
                  </span>
                  <span
                    className="text-xs"
                    style={{ color: colors.text.muted }}
                  >
                    {option.description}
                  </span>
                </div>
              </div>
              {isDisabledProvider ? (
                /**
                 * ELEVENLABS DISABLED PROVIDER NOTE:
                 * The ElevenLabs settings button is intentionally disabled because
                 * ElevenLabs is not currently relevant for the product. If a future
                 * agent re-enables this provider, also revisit the production Sentry
                 * cron monitor in `netlify/functions/critical-provider-health.mjs`
                 * and decide whether ElevenLabs should be added back to the critical
                 * provider health check. Search terms: ElevenLabs, disabled TTS
                 * provider, TTSProviderSelector, critical-provider-health.
                 */
                <span
                  className="text-[11px] uppercase tracking-widest"
                  style={{ color: colors.text.muted }}
                >
                  Disabled
                </span>
              ) : isActive ? (
                <span
                  className="text-[11px] uppercase tracking-widest"
                  style={{ color: colors.secondary.light }}
                >
                  Active
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </section>
  );
}
