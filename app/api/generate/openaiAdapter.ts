import OpenAI from "openai";
import { MAX_OUTPUT_TOKENS } from "@/lib/generate/constants";

export const OPENAI_MODEL = "gpt-5.5-2026-04-23" as const;
export const OPENAI_REASONING_EFFORT = "low" as const;

// All generate prompts use plain string content, so model this directly instead
// of the SDK's broader message union (whose content can be an array/null).
export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };
export type JsonSchema = Record<string, unknown>;

export function buildMessages(params: {
  systemPrompt: string;
  userMessage: string;
  history?: { role: "user" | "assistant"; content: string }[];
}): ChatMessage[] {
  const { systemPrompt, userMessage, history } = params;
  return [
    { role: "system", content: systemPrompt },
    ...(history || []),
    { role: "user", content: userMessage },
  ];
}

function toResponsesInput(messages: ChatMessage[]) {
  return messages.map((message) => ({
    role: message.role,
    content: message.content,
  }));
}

export function createOpenAIClient() {
  return new OpenAI({
    apiKey: process.env.OPEN_AI_API_KEY,
    baseURL: "https://api.openai.com/v1",
  });
}

export async function callOpenAIJson<T>(
  openai: OpenAI,
  params: {
    messages: ChatMessage[];
    schemaName: string;
    schema: JsonSchema;
  }
): Promise<T> {
  const response = await openai.responses.create({
    model: OPENAI_MODEL,
    reasoning: { effort: OPENAI_REASONING_EFFORT },
    input: toResponsesInput(params.messages),
    max_output_tokens: MAX_OUTPUT_TOKENS,
    text: {
      format: {
        type: "json_schema",
        name: params.schemaName,
        schema: params.schema,
        strict: true,
      },
    },
  });

  const content = response.output_text;
  if (!content) throw new Error("No content in response");
  return JSON.parse(content) as T;
}

export function buildRetryMessages(params: {
  systemPrompt: string;
  userMessage: string;
  history?: { role: "user" | "assistant"; content: string }[];
  parsed: unknown;
  validationIssues: string[];
  retryInstruction: string;
}): ChatMessage[] {
  const issueLines = params.validationIssues.join("\n- ");
  return [
    ...buildMessages({
      systemPrompt: params.systemPrompt,
      userMessage: params.userMessage,
      history: params.history,
    }),
    { role: "assistant", content: JSON.stringify(params.parsed) },
    {
      role: "user",
      content: `${params.retryInstruction}\n- ${issueLines}`,
    },
  ];
}
