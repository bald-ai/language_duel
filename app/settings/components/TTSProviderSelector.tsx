"use client";

import { colors } from "@/lib/theme";
import { useTTSProvider, type TtsProvider } from "../hooks/useTTSProvider";

const TTS_PROVIDERS: Array<{
    id: TtsProvider;
    label: string;
    description: string;
    icon: string;
}> = [
        {
            id: "resemble",
            label: "Resemble AI",
            description: "High quality, slow",
            icon: "🗣️",
        },
        {
            id: "elevenlabs",
            label: "ElevenLabs",
            description: "Fast, normal quality",
            icon: "🎙️",
        },
    ];

/**
 * TTSProviderSelector - Allows users to select their preferred TTS provider
 */
export function TTSProviderSelector() {
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
                {TTS_PROVIDERS.map((option) => {
                    const isActive = option.id === provider;

                    return (
                        <button
                            key={option.id}
                            onClick={() => setProvider(option.id)}
                            disabled={isUpdating}
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
                                <span className="text-xl">{option.icon}</span>
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
                            {isActive && (
                                <span
                                    className="text-[11px] uppercase tracking-widest"
                                    style={{ color: colors.secondary.light }}
                                >
                                    Active
                                </span>
                            )}
                        </button>
                    );
                })}
            </div>
        </section>
    );
}
