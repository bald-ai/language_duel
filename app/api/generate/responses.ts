import { NextResponse } from "next/server";
import { resolveApiError } from "@/lib/api/serverErrors";

function shouldIncludeDebugPrompt(): boolean {
  return process.env.GENERATE_API_INCLUDE_DEBUG_PROMPT === "true";
}

export function buildGenerationValidationError(validationIssues: string[]): string {
  if (validationIssues.length === 0) {
    return "Failed to generate valid content. Please try again.";
  }

  return `Failed to generate valid content. ${validationIssues[0]}`;
}

export function creditFailureResponse(error: unknown) {
  const resolved = resolveApiError(error, {
    defaultCode: "CREDITS_EXHAUSTED",
    defaultStatus: 402,
    defaultMessage: "Credit check failed",
  });

  return NextResponse.json(
    { success: false, error: resolved.message, code: resolved.code },
    { status: resolved.status }
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
      error: buildGenerationValidationError(params.validationIssues),
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
