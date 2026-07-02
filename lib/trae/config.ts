import type { TraeSourceType } from "./types.ts";
import { DEFAULT_JUDGE_BATCH_MAX, DEFAULT_JUDGE_CONCURRENCY } from "./judge-policy.ts";

export type AIProvider = "friend" | "nvidia" | "openrouter";

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
  nvidiaApiKey: string | null;
  nvidiaBaseUrl: string;
  nvidiaPrimaryModel: string;
  nvidiaFallbackModels: string[];
  nvidiaImageModel: string;
  /** Secondary vision-capable model when the primary image model soft-throttles. */
  nvidiaImageFallbackModel: string;
  openRouterApiKey: string | null;
  openRouterBaseUrl: string;
  openRouterPrimaryModel: string;
  openRouterFallbackModels: string[];
  openRouterSiteUrl: string;
  openRouterAppName: string;
  aiProviderOrder: AIProvider[];
  aiZeroBudgetOnly: boolean;
  aiRpmLimit: number;
  aiMaxRetriesPerModel: number;
  aiRequestTimeoutMs: number;
  judgeConcurrency: number;
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

function providerOrderFromEnv(): AIProvider[] {
  const seen = new Set<AIProvider>();
  const providers = listFromEnv("AI_PROVIDER_ORDER", ["friend", "nvidia"]).filter(
    (provider): provider is AIProvider =>
      provider === "friend" || provider === "nvidia" || provider === "openrouter"
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
  const aiRequestTimeoutMs = Math.max(1, Math.floor(numberFromEnv("AI_REQUEST_TIMEOUT_MS", 120_000)));
  const aiRpmLimit = Math.max(1, Math.floor(numberFromEnv("AI_RPM_LIMIT", 40)));

  return {
    friendApiKey: process.env.TRAE_FRIEND_API ?? null,
    friendBaseUrl: process.env.TRAE_FRIEND_BASE_URL ?? "http://47.93.17.237:8889/v1",
    friendPrimaryModel: process.env.FRIEND_PRIMARY_MODEL ?? "deepseek-ai/deepseek-v4-pro",
    // deepseek-v4-flash (hangs past timeout) and glm-5.1 (410 EOL 2026-07-02) are
    // deliberately excluded — both fail on this backend and only burn wall-clock.
    friendFallbackModels: listFromEnv("FRIEND_FALLBACK_MODELS", [
      "minimaxai/minimax-m3",
      "moonshotai/kimi-k2.6"
    ]),
    friendImageModel: process.env.FRIEND_IMAGE_MODEL ?? "moonshotai/kimi-k2.6",
    friendImageFallbackModel: process.env.FRIEND_IMAGE_FALLBACK_MODEL ?? "minimaxai/minimax-m3",
    nvidiaApiKey: process.env.NVIDIA_API_KEY ?? null,
    nvidiaBaseUrl: process.env.NVIDIA_BASE_URL ?? "https://integrate.api.nvidia.com/v1",
    nvidiaPrimaryModel: process.env.NVIDIA_PRIMARY_MODEL ?? "deepseek-ai/deepseek-v4-pro",
    // Same exclusions as the friend chain: flash hangs, glm-5.1 is 410 EOL.
    nvidiaFallbackModels: listFromEnv("NVIDIA_FALLBACK_MODELS", [
      "minimaxai/minimax-m3",
      "moonshotai/kimi-k2.6"
    ]),
    nvidiaImageModel: process.env.NVIDIA_IMAGE_MODEL ?? "moonshotai/kimi-k2.6",
    nvidiaImageFallbackModel: process.env.NVIDIA_IMAGE_FALLBACK_MODEL ?? "minimaxai/minimax-m3",
    openRouterApiKey: process.env.OPENROUTER_API_KEY ?? null,
    openRouterBaseUrl: process.env.OPENROUTER_BASE_URL ?? "https://openrouter.ai/api/v1",
    openRouterPrimaryModel: process.env.OPENROUTER_PRIMARY_MODEL ?? "openai/gpt-oss-120b:free",
    openRouterFallbackModels: listFromEnv("OPENROUTER_FALLBACK_MODELS", [
      "nvidia/nemotron-3-ultra-550b-a55b:free",
      "google/gemma-4-31b-it:free"
    ]),
    openRouterSiteUrl: process.env.OPENROUTER_SITE_URL ?? "https://rateministere.com",
    openRouterAppName: process.env.OPENROUTER_APP_NAME ?? "RateMinistere TRAE Contest 2026",
    aiProviderOrder: providerOrderFromEnv(),
    aiZeroBudgetOnly: booleanFromEnv("AI_ZERO_BUDGET_ONLY", true),
    aiRpmLimit,
    aiMaxRetriesPerModel,
    aiRequestTimeoutMs,
    judgeConcurrency: Math.max(1, Math.floor(numberFromEnv("TRAE_JUDGE_CONCURRENCY", DEFAULT_JUDGE_CONCURRENCY))),
    scraperUserAgent:
      process.env.TRAE_SCRAPER_USER_AGENT ??
      "RateMinistere TRAE Contest Rank Bot; contact: noahzh52@gmail.com",
    adminToken: process.env.TRAE_ADMIN_TOKEN ?? null,
    cronSecret: process.env.TRAE_CRON_SECRET ?? null,
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
