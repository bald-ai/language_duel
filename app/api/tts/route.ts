import { NextRequest, NextResponse } from 'next/server';
import { ConvexHttpClient } from 'convex/browser';
import { auth } from '@clerk/nextjs/server';
import { api } from '@/convex/_generated/api';
import { TTS_GENERATION_COST } from '@/lib/credits/constants';

export const runtime = 'nodejs';

// ============================================================================
// ELEVENLABS TTS Configuration
// ============================================================================
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
const ELEVENLABS_VOICE_ID = 'zl1Ut8dvwcVSuQSB9XkG';
const ELEVENLABS_MODEL_ID = 'eleven_multilingual_v2';
const ELEVENLABS_OUTPUT_FORMAT = 'mp3_44100_128';

const ELEVENLABS_VOICE_SETTINGS = {
  speed: 0.7,
  stability: 1,
} as const;

// ============================================================================
// RESEMBLE AI TTS Configuration (with Voice Settings Presets)
// ============================================================================
const RESEMBLE_API_KEY = process.env.RESEMBLE_API_KEY;
const RESEMBLE_BASE_URL = 'https://app.resemble.ai/api/v2';
const RESEMBLE_PROJECT_UUID = '5d2d9092';
const RESEMBLE_VOICE_UUID = 'a253156d'; // Jota - native Spanish voice

// Voice settings matching the UI configuration
const RESEMBLE_VOICE_SETTINGS = {
  name: 'spanish-teacher-preset',
  pace: 0.7, // 0.7x speaking pace (matches ElevenLabs)
  exaggeration: 0.5, // 0.5x exaggeration
  temperature: 0.8, // 0.8 temperature (Normal)
  useHd: true, // HD Quality enabled
  description: 'Teacher demonstrating pronunciation',
};

// Cache the preset UUID to avoid creating it on every request
let cachedResemblePresetUuid: string | null = null;

function getResembleHeaders() {
  return {
    Authorization: `Bearer ${RESEMBLE_API_KEY}`,
    'Content-Type': 'application/json',
  };
}

// Get or create voice settings preset for Resemble AI
async function getOrCreateResemblePreset(signal: AbortSignal): Promise<string | null> {
  // Return cached preset if available
  if (cachedResemblePresetUuid) {
    return cachedResemblePresetUuid;
  }

  try {
    // First, try to list existing presets to find our preset
    const listResponse = await fetch(`${RESEMBLE_BASE_URL}/voice_settings_presets`, {
      method: 'GET',
      headers: getResembleHeaders(),
      signal,
    });

    if (listResponse.ok) {
      const listData = await listResponse.json();

      // Handle different response structures (Resemble uses { success: true, data: [...] })
      let presets: Array<{ name: string; uuid: string }> = [];
      if (Array.isArray(listData)) {
        presets = listData;
      } else if (listData.data && Array.isArray(listData.data)) {
        presets = listData.data;
      } else if (listData.items && Array.isArray(listData.items)) {
        presets = listData.items;
      }

      // Look for our preset by name
      if (presets.length > 0) {
        const existingPreset = presets.find((p) => p.name === RESEMBLE_VOICE_SETTINGS.name);
        if (existingPreset) {
          cachedResemblePresetUuid = existingPreset.uuid;
          console.log(`[Resemble TTS] Using existing preset: ${existingPreset.uuid}`);
          return existingPreset.uuid;
        }
      }
    }

    // Create new preset if not found
    console.log('[Resemble TTS] Creating voice settings preset...');
    const response = await fetch(`${RESEMBLE_BASE_URL}/voice_settings_presets`, {
      method: 'POST',
      headers: getResembleHeaders(),
      body: JSON.stringify(RESEMBLE_VOICE_SETTINGS),
      signal,
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('[Resemble TTS] Failed to create preset:', data);
      return null;
    }

    const preset = data.item || data.data || data;
    cachedResemblePresetUuid = preset.uuid;
    console.log(`[Resemble TTS] Created preset: ${preset.uuid}`);
    return preset.uuid;
  } catch (error) {
    // Re-throw AbortError to be handled by caller
    if (error instanceof Error && error.name === 'AbortError') {
      throw error;
    }
    console.error('[Resemble TTS] Preset error:', error);
    return null;
  }
}

// Create a clip with Resemble AI using voice settings preset
async function createResembleClip(
  text: string,
  presetUuid: string | null,
  signal: AbortSignal
): Promise<{ uuid: string; audio_src?: string } | null> {
  const requestBody: Record<string, unknown> = {
    voice_uuid: RESEMBLE_VOICE_UUID,
    body: text,
    is_public: false,
    is_archived: false,
  };

  // Add voice settings preset if available
  if (presetUuid) {
    requestBody.voice_settings_preset_uuid = presetUuid;
  }

  const response = await fetch(`${RESEMBLE_BASE_URL}/projects/${RESEMBLE_PROJECT_UUID}/clips`, {
    method: 'POST',
    headers: getResembleHeaders(),
    body: JSON.stringify(requestBody),
    signal,
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('[Resemble TTS] API error:', errorText);
    return null;
  }

  const data = await response.json();
  return data.item || data.data || data;
}

// Wait for Resemble AI to process the audio
async function waitForResembleAudio(
  clipUuid: string,
  signal: AbortSignal,
  maxAttempts = 30
): Promise<string | null> {
  for (let i = 0; i < maxAttempts; i++) {
    // Check if aborted before each poll
    if (signal.aborted) {
      throw new DOMException('Aborted', 'AbortError');
    }

    const response = await fetch(
      `${RESEMBLE_BASE_URL}/projects/${RESEMBLE_PROJECT_UUID}/clips/${clipUuid}`,
      {
        method: 'GET',
        headers: getResembleHeaders(),
        signal,
      }
    );

    if (!response.ok) {
      console.error('[Resemble TTS] Failed to check clip status');
      return null;
    }

    const data = await response.json();
    const clip = data.item || data.data || data;

    if (clip.audio_src) {
      return clip.audio_src;
    }

    // Wait 500ms before next attempt
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  console.error('[Resemble TTS] Timeout waiting for audio');
  return null;
}

// Generate TTS using Resemble AI
async function generateResembleTTS(text: string, signal: AbortSignal): Promise<ArrayBuffer | null> {
  // Get or create voice settings preset
  const presetUuid = await getOrCreateResemblePreset(signal);

  // Create clip (with or without preset)
  const clip = await createResembleClip(text, presetUuid, signal);
  if (!clip) {
    return null;
  }

  // Get audio URL (may be available immediately or need to wait)
  const audioUrl = clip.audio_src || (await waitForResembleAudio(clip.uuid, signal));
  if (!audioUrl) {
    return null;
  }

  // Download the audio
  const audioResponse = await fetch(audioUrl, { signal });
  if (!audioResponse.ok) {
    console.error('[Resemble TTS] Failed to download audio');
    return null;
  }

  return audioResponse.arrayBuffer();
}

// Generate TTS using ElevenLabs
async function generateElevenLabsTTS(text: string, signal: AbortSignal): Promise<ArrayBuffer | null> {
  if (!ELEVENLABS_API_KEY) {
    console.error('[ElevenLabs TTS] API key not configured');
    return null;
  }

  const response = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${ELEVENLABS_VOICE_ID}?output_format=${ELEVENLABS_OUTPUT_FORMAT}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'xi-api-key': ELEVENLABS_API_KEY,
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
    console.error('[ElevenLabs TTS] API error:', errorText);
    return null;
  }

  return response.arrayBuffer();
}

// ============================================================================
// Shared Configuration
// ============================================================================
const CONVEX_URL = process.env.NEXT_PUBLIC_CONVEX_URL || '';
const MAX_TEXT_CHARS = 2000;
const TTS_TIMEOUT_MS = 30_000; // Increased for Resemble processing time

type TtsProvider = 'resemble' | 'elevenlabs';

async function getAuthedConvexClient() {
  if (!CONVEX_URL) {
    throw new Error('Convex URL not configured');
  }

  const authResult = await auth();
  if (!authResult.userId) {
    throw new Error('Unauthorized');
  }

  const token = await authResult.getToken({ template: 'convex' });
  if (!token) {
    throw new Error('Unauthorized');
  }

  const client = new ConvexHttpClient(CONVEX_URL);
  client.setAuth(token);
  return client;
}

async function getUserAndCredits(): Promise<{
  client: ConvexHttpClient;
  ttsProvider: TtsProvider;
}> {
  const client = await getAuthedConvexClient();
  const currentUser = await client.query(api.users.getCurrentUser, {});
  if (!currentUser) {
    throw new Error('Unauthorized');
  }
  if (currentUser.ttsGenerationsRemaining < TTS_GENERATION_COST) {
    throw new Error('TTS credits exhausted');
  }

  // Get user's TTS provider preference (default: resemble)
  const ttsProvider: TtsProvider = (currentUser.ttsProvider as TtsProvider) || 'resemble';

  return { client, ttsProvider };
}

async function consumeTtsCredit(client: ConvexHttpClient) {
  await client.mutation(api.users.consumeCredits, {
    creditType: 'tts',
    cost: TTS_GENERATION_COST,
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const textRaw = (body as { text?: unknown }).text;

    if (typeof textRaw !== 'string') {
      return NextResponse.json({ error: 'Text must be a string' }, { status: 400 });
    }

    const text = textRaw.trim();
    if (!text) {
      return NextResponse.json({ error: 'Text is required' }, { status: 400 });
    }

    if (text.length > MAX_TEXT_CHARS) {
      return NextResponse.json(
        { error: `Text too long (max ${MAX_TEXT_CHARS} chars)` },
        { status: 413 }
      );
    }

    // Get user info and verify credits
    let convexClient: ConvexHttpClient;
    let ttsProvider: TtsProvider;
    try {
      const result = await getUserAndCredits();
      convexClient = result.client;
      ttsProvider = result.ttsProvider;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Credit check failed';
      const status =
        message === 'Unauthorized' ? 401 : message === 'Convex URL not configured' ? 500 : 402;
      return NextResponse.json({ error: message }, { status });
    }

    // Check if the selected provider's API key is configured
    if (ttsProvider === 'resemble' && !RESEMBLE_API_KEY) {
      console.warn('[TTS] Resemble API key not configured, falling back to ElevenLabs');
      ttsProvider = 'elevenlabs';
    }
    if (ttsProvider === 'elevenlabs' && !ELEVENLABS_API_KEY) {
      return NextResponse.json({ error: 'TTS API key not configured' }, { status: 500 });
    }

    // Set up timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TTS_TIMEOUT_MS);

    let audioBuffer: ArrayBuffer | null = null;
    let contentType: string;

    try {
      if (ttsProvider === 'resemble') {
        audioBuffer = await generateResembleTTS(text, controller.signal);
        contentType = 'audio/wav';
      } else {
        audioBuffer = await generateElevenLabsTTS(text, controller.signal);
        contentType = 'audio/mpeg';
      }
    } catch (error) {
      clearTimeout(timeoutId);
      // Handle timeout/abort
      if (error instanceof Error && error.name === 'AbortError') {
        console.error('[TTS] Request timed out after', TTS_TIMEOUT_MS, 'ms');
        return NextResponse.json(
          { error: 'TTS request timed out' },
          { status: 504 }
        );
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }

    if (!audioBuffer) {
      return NextResponse.json(
        { error: `TTS generation failed (${ttsProvider})` },
        { status: 500 }
      );
    }

    // Consume TTS credit after successful generation
    try {
      await consumeTtsCredit(convexClient);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Credit consumption failed';
      const status =
        message === 'Unauthorized' ? 401 : message === 'Convex URL not configured' ? 500 : 402;
      return NextResponse.json({ error: message }, { status });
    }

    return new NextResponse(audioBuffer, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    console.error('TTS error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
