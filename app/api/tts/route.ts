import { NextRequest, NextResponse } from 'next/server';
import { ConvexHttpClient } from 'convex/browser';
import { auth } from '@clerk/nextjs/server';
import { api } from '@/convex/_generated/api';
import { TTS_GENERATION_COST } from '@/lib/credits/constants';

export const runtime = 'nodejs';

const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
const VOICE_ID = 'zl1Ut8dvwcVSuQSB9XkG';
const MODEL_ID = 'eleven_multilingual_v2';
const OUTPUT_FORMAT = 'mp3_44100_128';
const CONVEX_URL = process.env.NEXT_PUBLIC_CONVEX_URL || '';

const VOICE_SETTINGS = {
  speed: 0.7,
  stability: 1,
} as const;

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
