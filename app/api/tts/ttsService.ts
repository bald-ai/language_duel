import { NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { TTS_GENERATION_COST } from "@/lib/credits/constants";
import { ApiRouteError, resolveApiError } from "@/lib/api/serverErrors";
import { getAuthedConvexClient } from "@/lib/api/convexClient";
import {
  DEFAULT_TTS_PROVIDER,
  isTtsProvider,
  type TtsProvider,
} from "@/lib/tts/providers";
import {
  generateTtsAudioWithFallback,
  TTS_TIMEOUT_MS,
} from "@/lib/tts/providerAdapters";

async function getUserAndCredits(): Promise<{
  client: ConvexHttpClient;
  ttsProvider: TtsProvider;
}> {
  const client = await getAuthedConvexClient();
  const currentUser = await client.query(api.users.getCurrentUser, {});
  if (!currentUser) {
    throw new ApiRouteError("AUTH_FAILED", "Unauthorized", 401);
  }
  if (currentUser.ttsGenerationsRemaining < TTS_GENERATION_COST) {
    throw new ApiRouteError("CREDITS_EXHAUSTED", "TTS credits exhausted", 402);
  }

  const ttsProvider = isTtsProvider(currentUser.ttsProvider)
    ? currentUser.ttsProvider
    : DEFAULT_TTS_PROVIDER;

  return { client, ttsProvider };
}

async function consumeTtsCredit(client: ConvexHttpClient) {
  await client.mutation(api.credits.consumeCredits, {
    creditType: "tts",
    cost: TTS_GENERATION_COST,
  });
}

function creditsFailureResponse(error: unknown, defaultMessage: string) {
  const resolved = resolveApiError(error, {
    defaultCode: "CREDITS_EXHAUSTED",
    defaultStatus: 402,
    defaultMessage,
  });

  return NextResponse.json(
    { error: resolved.message, code: resolved.code },
    { status: resolved.status }
  );
}

export async function generateLiveTtsResponse(text: string) {
  let convexClient: ConvexHttpClient;
  let ttsProvider: TtsProvider;
  try {
    const result = await getUserAndCredits();
    convexClient = result.client;
    ttsProvider = result.ttsProvider;
  } catch (error) {
    return creditsFailureResponse(error, "Credit check failed");
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TTS_TIMEOUT_MS);

  let generatedAudio;
  try {
    generatedAudio = await generateTtsAudioWithFallback({
      text,
      preferredProvider: ttsProvider,
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      console.error("[TTS] Request timed out after", TTS_TIMEOUT_MS, "ms");
      return NextResponse.json(
        { error: "TTS request timed out" },
        { status: 504 }
      );
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }

  if (!generatedAudio) {
    return NextResponse.json(
      { error: `TTS generation failed (${ttsProvider})` },
      { status: 500 }
    );
  }

  try {
    await consumeTtsCredit(convexClient);
  } catch (error) {
    return creditsFailureResponse(error, "Credit consumption failed");
  }

  return new NextResponse(generatedAudio.audioBuffer, {
    headers: {
      "Content-Type": generatedAudio.contentType,
      "Cache-Control": "no-store",
    },
  });
}
