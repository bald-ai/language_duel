import OpenAI from "openai";

export const OPENAI_MODEL = "gpt-5.4-2026-03-05" as const;
export const OPENAI_REASONING_EFFORT = "low" as const;

export type ChatMessage = OpenAI.Chat.ChatCompletionMessageParam;
export type JsonSchema = Record<string, unknown>;

export function buildMessages(params: {
  systemPrompt: string;
  userMessage: string;
  history?: { role: "user" | "assistant"; content: string }[];
}): ChatMessage[] {
  const { systemPrompt, userMessage, history } = params;
  return [
    { role: "system", content: systemPrompt },
    ...(history || []).map((h) => ({
      role: h.role as "user" | "assistant",
      content: h.content,
    })),
    { role: "user", content: userMessage },
  ];
}

function toResponsesInput(messages: ChatMessage[]) {
  return messages.map((message) => ({
    role: message.role as "user" | "assistant" | "system",
    content: message.content as string,
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
    max_output_tokens: 30000,
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
