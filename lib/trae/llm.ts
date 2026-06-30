import { setTimeout as sleep } from "node:timers/promises";
import { type AIProvider, getTraeConfig, type TraeConfig } from "./config.ts";
import type { TraeAIProvider, TraeLLMCallLog } from "./types.ts";

export interface LLMMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface LLMFallbackPlanEntry {
  provider: TraeAIProvider;
  model: string;
  baseUrl: string;
  apiKey: string | null;
}

export interface LLMCallResult<TParsed = unknown> {
  provider: TraeAIProvider;
  model: string;
  content: string;
  parsed: TParsed;
  callLogs: TraeLLMCallLog[];
}

export interface CallLLMWithFallbackOptions<TParsed = string> {
  messages: LLMMessage[];
  config?: TraeConfig;
  temperature?: number;
  validateContent?: (content: string) => TParsed;
  fetchFn?: typeof fetch;
  sleepFn?: (delayMs: number) => Promise<void>;
}

interface ChatCompletionRequestBody {
  model: string;
  messages: LLMMessage[];
  temperature: number;
  response_format: { type: "json_object" };
  reasoning_effort?: "max";
}

export class LLMFallbackError extends Error {
  readonly callLogs: TraeLLMCallLog[];

  constructor(message: string, callLogs: TraeLLMCallLog[]) {
    super(message);
    this.name = "LLMFallbackError";
    this.callLogs = callLogs;
  }
}

export function buildLLMFallbackPlan(config = getTraeConfig()): LLMFallbackPlanEntry[] {
  if (!config.aiZeroBudgetOnly) {
    throw new Error("AI_ZERO_BUDGET_ONLY must be true; paid AI providers are not supported.");
  }

  const providerConfigs: Record<AIProvider, Omit<LLMFallbackPlanEntry, "model"> & { models: string[] }> = {
    nvidia: {
      provider: "nvidia",
      apiKey: config.nvidiaApiKey,
      baseUrl: config.nvidiaBaseUrl,
      models: [config.nvidiaPrimaryModel, ...config.nvidiaFallbackModels]
    },
    openrouter: {
      provider: "openrouter",
      apiKey: config.openRouterApiKey,
      baseUrl: config.openRouterBaseUrl,
      models: [config.openRouterPrimaryModel, ...config.openRouterFallbackModels]
    }
  };

  return config.aiProviderOrder.flatMap((provider) => {
    const providerConfig = providerConfigs[provider];
    return providerConfig.models.filter(Boolean).map((model) => ({
      provider: providerConfig.provider,
      apiKey: providerConfig.apiKey,
      baseUrl: providerConfig.baseUrl,
      model
    }));
  });
}

export async function callLLMWithFallback<TParsed = string>({
  messages,
  config = getTraeConfig(),
  temperature = 0.2,
  validateContent,
  fetchFn = fetch,
  sleepFn = async (delayMs) => {
    await sleep(delayMs);
  }
}: CallLLMWithFallbackOptions<TParsed>): Promise<LLMCallResult<TParsed>> {
  const callLogs: TraeLLMCallLog[] = [];
  const plan = buildLLMFallbackPlan(config);

  for (const entry of plan) {
    if (!entry.apiKey) {
      callLogs.push({
        provider: entry.provider,
        model: entry.model,
        latencyMs: 0,
        retryCount: 0,
        errorReason: "missing_api_key",
        inputTokens: 0,
        outputTokens: 0,
        rawResponse: ""
      });
      continue;
    }

    for (let retryCount = 0; retryCount <= config.aiMaxRetriesPerModel; retryCount += 1) {
      const attempt = await callOneModel({
        entry,
        messages,
        temperature,
        timeoutMs: config.aiRequestTimeoutMs,
        openRouterSiteUrl: config.openRouterSiteUrl,
        openRouterAppName: config.openRouterAppName,
        retryCount,
        validateContent,
        fetchFn
      });
      callLogs.push(attempt.log);

      if (attempt.ok) {
        return {
          provider: entry.provider,
          model: entry.model,
          content: attempt.content,
          parsed: attempt.parsed,
          callLogs
        };
      }

      if (
        retryCount < config.aiMaxRetriesPerModel &&
        isRetryableError(attempt.log.errorReason)
      ) {
        await sleepFn(backoffDelayMs(retryCount, attempt.log.errorReason));
        continue;
      }
      break;
    }
  }

  throw new LLMFallbackError("All zero-budget LLM models failed.", callLogs);
}

interface CallOneModelOptions<TParsed> {
  entry: LLMFallbackPlanEntry;
  messages: LLMMessage[];
  temperature: number;
  timeoutMs: number;
  openRouterSiteUrl: string;
  openRouterAppName: string;
  retryCount: number;
  validateContent?: (content: string) => TParsed;
  fetchFn: typeof fetch;
}

type CallOneModelResult<TParsed> =
  | {
      ok: true;
      content: string;
      parsed: TParsed;
      log: TraeLLMCallLog;
    }
  | {
      ok: false;
      log: TraeLLMCallLog;
    };

async function callOneModel<TParsed>({
  entry,
  messages,
  temperature,
  timeoutMs,
  openRouterSiteUrl,
  openRouterAppName,
  retryCount,
  validateContent,
  fetchFn
}: CallOneModelOptions<TParsed>): Promise<CallOneModelResult<TParsed>> {
  const startedAt = Date.now();
  const controller = new AbortController();
  const timeout = globalThis.setTimeout(() => controller.abort(), timeoutMs);
  let rawResponse = "";

  try {
    const response = await fetchFn(chatCompletionsUrl(entry.baseUrl), {
      method: "POST",
      signal: controller.signal,
      headers: buildHeaders(entry, openRouterSiteUrl, openRouterAppName),
      body: JSON.stringify(buildChatCompletionRequestBody(entry, messages, temperature))
    });
    rawResponse = await response.text();

    if (!response.ok) {
      return failedAttempt(entry, startedAt, retryCount, httpErrorReason(response.status), rawResponse);
    }

    const content = extractMessageContent(rawResponse);
    const tokenUsage = extractTokenUsage(rawResponse);
    if (!content) {
      return failedAttempt(entry, startedAt, retryCount, emptyContentReason(rawResponse), rawResponse, tokenUsage);
    }

    try {
      const parsed = validateContent ? validateContent(content) : (content as TParsed);
      return {
        ok: true,
        content,
        parsed,
        log: {
          provider: entry.provider,
          model: entry.model,
          latencyMs: Date.now() - startedAt,
          retryCount,
          errorReason: null,
          inputTokens: tokenUsage.inputTokens,
          outputTokens: tokenUsage.outputTokens,
          rawResponse
        }
      };
    } catch {
      return failedAttempt(entry, startedAt, retryCount, "invalid_json", rawResponse, tokenUsage);
    }
  } catch (error) {
    const errorReason = isAbortError(error) ? "timeout" : "network_error";
    return failedAttempt(entry, startedAt, retryCount, errorReason, rawResponse);
  } finally {
    globalThis.clearTimeout(timeout);
  }
}

function buildChatCompletionRequestBody(
  entry: LLMFallbackPlanEntry,
  messages: LLMMessage[],
  temperature: number
): ChatCompletionRequestBody {
  const body: ChatCompletionRequestBody = {
    model: entry.model,
    messages,
    temperature,
    response_format: { type: "json_object" }
  };

  if (entry.provider === "nvidia" && isDeepSeekModel(entry.model)) {
    body.reasoning_effort = "max";
  }

  return body;
}

function isDeepSeekModel(model: string): boolean {
  return model.toLowerCase().startsWith("deepseek-ai/");
}

function buildHeaders(
  entry: LLMFallbackPlanEntry,
  openRouterSiteUrl: string,
  openRouterAppName: string
): Headers {
  const headers = new Headers({
    Authorization: `Bearer ${entry.apiKey}`,
    "Content-Type": "application/json"
  });
  if (entry.provider === "openrouter") {
    headers.set("HTTP-Referer", openRouterSiteUrl);
    headers.set("X-Title", openRouterAppName);
  }
  return headers;
}

function chatCompletionsUrl(baseUrl: string): string {
  return `${baseUrl.replace(/\/+$/, "")}/chat/completions`;
}

function extractMessageContent(rawResponse: string): string | null {
  try {
    const json = JSON.parse(rawResponse) as { choices?: Array<{ message?: { content?: string } }> };
    return json.choices?.[0]?.message?.content ?? null;
  } catch {
    return null;
  }
}

/**
 * NVIDIA's integrate.api.nvidia.com soft-throttles by replying HTTP 200 with an
 * empty `choices` array (and null usage) instead of a clean 429. Classify that as
 * a rate limit so it retries with rate-limit backoff rather than being mislabeled
 * as a malformed model response.
 */
function emptyContentReason(rawResponse: string): "rate_limited" | "invalid_response" {
  try {
    const json = JSON.parse(rawResponse) as { choices?: unknown };
    if (Array.isArray(json.choices) && json.choices.length === 0) return "rate_limited";
  } catch {
    return "invalid_response";
  }
  return "invalid_response";
}

function extractTokenUsage(rawResponse: string): { inputTokens: number; outputTokens: number } {
  try {
    const json = JSON.parse(rawResponse) as {
      usage?: {
        prompt_tokens?: unknown;
        completion_tokens?: unknown;
      };
    };
    return {
      inputTokens: numberOrZero(json.usage?.prompt_tokens),
      outputTokens: numberOrZero(json.usage?.completion_tokens)
    };
  } catch {
    return { inputTokens: 0, outputTokens: 0 };
  }
}

function numberOrZero(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function failedAttempt(
  entry: LLMFallbackPlanEntry,
  startedAt: number,
  retryCount: number,
  errorReason: string,
  rawResponse: string,
  tokenUsage = { inputTokens: 0, outputTokens: 0 }
): CallOneModelResult<never> {
  return {
    ok: false,
    log: {
      provider: entry.provider,
      model: entry.model,
      latencyMs: Date.now() - startedAt,
      retryCount,
      errorReason,
      inputTokens: tokenUsage.inputTokens,
      outputTokens: tokenUsage.outputTokens,
      rawResponse
    }
  };
}

function httpErrorReason(status: number): string {
  if (status === 429) return "http_429";
  if (status >= 500) return "http_5xx";
  return `http_${status}`;
}

function isRetryableError(errorReason: string | null): boolean {
  return (
    errorReason === "http_429" ||
    errorReason === "rate_limited" ||
    errorReason === "http_5xx" ||
    errorReason === "timeout" ||
    errorReason === "network_error" ||
    errorReason === "invalid_json" ||
    errorReason === "invalid_response"
  );
}

function backoffDelayMs(retryCount: number, errorReason: string | null): number {
  // Rate limits need a wider window to clear NVIDIA's burst limiter than a
  // transient network blip does, so start their backoff higher.
  const baseMs = errorReason === "http_429" || errorReason === "rate_limited" ? 2000 : 1000;
  return Math.min(30_000, baseMs * 2 ** retryCount);
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}
