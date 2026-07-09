import { setTimeout as sleep } from "node:timers/promises";
import { type AIProvider, getTraeConfig, type TraeConfig } from "./config.ts";
import type { TraeAIProvider, TraeLLMCallLog } from "./types.ts";

export type LLMContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };

export interface LLMMessage {
  role: "system" | "user" | "assistant";
  content: string | LLMContentPart[];
}

export interface LLMFallbackPlanEntry {
  provider: TraeAIProvider;
  model: string;
  baseUrl: string;
  /** One or more keys for this provider. The client round-robins across them and paces each independently. */
  apiKeys: string[];
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
  /** "json_object" (default) matches the strict-JSON judge prompts; "text" is for free-form vision descriptions. */
  responseFormat?: "json_object" | "text";
  validateContent?: (content: string) => TParsed;
  fetchFn?: typeof fetch;
  sleepFn?: (delayMs: number) => Promise<void>;
  /** Injectable clock for the rate-limit wall-clock deadline; defaults to Date.now. Tests advance a virtual clock via sleepFn. */
  nowFn?: () => number;
  /**
   * When true (default), rate limits (HTTP 429 + soft-429) are retried — rotating keys —
   * until they clear, per aiMaxRateLimitRetries: a must-succeed judge call never gives up
   * on a throttle. When false, a rate limit is treated as an ordinary fall-through reason
   * (bounded by aiMaxRetriesPerModel, then next model) — used by best-effort vision, which
   * would rather drop to the secondary model or return null than block on a throttle.
   */
  retryRateLimitsUntilCleared?: boolean;
  /** Override the provider/model plan (used by callVisionLLMWithFallback for vision-capable models only). */
  plan?: LLMFallbackPlanEntry[];
}

interface LLMRateLimiterState {
  nextStartAtMs: number;
  queue: Promise<void>;
}

interface ChatCompletionRequestBody {
  model: string;
  messages: LLMMessage[];
  temperature: number;
  response_format?: { type: "json_object" };
  reasoning_effort?: "max";
  chat_template_kwargs?: { enable_thinking: true };
}

export class LLMFallbackError extends Error {
  readonly callLogs: TraeLLMCallLog[];

  constructor(message: string, callLogs: TraeLLMCallLog[]) {
    super(message);
    this.name = "LLMFallbackError";
    this.callLogs = callLogs;
  }
}

/**
 * True when a fallback chain failed with ≥2 models returning `empty_content_billed` —
 * a systemic model/gateway-level failure, not a transient blip. Judge pipeline uses
 * this to abort early instead of burning the entire cron budget on a broken endpoint.
 */
export function isSystemicLLMFallbackError(error: unknown): boolean {
  return (
    error instanceof LLMFallbackError &&
    error.callLogs.filter((log) => log.errorReason === "empty_content_billed").length >= 2
  );
}

// One rate limiter per API key. Each key gets its own aiRpmLimit budget, so two
// keys run at 2× the throughput of one — the client round-robins requests across
// them (see nextKeyIndex). Keyed by the raw key string; a handful of entries max.
const llmRateLimiters = new Map<string, LLMRateLimiterState>();

// Round-robin cursor shared across all concurrent calls, so a burst of judge
// workers spreads evenly over every key instead of stampeding the first one.
let keyRotationCursor = 0;
function nextKeyIndex(): number {
  const index = keyRotationCursor;
  keyRotationCursor = (keyRotationCursor + 1) % Number.MAX_SAFE_INTEGER;
  return index;
}

function friendApiKeys(config: TraeConfig): string[] {
  return config.friendApiKey ? [config.friendApiKey] : [];
}

export function buildLLMFallbackPlan(config = getTraeConfig()): LLMFallbackPlanEntry[] {
  if (!config.aiZeroBudgetOnly) {
    throw new Error("AI_ZERO_BUDGET_ONLY must be true; paid AI providers are not supported.");
  }

  const providerConfigs: Record<AIProvider, Omit<LLMFallbackPlanEntry, "model"> & { models: string[] }> = {
    friend: {
      provider: "friend",
      apiKeys: friendApiKeys(config),
      baseUrl: config.friendBaseUrl,
      models: [config.friendPrimaryModel, ...config.friendFallbackModels]
    },
    nvidia: {
      provider: "nvidia",
      apiKeys: config.nvidiaApiKeys,
      baseUrl: config.nvidiaBaseUrl,
      models: [config.nvidiaPrimaryModel, ...config.nvidiaFallbackModels]
    }
  };

  return config.aiProviderOrder.flatMap((provider) => {
    const providerConfig = providerConfigs[provider];
    return providerConfig.models.filter(Boolean).map((model) => ({
      provider: providerConfig.provider,
      apiKeys: providerConfig.apiKeys,
      baseUrl: providerConfig.baseUrl,
      model
    }));
  });
}

/**
 * Vision-capable models only. Kept separate from the text fallback plan because most
 * text fallbacks (DeepSeek V4, GLM 5.1) are not verified vision models. Tries the
 * friend endpoint first (same models, higher limits), then NVIDIA direct. Vision is
 * best-effort, so a friend-endpoint miss simply falls through to NVIDIA / null.
 */
export function buildVisionLLMFallbackPlan(config = getTraeConfig()): LLMFallbackPlanEntry[] {
  const friendKeys = friendApiKeys(config);
  const candidates: LLMFallbackPlanEntry[] = [
    { provider: "friend", apiKeys: friendKeys, baseUrl: config.friendBaseUrl, model: config.friendImageModel },
    { provider: "friend", apiKeys: friendKeys, baseUrl: config.friendBaseUrl, model: config.friendImageFallbackModel },
    { provider: "nvidia", apiKeys: config.nvidiaApiKeys, baseUrl: config.nvidiaBaseUrl, model: config.nvidiaImageModel },
    { provider: "nvidia", apiKeys: config.nvidiaApiKeys, baseUrl: config.nvidiaBaseUrl, model: config.nvidiaImageFallbackModel }
  ];
  const seen = new Set<string>();
  return candidates.filter((entry) => {
    if (!entry.model) return false;
    const key = `${entry.provider}:${entry.model}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export async function callLLMWithFallback<TParsed = string>({
  messages,
  config = getTraeConfig(),
  temperature = 0.2,
  responseFormat = "json_object",
  validateContent,
  fetchFn = fetch,
  sleepFn = async (delayMs) => {
    await sleep(delayMs);
  },
  nowFn = () => Date.now(),
  retryRateLimitsUntilCleared = true,
  plan
}: CallLLMWithFallbackOptions<TParsed>): Promise<LLMCallResult<TParsed>> {
  const callLogs: TraeLLMCallLog[] = [];
  const resolvedPlan = plan ?? buildLLMFallbackPlan(config);
  let fullPlanRateLimitRetries = 0;
  // Wall-clock ceiling for riding out rate limits. With aiMaxRateLimitRetries: 0 (unlimited
  // count), this is the ONLY thing that stops a fully-throttled endpoint from looping forever
  // and burning the entire cron budget on one call. 0 (or a best-effort caller) disables it.
  const rateLimitDeadlineAt =
    retryRateLimitsUntilCleared && config.aiMaxRateLimitWaitMs > 0
      ? nowFn() + config.aiMaxRateLimitWaitMs
      : null;

  while (true) {
    const saturatedProviders = new Set<TraeAIProvider>();
    let hitRateLimitThisPass = false;

  for (const entry of resolvedPlan) {
    if (saturatedProviders.has(entry.provider)) continue;

    const apiKeys = entry.apiKeys.filter(Boolean);
    if (apiKeys.length === 0) {
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

    let attemptIndex = 0;
    let otherRetries = 0;
    let rateLimitRetries = 0;
    let keyCursor = nextKeyIndex();
    let advanceToNextModel = false;

    while (!advanceToNextModel) {
      const apiKey = apiKeys[keyCursor % apiKeys.length];
      await waitForLLMRateLimit(apiKey, config.aiRpmLimit, sleepFn);
      const attempt = await callOneModel({
        entry,
        apiKey,
        messages,
        temperature,
        responseFormat,
        timeoutMs: config.aiRequestTimeoutMs,
        retryCount: attemptIndex,
        validateContent,
        fetchFn
      });
      callLogs.push(attempt.log);
      attemptIndex += 1;

      if (attempt.ok) {
        return {
          provider: entry.provider,
          model: entry.model,
          content: attempt.content,
          parsed: attempt.parsed,
          callLogs
        };
      }

      // Try every key/provider lane before waiting. This lets Friend throttles fall
      // through to NVIDIA capacity, while still waiting instead of failing when all
      // configured free lanes are saturated.
      if (retryRateLimitsUntilCleared && isRateLimitError(attempt.log.errorReason)) {
        hitRateLimitThisPass = true;
        rateLimitRetries += 1;
        keyCursor += 1;
        if (rateLimitRetries < apiKeys.length) continue;
        saturatedProviders.add(entry.provider);
        advanceToNextModel = true;
        continue;
      }

      // Other transient errors (5xx / timeout / network / bad JSON) — and rate limits
      // for best-effort callers — get a bounded per-model budget, then fall through to
      // the next model in the plan.
      if (otherRetries < config.aiMaxRetriesPerModel && isRetryableError(attempt.log.errorReason)) {
        otherRetries += 1;
        keyCursor += 1;
        await sleepFn(backoffDelayMs(otherRetries - 1, attempt.log.errorReason));
        continue;
      }

      advanceToNextModel = true;
    }
  }

    if (!retryRateLimitsUntilCleared || !hitRateLimitThisPass) {
      break;
    }

    fullPlanRateLimitRetries += 1;
    if (config.aiMaxRateLimitRetries > 0 && fullPlanRateLimitRetries > config.aiMaxRateLimitRetries) {
      break;
    }
    // Give up once the wall-clock ceiling is reached, even with unlimited retry count, so this
    // call fails fast and the caller can move on (the topic is retried on the next cron run)
    // instead of hanging until Cloud Run kills the whole request.
    if (rateLimitDeadlineAt !== null && nowFn() >= rateLimitDeadlineAt) {
      break;
    }
    await sleepFn(rateLimitBackoffMs(fullPlanRateLimitRetries));
  }

  throw new LLMFallbackError("All zero-budget LLM models failed.", callLogs);
}

export function formatLLMCallFailureSummary(callLogs: readonly TraeLLMCallLog[], maxEntries = 12): string {
  const failedLogs = callLogs.filter((log) => log.errorReason);
  const logsToShow = failedLogs.length > 0 ? failedLogs : callLogs;
  if (logsToShow.length === 0) return "No LLM attempts were recorded.";

  const lines = logsToShow.slice(0, maxEntries).map((log, index) => {
    const prefix = `${index + 1}. ${log.provider}:${log.model} retry=${log.retryCount} ${log.errorReason ?? "ok"} ${log.latencyMs}ms`;
    const detail = llmLogDetail(log);
    return detail ? `${prefix} - ${detail}` : prefix;
  });

  const omittedCount = logsToShow.length - lines.length;
  if (omittedCount > 0) {
    lines.push(`... ${omittedCount} more attempt(s) omitted.`);
  }

  return lines.join("\n");
}

function rateLimiterForKey(apiKey: string): LLMRateLimiterState {
  let state = llmRateLimiters.get(apiKey);
  if (!state) {
    state = { nextStartAtMs: 0, queue: Promise.resolve() };
    llmRateLimiters.set(apiKey, state);
  }
  return state;
}

async function waitForLLMRateLimit(
  apiKey: string,
  rpmLimit: number,
  sleepFn: (delayMs: number) => Promise<void>
): Promise<void> {
  const intervalMs = 60_000 / Math.max(1, Math.floor(rpmLimit));
  if (intervalMs <= 1) return;

  const state = rateLimiterForKey(apiKey);
  const previousQueue = state.queue.catch(() => undefined);
  const currentQueue = previousQueue.then(async () => {
    const now = Date.now();
    const waitMs = Math.max(0, state.nextStartAtMs - now);
    if (waitMs > 0) {
      await sleepFn(waitMs);
    }
    state.nextStartAtMs = Math.max(Date.now(), state.nextStartAtMs) + intervalMs;
  });

  state.queue = currentQueue.catch(() => undefined);
  await currentQueue;
}

/**
 * Same retry/fallback machinery as callLLMWithFallback, but scoped to verified
 * vision-capable models (see buildVisionLLMFallbackPlan) and free-form text output
 * instead of strict JSON, since vision descriptions are prose, not schema-bound.
 */
export async function callVisionLLMWithFallback<TParsed = string>(
  options: Omit<CallLLMWithFallbackOptions<TParsed>, "plan" | "responseFormat" | "retryRateLimitsUntilCleared">
): Promise<LLMCallResult<TParsed>> {
  const config = options.config ?? getTraeConfig();
  return callLLMWithFallback({
    ...options,
    config,
    responseFormat: "text",
    // Vision is best-effort: a throttled primary model should drop to the secondary
    // vision model (or return null), never block the judge pipeline waiting it out.
    retryRateLimitsUntilCleared: false,
    plan: buildVisionLLMFallbackPlan(config)
  });
}

interface CallOneModelOptions<TParsed> {
  entry: LLMFallbackPlanEntry;
  apiKey: string;
  messages: LLMMessage[];
  temperature: number;
  responseFormat: "json_object" | "text";
  timeoutMs: number;
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
  apiKey,
  messages,
  temperature,
  responseFormat,
  timeoutMs,
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
      headers: buildHeaders(apiKey),
      body: JSON.stringify(buildChatCompletionRequestBody(entry, messages, temperature, responseFormat))
    });
    rawResponse = await response.text();

    if (!response.ok) {
      return failedAttempt(entry, startedAt, retryCount, httpErrorReason(response.status), rawResponse);
    }

    const content = extractMessageContent(rawResponse);
    const tokenUsage = extractTokenUsage(rawResponse);
    if (!content) {
      const reason = emptyContentReason(rawResponse, tokenUsage);
      if (reason === "empty_content_billed") {
        console.warn(
          `[trae-llm] empty_content_billed: provider=${entry.provider} model=${entry.model} input=${tokenUsage.inputTokens} output=${tokenUsage.outputTokens} rawResponse=${truncateDiagnostic(rawResponse, 800)}`
        );
      }
      return failedAttempt(entry, startedAt, retryCount, reason, rawResponse, tokenUsage);
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
    return failedAttempt(entry, startedAt, retryCount, errorReason, rawResponse, undefined, describeThrownError(error));
  } finally {
    globalThis.clearTimeout(timeout);
  }
}

function buildChatCompletionRequestBody(
  entry: LLMFallbackPlanEntry,
  messages: LLMMessage[],
  temperature: number,
  responseFormat: "json_object" | "text"
): ChatCompletionRequestBody {
  const body: ChatCompletionRequestBody = {
    model: entry.model,
    messages,
    temperature
  };

  if (responseFormat === "json_object") {
    body.response_format = { type: "json_object" };
  }

  if (entry.provider === "nvidia" && isDeepSeekModel(entry.model)) {
    body.reasoning_effort = "max";
  }

  if (entry.provider === "nvidia" && isGemmaModel(entry.model)) {
    // Gemma thinking toggle; mirrors the NVIDIA integrate API chat_template_kwargs, same provider-gating as DeepSeek.
    body.chat_template_kwargs = { enable_thinking: true };
  }

  return body;
}

function isDeepSeekModel(model: string): boolean {
  return model.toLowerCase().startsWith("deepseek-ai/");
}

function isGemmaModel(model: string): boolean {
  return model.toLowerCase().startsWith("google/gemma-");
}

function buildHeaders(apiKey: string): Headers {
  return new Headers({
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json"
  });
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
function emptyContentReason(
  rawResponse: string,
  tokenUsage: { inputTokens: number; outputTokens: number }
): "rate_limited" | "empty_content_billed" | "invalid_response" {
  try {
    const json = JSON.parse(rawResponse) as { choices?: unknown };
    if (Array.isArray(json.choices) && json.choices.length === 0) {
      // NVIDIA true soft-429: empty choices + usage:null (inputTokens=0) — retryable.
      // friend gateway anomaly: empty choices WITH billed input tokens — not retryable.
      return tokenUsage.inputTokens > 0 ? "empty_content_billed" : "rate_limited";
    }
    // choices 非空但 content 为空 + 已计费 input token → 模型/网关级问题，重试无意义
    if (Array.isArray(json.choices) && json.choices.length > 0 && tokenUsage.inputTokens > 0) {
      return "empty_content_billed";
    }
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
  tokenUsage = { inputTokens: 0, outputTokens: 0 },
  errorDetails?: string
): CallOneModelResult<never> {
  return {
    ok: false,
    log: {
      provider: entry.provider,
      model: entry.model,
      latencyMs: Date.now() - startedAt,
      retryCount,
      errorReason,
      errorDetails,
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

/** HTTP 429 and NVIDIA's soft-429 (HTTP 200 with empty choices) — a per-key rate limit. */
function isRateLimitError(errorReason: string | null): boolean {
  return errorReason === "http_429" || errorReason === "rate_limited";
}

// empty_content_billed is intentionally NOT retryable: when a model returns 200 OK with
// input tokens billed but empty content, retrying the same model just wastes tokens —
// the failure is model/gateway-level, so we advance to the next model immediately.
function isRetryableError(errorReason: string | null): boolean {
  return (
    isRateLimitError(errorReason) ||
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
  const baseMs = isRateLimitError(errorReason) ? 2000 : 1000;
  return Math.min(30_000, baseMs * 2 ** retryCount);
}

/**
 * Backoff between rate-limit retries. Plateaus at 15s so an unlimited retry loop
 * (aiMaxRateLimitRetries === 0) settles into a steady wait-and-rotate cadence
 * instead of exploding: 2s, 4s, 8s, 15s, 15s, …
 */
function rateLimitBackoffMs(retryNumber: number): number {
  const exponent = Math.min(Math.max(0, retryNumber - 1), 3);
  return Math.min(15_000, 2_000 * 2 ** exponent);
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

function llmLogDetail(log: TraeLLMCallLog): string {
  if (log.errorDetails) return truncateDiagnostic(log.errorDetails);
  if (log.rawResponse) return truncateDiagnostic(log.rawResponse);
  return "";
}

function describeThrownError(error: unknown): string {
  const parts: string[] = [];
  appendErrorDetails(parts, error);
  if (typeof error === "object" && error !== null && "cause" in error) {
    appendErrorDetails(parts, (error as { cause?: unknown }).cause);
  }
  return truncateDiagnostic(parts.join("; "));
}

function appendErrorDetails(parts: string[], error: unknown): void {
  if (!error) return;
  if (error instanceof Error) {
    const code = typeof (error as Error & { code?: unknown }).code === "string" ? (error as Error & { code: string }).code : null;
    parts.push([error.message, code].filter(Boolean).join(" "));
    return;
  }
  if (typeof error === "string") {
    parts.push(error);
    return;
  }
  parts.push(String(error));
}

export function truncateDiagnostic(value: string, maxLength = 500): string {
  const sanitized = value
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, "Bearer [redacted]")
    .replace(/((?:api[_-]?key|access_token|token)=)[^&\s]+/gi, "$1[redacted]")
    .replace(/sk-[A-Za-z0-9_-]{12,}/g, "sk-[redacted]")
    .replace(/\s+/g, " ")
    .trim();
  if (sanitized.length <= maxLength) return sanitized;
  return `${sanitized.slice(0, maxLength - 1)}…`;
}
