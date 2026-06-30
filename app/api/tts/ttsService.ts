import { NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { TTS_GENERATION_COST } from "@/lib/credits/constants";
import { ApiRouteError, resolveApiError } from "@/lib/api/serverErrors";
import { getAuthedConvexClient } from "@/lib/api/convexClient";
import {
  DEFAULT_TTS_PROVIDER,
  isTtsProvider,
  type TtsProvider,
} from "@/lib/tts/providers";
import { generateTtsAudioWithFallback } from "@/lib/tts/providerAdapters";

type ConsumedCreditTransaction = {
  creditTransactionId: Id<"creditTransactions">;
};

async function getUserTtsProvider(): Promise<{
  client: ConvexHttpClient;
  ttsProvider: TtsProvider;
}> {
  const client = await getAuthedConvexClient();
  const currentUser = await client.query(api.users.getCurrentUser, {});
  if (!currentUser) {
    throw new ApiRouteError("AUTH_FAILED", "Unauthorized", 401);
  }

  const ttsProvider = isTtsProvider(currentUser.ttsProvider)
    ? currentUser.ttsProvider
    : DEFAULT_TTS_PROVIDER;

  return { client, ttsProvider };
}

async function consumeTtsCredit(
  client: ConvexHttpClient
): Promise<ConsumedCreditTransaction> {
  return await client.mutation(api.credits.consumeCredits, {
    creditType: "tts",
    cost: TTS_GENERATION_COST,
  });
}

async function refundTtsCredit(
  client: ConvexHttpClient,
  transaction: ConsumedCreditTransaction
) {
  try {
    await client.mutation(api.credits.refundConsumedCredits, {
      creditTransactionId: transaction.creditTransactionId,
    });
  } catch (error) {
    console.error("[TTS] Failed to refund TTS credit:", error);
  }
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
    const result = await getUserTtsProvider();
    convexClient = result.client;
    ttsProvider = result.ttsProvider;
  } catch (error) {
    return creditsFailureResponse(error, "Could not check your audio credits");
  }

  let creditTransaction: ConsumedCreditTransaction;
  try {
    creditTransaction = await consumeTtsCredit(convexClient);
  } catch (error) {
    return creditsFailureResponse(error, "Could not use an audio credit");
  }

  let generatedAudio;
  try {
    generatedAudio = await generateTtsAudioWithFallback({
      text,
      preferredProvider: ttsProvider,
    });
  } catch (error) {
    await refundTtsCredit(convexClient, creditTransaction);
    if (error instanceof Error && error.name === "AbortError") {
      console.error("[TTS] Request timed out");
      return NextResponse.json(
        { error: "Audio took too long to generate. Please try again." },
        { status: 504 }
      );
    }
    throw error;
  }

  if (!generatedAudio) {
    await refundTtsCredit(convexClient, creditTransaction);
    return NextResponse.json(
      { error: "Audio could not be generated. Please try again." },
      { status: 500 }
    );
  }

  return new NextResponse(generatedAudio.audioBuffer, {
    headers: {
      "Content-Type": generatedAudio.contentType,
      "Cache-Control": "no-store",
    },
  });
}
