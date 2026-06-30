import { NextResponse } from "next/server";
import { resolveApiError } from "@/lib/api/serverErrors";

/**
 * Debug toggle: set the env var `GENERATE_API_INCLUDE_DEBUG_PROMPT=true` to have
 * `/api/generate` echo the system prompt back in success/validation responses
 * (under `prompt`). Off by default; intended for local prompt debugging only.
 */
function shouldIncludeDebugPrompt(): boolean {
  return process.env.GENERATE_API_INCLUDE_DEBUG_PROMPT === "true";
}

// The specific issues are returned in the `validationIssues` array of the body;
// the user-facing message stays generic.
export function buildGenerationValidationError(): string {
  return "Failed to generate valid content. Please try again.";
}

export function creditFailureResponse(error: unknown) {
  const resolved = resolveApiError(error, {
    defaultCode: "CREDITS_EXHAUSTED",
    defaultStatus: 402,
    defaultMessage: "Could not check your AI generation credits",
  });

  return NextResponse.json(
    { success: false, error: resolved.message, code: resolved.code },
    { status: resolved.status }
  );
}

export function generationFailureResponse() {
  return NextResponse.json(
    { success: false, error: "Could not generate content. Please try again." },
    { status: 500 }
  );
}

export function validationFailureResponse(params: {
  validationIssues: string[];
  prompt: string;
  status: 400 | 502;
}) {
  return NextResponse.json(
    {
      success: false,
      error: buildGenerationValidationError(),
      validationIssues: params.validationIssues,
      ...(shouldIncludeDebugPrompt() ? { prompt: params.prompt } : {}),
    },
    { status: params.status }
  );
}

export function generationSuccessResponse(data: unknown, prompt: string) {
  return NextResponse.json({
    success: true,
    data,
    ...(shouldIncludeDebugPrompt() ? { prompt } : {}),
  });
}
