import type { TraeSourceType } from "./types.ts";

export interface TraeConfig {
  openRouterApiKey: string | null;
  openRouterPrimaryModel: string;
  openRouterFallbackModels: string[];
  openRouterSiteUrl: string;
  openRouterAppName: string;
  scraperUserAgent: string;
  adminToken: string | null;
  cronSecret: string | null;
  maxScrapePagesPerRun: number;
  maxTopicDetailsPerRun: number;
  maxJudgePerRun: number;
  openRouterRpm: number;
  openRouterDailyCap: number;
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

export function getTraeConfig(): TraeConfig {
  return {
    openRouterApiKey: process.env.OPENROUTER_API_KEY ?? null,
    openRouterPrimaryModel: process.env.OPENROUTER_PRIMARY_MODEL ?? "openai/gpt-oss-120b",
    openRouterFallbackModels: listFromEnv("OPENROUTER_FALLBACK_MODELS", [
      "nvidia/nemotron-3-ultra-550b-a55b:free",
      "google/gemma-4-31b-it:free"
    ]),
    openRouterSiteUrl: process.env.OPENROUTER_SITE_URL ?? "https://rateministere.com",
    openRouterAppName: process.env.OPENROUTER_APP_NAME ?? "RateMinistere TRAE Contest 2026",
    scraperUserAgent:
      process.env.TRAE_SCRAPER_USER_AGENT ??
      "RateMinistere TRAE Contest Rank Bot; contact: noahzh52@gmail.com",
    adminToken: process.env.TRAE_ADMIN_TOKEN ?? null,
    cronSecret: process.env.TRAE_CRON_SECRET ?? null,
    maxScrapePagesPerRun: numberFromEnv("TRAE_MAX_SCRAPE_PAGES_PER_RUN", 10),
    maxTopicDetailsPerRun: numberFromEnv("TRAE_MAX_TOPIC_DETAILS_PER_RUN", 100),
    maxJudgePerRun: numberFromEnv("TRAE_MAX_JUDGE_PER_RUN", 50),
    openRouterRpm: numberFromEnv("TRAE_OPENROUTER_RPM", 15),
    openRouterDailyCap: numberFromEnv("TRAE_OPENROUTER_DAILY_CAP", 0),
    categoryUrls: {
      signup: "https://forum.trae.cn/c/38-category/39-category/39",
      preliminary: "https://forum.trae.cn/c/38-category/40-category/40"
    }
  };
}

export function getModelSequence(config = getTraeConfig()): string[] {
  return [config.openRouterPrimaryModel, ...config.openRouterFallbackModels].filter(Boolean);
}
