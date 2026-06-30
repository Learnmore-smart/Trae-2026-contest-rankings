import type { TraeSourceType } from "./types.ts";

export type AIProvider = "nvidia" | "openrouter";

export interface TraeConfig {
  nvidiaApiKey: string | null;
  nvidiaBaseUrl: string;
  nvidiaPrimaryModel: string;
  nvidiaFallbackModels: string[];
  nvidiaImageModel: string;
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
  const providers = listFromEnv("AI_PROVIDER_ORDER", ["nvidia", "openrouter"]).filter(
    (provider): provider is AIProvider => provider === "nvidia" || provider === "openrouter"
  );
  const deduped = providers.filter((provider) => {
    if (seen.has(provider)) return false;
    seen.add(provider);
    return true;
  });
  return deduped.length > 0 ? deduped : ["nvidia", "openrouter"];
}

export function getTraeConfig(): TraeConfig {
  const aiMaxRetriesPerModel = Math.max(0, Math.floor(numberFromEnv("AI_MAX_RETRIES_PER_MODEL", 2)));
  const aiRequestTimeoutMs = Math.max(1, Math.floor(numberFromEnv("AI_REQUEST_TIMEOUT_MS", 120_000)));
  const aiRpmLimit = Math.max(1, Math.floor(numberFromEnv("AI_RPM_LIMIT", 30)));

  return {
    nvidiaApiKey: process.env.NVIDIA_API_KEY ?? null,
    nvidiaBaseUrl: process.env.NVIDIA_BASE_URL ?? "https://integrate.api.nvidia.com/v1",
    nvidiaPrimaryModel: process.env.NVIDIA_PRIMARY_MODEL ?? "moonshotai/kimi-k2.6",
    nvidiaFallbackModels: listFromEnv("NVIDIA_FALLBACK_MODELS", [
      "z-ai/glm-5.1",
      "deepseek-ai/deepseek-v4-flash"
    ]),
    nvidiaImageModel: process.env.NVIDIA_IMAGE_MODEL ?? "moonshotai/kimi-k2.6",
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
    scraperUserAgent:
      process.env.TRAE_SCRAPER_USER_AGENT ??
      "RateMinistere TRAE Contest Rank Bot; contact: noahzh52@gmail.com",
    adminToken: process.env.TRAE_ADMIN_TOKEN ?? null,
    cronSecret: process.env.TRAE_CRON_SECRET ?? null,
    maxScrapePagesPerRun: numberFromEnv("TRAE_MAX_SCRAPE_PAGES_PER_RUN", 10),
    maxTopicDetailsPerRun: numberFromEnv("TRAE_MAX_TOPIC_DETAILS_PER_RUN", 100),
    maxJudgePerRun: numberFromEnv("TRAE_MAX_JUDGE_PER_RUN", 50),
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
