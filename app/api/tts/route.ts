import { NextRequest, NextResponse } from "next/server";
import { generateLiveTtsResponse } from "./ttsService";

export const runtime = "nodejs";

const MAX_TEXT_CHARS = 2000;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const textRaw = (body as { text?: unknown }).text;

    if (typeof textRaw !== "string") {
      return NextResponse.json({ error: "Text must be a string" }, { status: 400 });
    }

    const text = textRaw.trim();
    if (!text) {
      return NextResponse.json({ error: "Text is required" }, { status: 400 });
    }

    if (text.length > MAX_TEXT_CHARS) {
      return NextResponse.json(
        { error: `Text too long (max ${MAX_TEXT_CHARS} chars)` },
        { status: 413 }
      );
    }

    return generateLiveTtsResponse(text);
  } catch (error) {
    console.error("TTS error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
