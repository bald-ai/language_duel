const OPENAI_MODEL = "gpt-5.5-2026-04-23";
const RESEMBLE_BASE_URL = "https://app.resemble.ai/api/v2";
const RESEMBLE_PROJECT_UUID = "5d2d9092";
const MONITOR_SLUG = "critical-provider-health";
const PROVIDER_TIMEOUT_MS = 12_000;
const SENTRY_TIMEOUT_MS = 5_000;

export const config = {
  schedule: "0 0 * * *",
};

function readRequiredEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is not configured`);
  }
  return value;
}

function buildSentryEnvelopeEndpoint(dsn) {
  const parsed = new URL(dsn);
  const projectId = parsed.pathname.replace("/", "");
  if (!projectId) {
    throw new Error("SENTRY_CRITICAL_PROVIDER_HEALTH_DSN is missing a project id");
  }
  return `${parsed.origin}/api/${projectId}/envelope/`;
}

async function fetchWithTimeout(url, options = {}, timeoutMs = PROVIDER_TIMEOUT_MS) {
  const signal = AbortSignal.timeout(timeoutMs);
  return fetch(url, { ...options, signal });
}

async function reportCheckIn({ dsn, checkInId, status, duration }) {
  const sentAt = new Date().toISOString();
  const payload = {
    check_in_id: checkInId,
    monitor_slug: MONITOR_SLUG,
    status,
    environment: "production",
  };

  if (typeof duration === "number") {
    payload.duration = duration;
  }

  const body = [
    JSON.stringify({ dsn, sent_at: sentAt }),
    JSON.stringify({ type: "check_in" }),
    JSON.stringify(payload),
  ].join("\n");

  const response = await fetchWithTimeout(
    buildSentryEnvelopeEndpoint(dsn),
    {
      method: "POST",
      headers: { "Content-Type": "application/x-sentry-envelope" },
      body,
    },
    SENTRY_TIMEOUT_MS
  );

  if (!response.ok) {
    throw new Error(`Sentry check-in failed with ${response.status}`);
  }
}

async function assertOpenAIHealthy() {
  const response = await fetchWithTimeout("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${readRequiredEnv("OPEN_AI_API_KEY")}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      input: "Reply with OK.",
      max_output_tokens: 16,
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`OpenAI health check failed with ${response.status}: ${detail}`);
  }
}

async function assertResembleHealthy() {
  const response = await fetchWithTimeout(`${RESEMBLE_BASE_URL}/projects/${RESEMBLE_PROJECT_UUID}`, {
    headers: {
      Authorization: `Bearer ${readRequiredEnv("RESEMBLE_API_KEY")}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Resemble health check failed with ${response.status}: ${detail}`);
  }
}

async function runProviderChecks() {
  const checks = await Promise.allSettled([
    assertOpenAIHealthy(),
    assertResembleHealthy(),
  ]);

  const failures = checks
    .filter((result) => result.status === "rejected")
    .map((result) => result.reason instanceof Error ? result.reason.message : String(result.reason));

  if (failures.length > 0) {
    throw new Error(failures.join("\n"));
  }
}

export default async function handler() {
  const dsn = readRequiredEnv("SENTRY_CRITICAL_PROVIDER_HEALTH_DSN");
  const checkInId = crypto.randomUUID();
  const startedAt = Date.now();

  await reportCheckIn({ dsn, checkInId, status: "in_progress" });

  try {
    await runProviderChecks();
    await reportCheckIn({
      dsn,
      checkInId,
      status: "ok",
      duration: (Date.now() - startedAt) / 1000,
    });
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  } catch (error) {
    console.error("[critical-provider-health]", error);
    await reportCheckIn({
      dsn,
      checkInId,
      status: "error",
      duration: (Date.now() - startedAt) / 1000,
    });
    return new Response(JSON.stringify({ ok: false }), { status: 500 });
  }
}
