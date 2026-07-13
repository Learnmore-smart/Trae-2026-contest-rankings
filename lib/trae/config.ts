import type { TraeSourceType } from "./types.ts";
import { DEFAULT_JUDGE_BATCH_MAX, DEFAULT_JUDGE_CONCURRENCY } from "./judge-policy.ts";

export type AIProvider = "friend" | "nvidia";

export interface TraeConfig {
  /**
   * "Friend" endpoint: a new-api (OpenAI-compatible) gateway that serves the same
   * NVIDIA-family model IDs but with much higher rate limits than the direct NVIDIA
   * integrate API. Used as the primary provider; NVIDIA direct is the fallback.
   */
  friendApiKey: string | null;
  friendBaseUrl: string;
  friendPrimaryModel: string;
  friendFallbackModels: string[];
  /** Vision-capable model on the friend endpoint (used before falling back to NVIDIA vision). */
  friendImageModel: string;
  friendImageFallbackModel: string;
  /** First NVIDIA key; kept for callers that only need a single key. Equals nvidiaApiKeys[0]. */
  nvidiaApiKey: string | null;
  /**
   * All configured NVIDIA keys: NVIDIA_API_KEY plus NVIDIA_API_KEY_2..N (and commas
   * within any of them). Each key carries its own rate-limit budget, so N keys give
   * N × aiRpmLimit total throughput. The client round-robins across them.
   */
  nvidiaApiKeys: string[];
  nvidiaBaseUrl: string;
  nvidiaPrimaryModel: string;
  nvidiaFallbackModels: string[];
  nvidiaImageModel: string;
  /** Secondary vision-capable model when the primary image model soft-throttles. */
  nvidiaImageFallbackModel: string;
  aiProviderOrder: AIProvider[];
  aiZeroBudgetOnly: boolean;
  /** Requests-per-minute ceiling enforced PER API KEY (not globally). Applies to the friend gateway (high limit). */
  aiRpmLimit: number;
  /**
   * Requests-per-minute ceiling enforced PER NVIDIA API KEY. NVIDIA integrate direct only allows
   * ~40 rpm/key, far below the friend gateway. Pacing NVIDIA keys at the friend rate (aiRpmLimit)
   * causes HTTP 429s and raises the error rate, so NVIDIA gets its own lower ceiling. With 2 keys
   * this is 2 × nvidiaRpmLimit total NVIDIA throughput, used in parallel with the friend gateway.
   */
  nvidiaRpmLimit: number;
  /** Retry budget for non-rate-limit transient errors (5xx/timeout/network/bad JSON) before falling to the next model. */
  aiMaxRetriesPerModel: number;
  /** Retry budget for rate limits (HTTP 429 + NVIDIA soft-429). 0 = unlimited: retry (rotating keys) until it clears. */
  aiMaxRateLimitRetries: number;
  /**
   * Wall-clock ceiling (ms) for how long a SINGLE llm call may ride out rate limits before it
   * gives up and throws. Bounds `aiMaxRateLimitRetries: 0` (unlimited count) so one throttled
   * judge call can never consume the whole cron budget. 0 = unlimited (legacy behavior).
   */
  aiMaxRateLimitWaitMs: number;
  aiRequestTimeoutMs: number;
  judgeConcurrency: number;
  /**
   * Soft wall-clock budget (ms) for one judge batch. Once elapsed, workers stop picking up NEW
   * topics and let in-flight ones drain, so the run finalizes (finishRun + board snapshot)
   * within the Cloud Run request timeout instead of being killed mid-flight — which would
   * leave a zombie RUNNING run and a frozen public snapshot. 0 = unlimited (legacy behavior).
   */
  judgeBatchDeadlineMs: number;
  /**
   * After the soft deadline, how long (ms) to wait for in-flight topics before abandoning the
   * concurrency await and calling finishRun anyway. Soft + hardDrain must stay under the Cloud
   * Run request timeout (~900s). 0 = wait forever for drain (legacy soft-only behavior).
   */
  judgeBatchHardDrainMs: number;
  scraperUserAgent: string;
  adminToken: string | null;
  cronSecret: string | null;
  maxScrapePagesPerRun: number;
  maxTopicDetailsPerRun: number;
  maxJudgePerRun: number;
  /** Ceiling on per-author forum signup lookups the matcher runs per pass; <=0 means unlimited. */
  maxForumLookupsPerRun: number;
  /** How many forum author lookups the matcher runs in parallel. */
  forumLookupConcurrency: number;
  /** Minimum spacing (ms) between request *starts* to a single forum host. Lower = faster, but the forum may throttle. */
  forumMinRequestMs: number;
  /** Per-request retry budget for retryable forum responses (429/403/5xx). */
  forumMaxRetries: number;
  categoryUrls: Record<TraeSourceType, string>;
}

function numberFromEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function listFromEnv(name: string, fallback: string[]): string[] {
  const raw = process.env[name];
  if (!raw) return fallback;
  return raw
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function booleanFromEnv(name: string, fallback: boolean): boolean {
  const raw = process.env[name];
  if (!raw) return fallback;
  return ["1", "true", "yes", "on"].includes(raw.trim().toLowerCase());
}

/**
 * Collects every NVIDIA key: NVIDIA_API_KEY, then NVIDIA_API_KEY_2..N (numbered
 * suffixes are how a second 40-rpm key is added). Commas inside any single value
 * are also split, so "k1,k2" works too. Deduped, empties dropped, order preserved.
 */
function collectNvidiaApiKeys(): string[] {
  const keys: string[] = [];
  const push = (raw: string | undefined) => {
    if (!raw) return;
    for (const part of raw.split(",")) {
      const key = part.trim();
      if (key) keys.push(key);
    }
  };
  push(process.env.NVIDIA_API_KEY);
  for (let index = 2; index <= 20; index += 1) {
    push(process.env[`NVIDIA_API_KEY_${index}`]);
  }
  return [...new Set(keys)];
}

function providerOrderFromEnv(): AIProvider[] {
  const seen = new Set<AIProvider>();
  const providers = listFromEnv("AI_PROVIDER_ORDER", ["friend", "nvidia"]).filter(
    (provider): provider is AIProvider =>
      provider === "friend" || provider === "nvidia"
  );
  const deduped = providers.filter((provider) => {
    if (seen.has(provider)) return false;
    seen.add(provider);
    return true;
  });
  return deduped.length > 0 ? deduped : ["friend", "nvidia"];
}

export function getTraeConfig(): TraeConfig {
  const aiMaxRetriesPerModel = Math.max(0, Math.floor(numberFromEnv("AI_MAX_RETRIES_PER_MODEL", 2)));
  // 0 = unlimited (retry rate limits until they clear); >0 caps it and then falls to the next model.
  const aiMaxRateLimitRetries = Math.max(0, Math.floor(numberFromEnv("AI_MAX_RATE_LIMIT_RETRIES", 0)));
  // Default 90s: long enough to outlast a normal throttle burst, short enough that a single
  // stuck call can't monopolize the ~900s cron budget. 0 disables the ceiling (unlimited wait).
  const aiMaxRateLimitWaitMs = Math.max(0, Math.floor(numberFromEnv("AI_MAX_RATE_LIMIT_WAIT_MS", 90_000)));
  const aiRequestTimeoutMs = Math.max(1, Math.floor(numberFromEnv("AI_REQUEST_TIMEOUT_MS", 120_000)));
  const aiRpmLimit = Math.max(1, Math.floor(numberFromEnv("AI_RPM_LIMIT", 40)));
  // NVIDIA integrate direct is ~40 rpm/key; keep its own ceiling so friend can run much higher
  // without tripping NVIDIA's 429 limit. Defaults to min(aiRpmLimit, 40) when unset.
  const nvidiaRpmLimit = Math.max(1, Math.floor(numberFromEnv("NVIDIA_RPM_LIMIT", Math.min(aiRpmLimit, 40))));
  const nvidiaApiKeys = collectNvidiaApiKeys();

  return {
    friendApiKey: process.env.TRAE_FRIEND_API ?? null,
    friendBaseUrl: process.env.TRAE_FRIEND_BASE_URL ?? "http://47.93.17.237:8889/v1",
    // 2026-07-13 full-gateway probe (probe.mjs / scan.mjs). Reliable + fast text models on the
    // friend gateway that return clean JSON with real output tokens:
    //   openai/gpt-oss-120b (~3.5s, most stable) → deepseek-ai/DeepSeek-V3.2 (~2.3s) →
    //   nvidia/nemotron-3-ultra-550b-a55b (~4s). NVIDIA direct runs z-ai/glm-5.2 (~1.2s, 2 keys).
    // Excluded (timeout / degraded / dirty output): deepseek-v4-pro (43-60s, flaky),
    //   z-ai/glm-5.2 on friend (timeout), grok-4.5 (timeout / empty), minimax-m3 (400 DEGRADED),
    //   minimax-m2.7 (>60s), DeepSeek-V3.1 (wraps JSON in ``` fences), deepseek-v4-flash (garbled).
    //
    // Vision is best-effort (falls through to null, never blocks text). No model reads images
    // reliably on the gateway right now; chain is grok-4.5 → gemma-4-31b-it → minimax-m3.
    friendPrimaryModel: process.env.FRIEND_PRIMARY_MODEL ?? "deepseek-ai/deepseek-v4-pro",
    friendFallbackModels: listFromEnv("FRIEND_FALLBACK_MODELS", [
      "nvidia/nemotron-3-ultra-550b-a55b"
    ]),
    friendImageModel: process.env.FRIEND_IMAGE_MODEL ?? "grok-4.5",
    friendImageFallbackModel: process.env.FRIEND_IMAGE_FALLBACK_MODEL ?? "google/gemma-4-31b-it",
    nvidiaApiKey: nvidiaApiKeys[0] ?? null,
    nvidiaApiKeys,
    nvidiaBaseUrl: process.env.NVIDIA_BASE_URL ?? "https://integrate.api.nvidia.com/v1",
    // z-ai/glm-5.2 is the fastest reliable model on NVIDIA direct (~1.2s) and runs across both
    // NVIDIA keys in parallel with the friend gateway. gemma-4-31b-it is a slow last resort.
    nvidiaPrimaryModel: process.env.NVIDIA_PRIMARY_MODEL ?? "z-ai/glm-5.2",
    nvidiaFallbackModels: listFromEnv("NVIDIA_FALLBACK_MODELS", [
      "google/gemma-4-31b-it"
    ]),
    // NVIDIA vision uses ONLY gemma-4-31b-it (no NVIDIA fallback). Vision chain overall:
    // grok-4.5 (friend) → gemma (friend) → gemma (NVIDIA). Vision is best-effort.
    nvidiaImageModel: process.env.NVIDIA_IMAGE_MODEL ?? "google/gemma-4-31b-it",
    nvidiaImageFallbackModel: process.env.NVIDIA_IMAGE_FALLBACK_MODEL ?? "",
    aiProviderOrder: providerOrderFromEnv(),
    aiZeroBudgetOnly: booleanFromEnv("AI_ZERO_BUDGET_ONLY", true),
    aiRpmLimit,
    nvidiaRpmLimit,
    aiMaxRetriesPerModel,
    aiMaxRateLimitRetries,
    aiMaxRateLimitWaitMs,
    aiRequestTimeoutMs,
    judgeConcurrency: Math.max(1, Math.floor(numberFromEnv("TRAE_JUDGE_CONCURRENCY", DEFAULT_JUDGE_CONCURRENCY))),
    // Default 690s (11.5 min): leaves ~3.5 min under the 900s Cloud Run timeout for the last
    // in-flight wave to drain (each call bounded by aiMaxRateLimitWaitMs) plus finishRun +
    // snapshot. 0 disables the batch deadline (legacy: run until Cloud Run kills it).
    judgeBatchDeadlineMs: Math.max(0, Math.floor(numberFromEnv("TRAE_JUDGE_BATCH_DEADLINE_MS", 690_000))),
    // Default 90s hard drain after soft deadline: if in-flight topics hang (rate limits /
    // vision / multi-evaluator), still finishRun before Cloud Run's 900s kill leaves a zombie.
    // 690 + 90 = 780 < 900; run-all's 300 + 90 = 390 per pass.
    judgeBatchHardDrainMs: Math.max(0, Math.floor(numberFromEnv("TRAE_JUDGE_BATCH_HARD_DRAIN_MS", 90_000))),
    scraperUserAgent:
      process.env.TRAE_SCRAPER_USER_AGENT ??
      "RateMinistere TRAE Contest Rank Bot; contact: noahzh52@gmail.com",
    adminToken: (process.env.TRAE_ADMIN_TOKEN ?? "").trim() || null,
    cronSecret: (process.env.TRAE_CRON_SECRET ?? "").trim() || null,
    maxScrapePagesPerRun: numberFromEnv("TRAE_MAX_SCRAPE_PAGES_PER_RUN", 10),
    maxTopicDetailsPerRun: numberFromEnv("TRAE_MAX_TOPIC_DETAILS_PER_RUN", 100),
    maxJudgePerRun: Math.max(1, Math.floor(numberFromEnv("TRAE_MAX_JUDGE_PER_RUN", DEFAULT_JUDGE_BATCH_MAX))),
    // Default unlimited: SQL is fixed-cost and the AI API is free, so the matcher
    // resolves every author's 报名帖 in one pass. The forum host is the only limiter,
    // governed by forumMinRequestMs + the fetch backoff.
    maxForumLookupsPerRun: numberFromEnv("TRAE_MAX_FORUM_LOOKUPS_PER_RUN", 0),
    forumLookupConcurrency: Math.max(1, Math.floor(numberFromEnv("TRAE_FORUM_LOOKUP_CONCURRENCY", 16))),
    forumMinRequestMs: Math.max(0, Math.floor(numberFromEnv("TRAE_FORUM_MIN_REQUEST_MS", 150))),
    forumMaxRetries: Math.max(0, Math.floor(numberFromEnv("TRAE_FORUM_MAX_RETRIES", 5))),
    categoryUrls: {
      signup: "https://forum.trae.cn/c/38-category/39-category/39",
      preliminary: "https://forum.trae.cn/c/38-category/40-category/40"
    }
  };
}
