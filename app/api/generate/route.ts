import { NextRequest, NextResponse } from "next/server";
import { parseGenerateRequest } from "@/lib/generate/requestValidation";
import { handleGenerateRequest } from "./generationService";
import { generationFailureResponse } from "./responses";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.json().catch(() => null);
    const parsedRequest = parseGenerateRequest(rawBody);
    if (!parsedRequest.ok) {
      return NextResponse.json(
        { success: false, error: parsedRequest.error },
        { status: 400 }
      );
    }

    return handleGenerateRequest(parsedRequest.data);
  } catch (error) {
    console.error("Generate API error:", error);
    return generationFailureResponse();
  }
}
