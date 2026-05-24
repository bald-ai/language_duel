import {
  DEFAULT_TTS_PROVIDER,
  TTS_PROVIDER_IDS,
  type TtsProvider,
} from "./providers";

export const TTS_TIMEOUT_MS = 30_000;

const ELEVENLABS_VOICE_ID = "zl1Ut8dvwcVSuQSB9XkG";
const ELEVENLABS_MODEL_ID = "eleven_multilingual_v2";
const ELEVENLABS_OUTPUT_FORMAT = "mp3_44100_128";
const ELEVENLABS_VOICE_SETTINGS = {
  speed: 0.7,
  stability: 1,
} as const;

const RESEMBLE_BASE_URL = "https://app.resemble.ai/api/v2";
const RESEMBLE_PROJECT_UUID = "5d2d9092";
const RESEMBLE_VOICE_UUID = "a253156d";
const RESEMBLE_MAX_POLL_ATTEMPTS = 30;
const RESEMBLE_POLL_INTERVAL_MS = 500;
const RESEMBLE_VOICE_SETTINGS = {
  name: "spanish-teacher-preset",
  pace: 0.7,
  exaggeration: 0.5,
  temperature: 0.8,
  useHd: true,
  description: "Teacher demonstrating pronunciation",
} as const;

let cachedResemblePresetUuid: string | null = null;

export type TtsProviderAudio = {
  audioBuffer: ArrayBuffer;
  provider: TtsProvider;
  contentType: string;
};

type TtsProviderAdapter = {
  id: TtsProvider;
  contentType: string;
  isConfigured: () => boolean;
  generateAudio: (text: string, signal: AbortSignal) => Promise<ArrayBuffer | null>;
};

function readApiKey(envVar: string): string | null {
  const apiKey = process.env[envVar];
  if (!apiKey) return null;
  const trimmed = apiKey.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function getResembleHeaders(apiKey: string) {
  return {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  };
}

type ResemblePreset = { name: string; uuid: string };
type ResembleClip = { uuid: string; audio_src?: string };

// Resemble's API has returned the entity at the top level, nested under `item`,
// or nested under `data` across versions; normalize all three shapes here.
function extractResembleEntity<T>(data: unknown): T {
  if (data && typeof data === "object") {
    const record = data as Record<string, unknown>;
    if (record.item) return record.item as T;
    if (record.data) return record.data as T;
  }
  return data as T;
}

// The preset-list endpoint has returned a bare array, `{ data: [...] }`, or
// `{ items: [...] }`; normalize all three to a plain array.
function extractResemblePresetList(data: unknown): ResemblePreset[] {
  if (Array.isArray(data)) {
    return data as ResemblePreset[];
  }
  if (data && typeof data === "object") {
    const record = data as Record<string, unknown>;
    if (Array.isArray(record.data)) return record.data as ResemblePreset[];
    if (Array.isArray(record.items)) return record.items as ResemblePreset[];
  }
  return [];
}

export async function ensureRemoteResemblePreset(signal: AbortSignal): Promise<string | null> {
  if (cachedResemblePresetUuid) {
    return cachedResemblePresetUuid;
  }

  const apiKey = readApiKey("RESEMBLE_API_KEY");
  if (!apiKey) {
    return null;
  }

  try {
    const listResponse = await fetch(`${RESEMBLE_BASE_URL}/voice_settings_presets`, {
      method: "GET",
      headers: getResembleHeaders(apiKey),
      signal,
    });

    if (listResponse.ok) {
      const presets = extractResemblePresetList(await listResponse.json());
      const existingPreset = presets.find((preset) => preset.name === RESEMBLE_VOICE_SETTINGS.name);
      if (existingPreset) {
        cachedResemblePresetUuid = existingPreset.uuid;
        return existingPreset.uuid;
      }
    }

    const response = await fetch(`${RESEMBLE_BASE_URL}/voice_settings_presets`, {
      method: "POST",
      headers: getResembleHeaders(apiKey),
      body: JSON.stringify(RESEMBLE_VOICE_SETTINGS),
      signal,
    });

    const data = await response.json();
    if (!response.ok) {
      console.error("[Resemble TTS] Failed to create preset:", data);
      return null;
    }

    const preset = extractResembleEntity<ResemblePreset>(data);
    cachedResemblePresetUuid = preset.uuid;
    return preset.uuid;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw error;
    }
    console.error("[Resemble TTS] Preset error:", error);
    return null;
  }
}

async function createResembleClip(
  text: string,
  presetUuid: string | null,
  signal: AbortSignal,
  apiKey: string
): Promise<ResembleClip | null> {
  const requestBody: Record<string, unknown> = {
    voice_uuid: RESEMBLE_VOICE_UUID,
    body: text,
    is_public: false,
    is_archived: false,
  };

  if (presetUuid) {
    requestBody.voice_settings_preset_uuid = presetUuid;
  }

  const response = await fetch(`${RESEMBLE_BASE_URL}/projects/${RESEMBLE_PROJECT_UUID}/clips`, {
    method: "POST",
    headers: getResembleHeaders(apiKey),
    body: JSON.stringify(requestBody),
    signal,
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("[Resemble TTS] API error:", errorText);
    return null;
  }

  const data = await response.json();
  return extractResembleEntity<ResembleClip>(data);
}

async function waitForResembleAudio(
  clipUuid: string,
  signal: AbortSignal,
  apiKey: string
): Promise<string | null> {
  for (let i = 0; i < RESEMBLE_MAX_POLL_ATTEMPTS; i += 1) {
    if (signal.aborted) {
      throw new DOMException("Aborted", "AbortError");
    }

    const response = await fetch(
      `${RESEMBLE_BASE_URL}/projects/${RESEMBLE_PROJECT_UUID}/clips/${clipUuid}`,
      {
        method: "GET",
        headers: getResembleHeaders(apiKey),
        signal,
      }
    );

    if (!response.ok) {
      console.error("[Resemble TTS] Failed to check clip status");
      return null;
    }

    const data = await response.json();
    const clip = extractResembleEntity<ResembleClip>(data);

    if (clip.audio_src) {
      return clip.audio_src;
    }

    await new Promise((resolve) => setTimeout(resolve, RESEMBLE_POLL_INTERVAL_MS));
  }

  console.error("[Resemble TTS] Timeout waiting for audio");
  return null;
}

export async function generateResembleTtsAudio(
  text: string,
  signal: AbortSignal
): Promise<ArrayBuffer | null> {
  const apiKey = readApiKey("RESEMBLE_API_KEY");
  if (!apiKey) {
    console.error("[Resemble TTS] API key not configured");
    return null;
  }

  const presetUuid = await ensureRemoteResemblePreset(signal);
  const clip = await createResembleClip(text, presetUuid, signal, apiKey);
  if (!clip) return null;

  const audioUrl = clip.audio_src || (await waitForResembleAudio(clip.uuid, signal, apiKey));
  if (!audioUrl) return null;

  const audioResponse = await fetch(audioUrl, { signal });
  if (!audioResponse.ok) {
    console.error("[Resemble TTS] Failed to download audio");
    return null;
  }

  return audioResponse.arrayBuffer();
}

export async function generateElevenLabsTtsAudio(
  text: string,
  signal: AbortSignal
): Promise<ArrayBuffer | null> {
  const apiKey = readApiKey("ELEVENLABS_API_KEY");
  if (!apiKey) {
    console.error("[ElevenLabs TTS] API key not configured");
    return null;
  }

  const response = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${ELEVENLABS_VOICE_ID}?output_format=${ELEVENLABS_OUTPUT_FORMAT}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "xi-api-key": apiKey,
      },
      body: JSON.stringify({
        text,
        model_id: ELEVENLABS_MODEL_ID,
        voice_settings: ELEVENLABS_VOICE_SETTINGS,
      }),
      signal,
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    console.error("[ElevenLabs TTS] API error:", errorText);
    return null;
  }

  return response.arrayBuffer();
}

export function getTtsProviderAdapter(provider: TtsProvider): TtsProviderAdapter {
  if (provider === TTS_PROVIDER_IDS.ELEVENLABS) {
    return {
      id: TTS_PROVIDER_IDS.ELEVENLABS,
      contentType: "audio/mpeg",
      isConfigured: () => readApiKey("ELEVENLABS_API_KEY") !== null,
      generateAudio: generateElevenLabsTtsAudio,
    };
  }

  return {
    id: TTS_PROVIDER_IDS.RESEMBLE,
    contentType: "audio/wav",
    isConfigured: () => readApiKey("RESEMBLE_API_KEY") !== null,
    generateAudio: generateResembleTtsAudio,
  };
}

export async function generateTtsAudioWithFallback(params: {
  text: string;
  preferredProvider?: TtsProvider;
}): Promise<TtsProviderAudio | null> {
  const preferredProvider = params.preferredProvider ?? DEFAULT_TTS_PROVIDER;
  const fallbackProvider =
    preferredProvider === TTS_PROVIDER_IDS.RESEMBLE
      ? TTS_PROVIDER_IDS.ELEVENLABS
      : TTS_PROVIDER_IDS.RESEMBLE;

  // This function owns the request-timeout policy: a single AbortController is
  // aborted after TTS_TIMEOUT_MS and its signal is threaded into every provider
  // attempt, so the budget covers the preferred + fallback try together. Callers
  // no longer manage their own controller. An attempt aborted mid-flight surfaces
  // an AbortError, which propagates out of here so HTTP callers can map it to 504.
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TTS_TIMEOUT_MS);

  try {
    for (const provider of [preferredProvider, fallbackProvider]) {
      const adapter = getTtsProviderAdapter(provider);
      if (!adapter.isConfigured()) {
        continue;
      }

      const audioBuffer = await adapter.generateAudio(params.text, controller.signal);
      if (audioBuffer) {
        return {
          audioBuffer,
          provider: adapter.id,
          contentType: adapter.contentType,
        };
      }
    }

    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}
