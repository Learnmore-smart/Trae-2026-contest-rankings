import { NextRequest, NextResponse } from "next/server";
import { extractBearerToken, isValidAdminToken } from "@/lib/trae/auth";
import { buildLLMFallbackPlan, truncateDiagnostic, type LLMFallbackPlanEntry } from "@/lib/trae/llm";

export const runtime = "nodejs";
export const maxDuration = 60;

interface ModelHealthResult {
  provider: LLMFallbackPlanEntry["provider"];
  model: string;
  status: "ok" | "error";
  latencyMs: number;
  inputTokens: number;
  outputTokens: number;
  errorReason?: string;
  rawResponseSummary?: string;
}

const PING_TIMEOUT_MS = 15_000;

function buildPingBody(model: string): string {
  return JSON.stringify({
    model,
    messages: [{ role: "user", content: "Return {} only." }],
    temperature: 0,
    response_format: { type: "json_object" }
  });
}

function chatCompletionsUrl(baseUrl: string): string {
  return `${baseUrl.replace(/\/+$/, "")}/chat/completions`;
}

async function pingOneModel(entry: LLMFallbackPlanEntry): Promise<ModelHealthResult> {
  const startedAt = Date.now();
  const latencyMs = () => Date.now() - startedAt;

  if (entry.apiKeys.length === 0 || !entry.apiKeys[0]) {
    return {
      provider: entry.provider,
      model: entry.model,
      status: "error",
      latencyMs: latencyMs(),
      inputTokens: 0,
      outputTokens: 0,
      errorReason: "missing_api_key"
    };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PING_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(chatCompletionsUrl(entry.baseUrl), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${entry.apiKeys[0]}`,
        "Content-Type": "application/json"
      },
      body: buildPingBody(entry.model),
      signal: controller.signal
    });
  } catch (error) {
    clearTimeout(timer);
    const isAbort = error instanceof Error && error.name === "AbortError";
    return {
      provider: entry.provider,
      model: entry.model,
      status: "error",
      latencyMs: latencyMs(),
      inputTokens: 0,
      outputTokens: 0,
      errorReason: isAbort ? "timeout" : "network_error",
      rawResponseSummary: truncateDiagnostic(
        error instanceof Error ? `${error.name}: ${error.message}` : String(error),
        800
      )
    };
  }
  clearTimeout(timer);

  const rawText = await response.text().catch(() => "");

  if (!response.ok) {
    return {
      provider: entry.provider,
      model: entry.model,
      status: "error",
      latencyMs: latencyMs(),
      inputTokens: 0,
      outputTokens: 0,
      errorReason: `http_${response.status}`,
      rawResponseSummary: truncateDiagnostic(rawText, 800)
    };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    return {
      provider: entry.provider,
      model: entry.model,
      status: "error",
      latencyMs: latencyMs(),
      inputTokens: 0,
      outputTokens: 0,
      errorReason: "invalid_response",
      rawResponseSummary: truncateDiagnostic(rawText, 800)
    };
  }

  const obj = (parsed ?? {}) as {
    choices?: Array<{ message?: { content?: string } }>;
    usage?: { prompt_tokens?: number; completion_tokens?: number };
  };
  const choices = Array.isArray(obj.choices) ? obj.choices : [];
  const content = choices[0]?.message?.content ?? "";
  const inputTokens = typeof obj.usage?.prompt_tokens === "number" ? obj.usage.prompt_tokens : 0;
  const outputTokens = typeof obj.usage?.completion_tokens === "number" ? obj.usage.completion_tokens : 0;

  if (content && content.trim().length > 0) {
    return {
      provider: entry.provider,
      model: entry.model,
      status: "ok",
      latencyMs: latencyMs(),
      inputTokens,
      outputTokens
    };
  }

  // Empty content — diagnose the failure mode.
  let errorReason: string;
  if (choices.length === 0) {
    errorReason = "rate_limited"; // NVIDIA soft-429: empty choices, no content.
  } else if (inputTokens > 0) {
    errorReason = "empty_content_billed"; // The production failure pattern.
  } else {
    errorReason = "invalid_response";
  }

  return {
    provider: entry.provider,
    model: entry.model,
    status: "error",
    latencyMs: latencyMs(),
    inputTokens,
    outputTokens,
    errorReason,
    rawResponseSummary: truncateDiagnostic(rawText, 800)
  };
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!isValidAdminToken(extractBearerToken(request.headers))) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const plan = buildLLMFallbackPlan();
    // Serial pings — no concurrency (avoid tripping rate limits), no retries, no fallback.
    const results: ModelHealthResult[] = [];
    for (const entry of plan) {
      results.push(await pingOneModel(entry));
    }
    return NextResponse.json({ results });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "LLM health check failed." },
      { status: 500 }
    );
  }
}
