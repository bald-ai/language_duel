import { NextRequest, NextResponse } from 'next/server';
import { ConvexHttpClient } from 'convex/browser';
import { auth } from '@clerk/nextjs/server';
import { api } from '@/convex/_generated/api';
import { TTS_GENERATION_COST } from '@/lib/credits/constants';

export const runtime = 'nodejs';

// ============================================================================
// ELEVENLABS TTS (Active)
// ============================================================================
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
const VOICE_ID = 'zl1Ut8dvwcVSuQSB9XkG';
const MODEL_ID = 'eleven_multilingual_v2';
const OUTPUT_FORMAT = 'mp3_44100_128';

const VOICE_SETTINGS = {
  speed: 0.7,
  stability: 1,
} as const;

// ============================================================================
// RESEMBLE AI TTS (NOT IN USE - Experiencing intermittent 500 errors)
// As of Jan 2026, Resemble API returns "Synthesis failed! An error has occurred
// within our systems" intermittently. Keep this for future use when stable.
// 
// To restore Resemble:
// 1. Uncomment the Resemble constants and functions below
// 2. Replace the ElevenLabs logic in POST handler with Resemble clip creation
// 3. Change Content-Type to 'audio/wav'
// 4. Set RESEMBLE_API_KEY in .env
// ============================================================================
// const RESEMBLE_API_KEY = process.env.RESEMBLE_API_KEY;
// const RESEMBLE_BASE_URL = 'https://app.resemble.ai/api/v2';
// const PROJECT_UUID = '5d2d9092';
// const VOICE_UUID = 'a253156d'; // Jota - native Spanish voice
// const SPEECH_RATE_PERCENT = 75;
//
// function getResembleHeaders() {
//   return {
//     Authorization: `Bearer ${RESEMBLE_API_KEY}`,
//     'Content-Type': 'application/json',
//   };
// }
//
// function escapeForSsml(text: string): string {
//   return text
//     .replace(/&/g, '&amp;')
//     .replace(/</g, '&lt;')
//     .replace(/>/g, '&gt;')
//     .replace(/"/g, '&quot;')
//     .replace(/'/g, '&apos;');
// }
//
// async function createResembleClip(text: string): Promise<{ uuid: string; audio_src?: string } | null> {
//   const escapedText = escapeForSsml(text);
//   const ssmlText = `<speak><prosody rate="${SPEECH_RATE_PERCENT}%">${escapedText}</prosody></speak>`;
//
//   const response = await fetch(`${RESEMBLE_BASE_URL}/projects/${PROJECT_UUID}/clips`, {
//     method: 'POST',
//     headers: getResembleHeaders(),
//     body: JSON.stringify({
//       voice_uuid: VOICE_UUID,
//       body: ssmlText,
//       is_public: false,
//       is_archived: false,
//     }),
//   });
//
//   if (!response.ok) {
//     console.error('[Resemble TTS] API error:', await response.text());
//     return null;
//   }
//
//   const data = await response.json();
//   return data.item || data;
// }
//
// async function waitForResembleAudio(clipUuid: string, maxAttempts = 20): Promise<string | null> {
//   for (let i = 0; i < maxAttempts; i++) {
//     const response = await fetch(`${RESEMBLE_BASE_URL}/projects/${PROJECT_UUID}/clips/${clipUuid}`, {
//       method: 'GET',
//       headers: getResembleHeaders(),
//     });
//
//     if (!response.ok) return null;
//
//     const data = await response.json();
//     const clip = data.item || data;
//     if (clip.audio_src) return clip.audio_src;
//
//     await new Promise((resolve) => setTimeout(resolve, 500));
//   }
//   return null;
// }

const CONVEX_URL = process.env.NEXT_PUBLIC_CONVEX_URL || '';
const MAX_TEXT_CHARS = 2000;
const TTS_TIMEOUT_MS = 15_000;

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

async function ensureTtsCreditsAvailable() {
  const client = await getAuthedConvexClient();
  const currentUser = await client.query(api.users.getCurrentUser, {});
  if (!currentUser) {
    throw new Error('Unauthorized');
  }
  if (currentUser.ttsGenerationsRemaining < TTS_GENERATION_COST) {
    throw new Error('TTS credits exhausted');
  }
  return client;
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

    if (!ELEVENLABS_API_KEY) {
      return NextResponse.json({ error: 'ElevenLabs API key not configured' }, { status: 500 });
    }

    let convexClient: ConvexHttpClient;
    try {
      convexClient = await ensureTtsCreditsAvailable();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Credit check failed';
      const status = message === 'Unauthorized' ? 401 : message === 'Convex URL not configured' ? 500 : 402;
      return NextResponse.json({ error: message }, { status });
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TTS_TIMEOUT_MS);

    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}?output_format=${OUTPUT_FORMAT}`,
      {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          'xi-api-key': ELEVENLABS_API_KEY,
        },
        body: JSON.stringify({
          text,
          model_id: MODEL_ID,
          voice_settings: VOICE_SETTINGS,
        }),
      }
    ).finally(() => clearTimeout(timeoutId));

    if (!response.ok) {
      const errorText = await response.text();
      console.error('ElevenLabs API error:', errorText);
      return NextResponse.json(
        {
          error: 'TTS generation failed',
          details: process.env.NODE_ENV === 'development' ? errorText : undefined,
        },
        { status: response.status }
      );
    }

    try {
      await consumeTtsCredit(convexClient);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Credit check failed';
      const status = message === 'Unauthorized' ? 401 : message === 'Convex URL not configured' ? 500 : 402;
      return NextResponse.json({ error: message }, { status });
    }

    const audioBuffer = await response.arrayBuffer();

    return new NextResponse(audioBuffer, {
      headers: {
        'Content-Type': 'audio/mpeg',
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    console.error('TTS error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
