const RESEMBLE_BASE_URL = "https://app.resemble.ai/api/v2";
const RESEMBLE_PROJECT_UUID = "5d2d9092";
const RESEMBLE_VOICE_UUID = "a253156d";
const RESEMBLE_TIMEOUT_MS = 30_000;
const RESEMBLE_MAX_POLL_ATTEMPTS = 30;
const RESEMBLE_POLL_INTERVAL_MS = 500;

export { RESEMBLE_TIMEOUT_MS };

export function getResembleApiKey(): string | null {
  const apiKey = process.env.RESEMBLE_API_KEY;
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

async function createResembleClip(
  text: string,
  signal: AbortSignal,
  apiKey: string
): Promise<{ uuid: string; audio_src?: string } | null> {
  const response = await fetch(
    `${RESEMBLE_BASE_URL}/projects/${RESEMBLE_PROJECT_UUID}/clips`,
    {
      method: "POST",
      headers: getResembleHeaders(apiKey),
      body: JSON.stringify({
        voice_uuid: RESEMBLE_VOICE_UUID,
        body: text,
        is_public: false,
        is_archived: false,
      }),
      signal,
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    console.error("[Theme TTS] Resemble clip create failed:", errorText);
    return null;
  }

  const data = await response.json();
  return data.item || data.data || data;
}

async function waitForResembleAudio(
  clipUuid: string,
  signal: AbortSignal,
  apiKey: string
): Promise<string | null> {
  for (let i = 0; i < RESEMBLE_MAX_POLL_ATTEMPTS; i += 1) {
    if (signal.aborted) {
      const abortError = new Error("Aborted");
      abortError.name = "AbortError";
      throw abortError;
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
      console.error("[Theme TTS] Resemble clip poll failed");
      return null;
    }

    const data = await response.json();
    const clip = data.item || data.data || data;

    if (clip.audio_src) {
      return clip.audio_src as string;
    }

    await new Promise((resolve) => setTimeout(resolve, RESEMBLE_POLL_INTERVAL_MS));
  }

  console.error("[Theme TTS] Resemble clip poll timeout");
  return null;
}

export async function generateResembleTTS(
  text: string,
  signal: AbortSignal,
  apiKey: string
): Promise<ArrayBuffer | null> {
  const clip = await createResembleClip(text, signal, apiKey);
  if (!clip) return null;

  const audioUrl = clip.audio_src || (await waitForResembleAudio(clip.uuid, signal, apiKey));
  if (!audioUrl) return null;

  const audioResponse = await fetch(audioUrl, { signal });
  if (!audioResponse.ok) {
    console.error("[Theme TTS] Resemble audio download failed");
    return null;
  }

  return audioResponse.arrayBuffer();
}