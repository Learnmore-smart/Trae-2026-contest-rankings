import { setTimeout as sleep } from "node:timers/promises";
import * as cheerio from "cheerio";
import { getTraeConfig } from "./config.ts";
import { extractTopicSignals, getContentHash, htmlToText, normalizeWhitespace } from "./extractors.ts";
import { getDataConnectDb, nowIso } from "./dataconnect.ts";
import { getTopicDetail, getScrapeCursor, upsertScrapeCursor, upsertTopic as upsertTopicMutation, updateTopicEvaluationState } from "@trae-contest/dataconnect-generated";
import { finishRun, startRun } from "./runs.ts";
import type { TraeScrapeCursor, TraeSourceType, TraeTopic } from "./types.ts";



function sanitizeTags(tags: unknown[] | undefined): string[] {
  if (!tags || !Array.isArray(tags)) return [];
  return tags.map((tag) => {
    if (typeof tag === "string") return tag;
    if (tag && typeof tag === "object") {
      const record = tag as Record<string, unknown>;
      return String(record.name || record.slug || record.id || JSON.stringify(tag));
    }
    return String(tag);
  }).filter(Boolean);
}

export interface CategoryTopicRef {
  externalTopicId: string;
  slug: string;
  title: string;
  url: string;
  rawJson?: unknown;
}

const TRAE_FORUM_ORIGIN = "https://forum.trae.cn";
const PRELIMINARY_CATEGORY_TEXT = "大赛初赛专区";

export class TraeForumUrlError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TraeForumUrlError";
  }
}

export interface FetchTopicOptions {
  requirePreliminaryCategory?: boolean;
}

interface FetchResult {
  url: string;
  body: string;
  contentType: string;
}

const nextHostSlotAt = new Map<string, number>();
const hostCooldownUntil = new Map<string, number>();
const MAX_RAW_JSON_CHARS = 100_000;
const MAX_BACKOFF_MS = 60_000;
// Retryable at all. 429/503/403 additionally trigger a host-wide cooldown so a rate
// limit hit by one concurrent worker backs the whole fleet off, not just that request.
const RETRYABLE_STATUSES = new Set([403, 408, 425, 429, 500, 502, 503, 504]);
const RATE_LIMIT_STATUSES = new Set([403, 429, 503]);

/** Parse an HTTP `Retry-After` header (delta-seconds or HTTP-date) into ms, or null. */
export function parseRetryAfterMs(headerValue: string | null | undefined): number | null {
  if (!headerValue) return null;
  const trimmed = headerValue.trim();
  if (/^\d+$/.test(trimmed)) return Math.max(0, Number(trimmed) * 1000);
  const dateMs = Date.parse(trimmed);
  if (!Number.isNaN(dateMs)) return Math.max(0, dateMs - Date.now());
  return null;
}

/**
 * Pause every request to a host until `now + ms`. `waitForHost` honors it, so a
 * single 429 throttles all concurrent workers instead of triggering a 429 storm.
 */
function applyHostCooldown(url: string, ms: number): void {
  const host = new URL(url).host;
  const until = Date.now() + Math.min(MAX_BACKOFF_MS, ms);
  if (until > (hostCooldownUntil.get(host) ?? 0)) hostCooldownUntil.set(host, until);
}

export function isRankableDiscourseTopic(topic: {
  id?: number;
  title?: string;
  fancy_title?: string;
  pinned?: boolean;
  pinned_globally?: boolean;
  visible?: boolean;
  archived?: boolean;
  archetype?: string;
}): boolean {
  if (!topic.id) return false;
  if (topic.visible === false) return false;
  if (topic.pinned || topic.pinned_globally) return false;
  if (topic.archived) return false;
  if (topic.archetype && topic.archetype !== "regular") return false;
  return true;
}

export function sanitizeRawJsonForDataConnect(payload: unknown): string | null {
  try {
    const serialized = JSON.stringify(payload);
    if (!serialized) return null;
    return serialized.length > MAX_RAW_JSON_CHARS ? serialized.slice(0, MAX_RAW_JSON_CHARS) : serialized;
  } catch {
    return null;
  }
}

/**
 * Per-host throttle that is safe under concurrency: each caller atomically claims
 * the next start slot (spaced by `forumMinRequestMs`) before any await, so N
 * parallel callers queue in order instead of all bursting off the same timestamp.
 * Spacing applies to request *starts*, so up to ~latency/spacing requests stay in
 * flight at once — concurrency masks latency without exceeding the host's rate.
 */
async function waitForHost(url: string): Promise<void> {
  const host = new URL(url).host;
  const minMs = getTraeConfig().forumMinRequestMs;
  const now = Date.now();
  // A claimed slot never starts before the host's active cooldown, so a 429 backoff
  // applies to every queued worker, not only the one that got rate-limited.
  const slot = Math.max(now, nextHostSlotAt.get(host) ?? 0, hostCooldownUntil.get(host) ?? 0);
  nextHostSlotAt.set(host, slot + minMs);
  if (slot > now) await sleep(slot - now);
}

async function fetchText(url: string, accept: string, attempt = 0): Promise<FetchResult> {
  const config = getTraeConfig();
  await waitForHost(url);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: accept,
        "User-Agent": config.scraperUserAgent
      }
    });
    const body = await response.text();
    if (!response.ok) {
      if (RETRYABLE_STATUSES.has(response.status) && attempt < config.forumMaxRetries) {
        const retryAfterMs = parseRetryAfterMs(response.headers.get("retry-after"));
        const backoffMs = Math.min(MAX_BACKOFF_MS, 1000 * 2 ** attempt);
        const waitMs = Math.min(MAX_BACKOFF_MS, Math.max(retryAfterMs ?? 0, backoffMs));
        if (RATE_LIMIT_STATUSES.has(response.status)) {
          // Park the whole host: the retry (and every other worker) waits this out
          // via waitForHost, so we stop hammering a forum that's already pushing back.
          applyHostCooldown(url, waitMs);
        } else {
          await sleep(waitMs);
        }
        return fetchText(url, accept, attempt + 1);
      }
      throw new Error(`Fetch ${response.status} for ${url}: ${body.slice(0, 300)}`);
    }
    return {
      url: response.url,
      body,
      contentType: response.headers.get("content-type") ?? ""
    };
  } finally {
    clearTimeout(timeout);
  }
}

export async function tryFetchJson(url: string, attempts = 3): Promise<unknown | null> {
  // Retry transient network/parse failures: a single flaky failure here was enough to
  // make a whole scrape come back empty and fall through to the noisy HTML path.
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const result = await fetchText(url, "application/json,text/json;q=0.9,*/*;q=0.1");
      return JSON.parse(result.body) as unknown;
    } catch {
      if (attempt < attempts - 1) await sleep(Math.min(8000, 1000 * 2 ** attempt));
    }
  }
  return null;
}

function categoryJsonUrl(sourceUrl: string, page: number): string {
  const jsonUrl = sourceUrl.endsWith("/") ? `${sourceUrl.slice(0, -1)}.json` : `${sourceUrl}.json`;
  if (page <= 0) return jsonUrl;
  const url = new URL(jsonUrl);
  url.searchParams.set("page", String(page));
  return url.toString();
}

function decodeTopicSlug(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export function parseTraeForumTopicUrl(rawUrl: string): CategoryTopicRef {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl.trim());
  } catch {
    throw new TraeForumUrlError("请输入有效的 TRAE 论坛链接。");
  }

  if (parsed.origin !== TRAE_FORUM_ORIGIN) {
    throw new TraeForumUrlError("链接必须来自 https://forum.trae.cn/。");
  }

  const segments = parsed.pathname.replace(/\/+$/, "").split("/").filter(Boolean);
  if (segments[0] !== "t") {
    throw new TraeForumUrlError("请输入 TRAE 论坛帖子链接，而不是分类或首页链接。");
  }

  const idSegment = segments.length >= 3 ? segments[2] : segments[1];
  const externalTopicId = idSegment?.replace(/\.json$/, "");
  if (!externalTopicId || !/^\d+$/.test(externalTopicId)) {
    throw new TraeForumUrlError("无法从链接中识别帖子 ID。");
  }

  const slug = segments.length >= 3 ? decodeTopicSlug(segments[1]) : "topic";
  const encodedSlug = encodeURIComponent(slug || "topic");

  return {
    externalTopicId,
    slug,
    title: `Topic ${externalTopicId}`,
    url: `${TRAE_FORUM_ORIGIN}/t/${encodedSlug}/${externalTopicId}`
  };
}

function includesPreliminaryCategoryText(value: string): boolean {
  return normalizeWhitespace(value).includes(PRELIMINARY_CATEGORY_TEXT);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function hasPreliminaryCategorySegment(value: string): boolean {
  const normalized = normalizeWhitespace(value);
  if (!includesPreliminaryCategoryText(normalized)) return false;
  const label = escapeRegExp(PRELIMINARY_CATEGORY_TEXT);
  return new RegExp(`(?:^|[\\s/|\\-｜])【?${label}】?(?:$|[\\s/|\\-｜])`).test(normalized);
}

function pageTitleHasPreliminaryCategory(html: string): boolean {
  const $ = cheerio.load(html);
  const candidates = [
    $("title").first().text(),
    ...$("meta[property='og:article:section'], meta[property='article:section'], meta[itemprop='articleSection']")
      .map((_, element) => $(element).attr("content") ?? "")
      .get(),
    ...$(".topic-category .category-name, .category-name[itemprop='name']")
      .map((_, element) => $(element).text())
      .get()
  ].map(normalizeWhitespace).filter(Boolean);

  if (candidates.some(hasPreliminaryCategorySegment)) return true;
  if (!/<[a-z][\s\S]*>/i.test(html)) return hasPreliminaryCategorySegment(html);
  return false;
}

function collectCategoryStrings(value: unknown, insideCategoryField = false, depth = 0): string[] {
  if (depth > 8 || value == null) return [];
  if (typeof value === "string") return insideCategoryField ? [value] : [];
  if (Array.isArray(value)) {
    return value.flatMap((item) => collectCategoryStrings(item, insideCategoryField, depth + 1));
  }
  if (typeof value !== "object") return [];

  return Object.entries(value as Record<string, unknown>).flatMap(([key, nested]) =>
    collectCategoryStrings(nested, insideCategoryField || /category/i.test(key), depth + 1)
  );
}

export function isSubmittedPreliminaryTopicPayload(payload: unknown): boolean {
  if (typeof payload === "string") return pageTitleHasPreliminaryCategory(payload);
  return collectCategoryStrings(payload).some(includesPreliminaryCategoryText);
}

function topicJsonUrl(topic: CategoryTopicRef): string {
  const parsed = new URL(topic.url);
  if (parsed.pathname.endsWith(".json")) return parsed.toString();
  parsed.pathname = parsed.pathname.endsWith("/")
    ? `${parsed.pathname.slice(0, -1)}.json`
    : `${parsed.pathname}.json`;
  parsed.search = "";
  return parsed.toString();
}

function parseCategoryJson(payload: unknown, categoryUrl: string): CategoryTopicRef[] {
  const data = payload as {
    topic_list?: {
      topics?: Array<{
        id?: number;
        slug?: string;
        title?: string;
        fancy_title?: string;
        pinned?: boolean;
        pinned_globally?: boolean;
        visible?: boolean;
        archived?: boolean;
        archetype?: string;
      }>;
    };
  };
  const origin = new URL(categoryUrl).origin;
  return (data.topic_list?.topics ?? [])
    .filter(isRankableDiscourseTopic)
    .map((topic) => ({
      externalTopicId: String(topic.id),
      slug: topic.slug ?? String(topic.id),
      title: topic.title ?? topic.fancy_title ?? `Topic ${topic.id}`,
      url: `${origin}/t/${topic.slug ?? "topic"}/${topic.id}`,
      rawJson: topic
    }));
}

function parseCategoryHtml(html: string, categoryUrl: string): CategoryTopicRef[] {
  const $ = cheerio.load(html);
  const origin = new URL(categoryUrl).origin;
  const refs = new Map<string, CategoryTopicRef>();
  $("a[href*='/t/']").each((_, element) => {
    const href = $(element).attr("href");
    if (!href) return;
    const url = new URL(href, origin);
    const match = url.pathname.match(/\/t\/([^/]+)\/(\d+)/);
    if (!match) return;
    const externalTopicId = match[2];
    refs.set(externalTopicId, {
      externalTopicId,
      slug: match[1],
      title: normalizeWhitespace($(element).text()) || `Topic ${externalTopicId}`,
      url: `${origin}/t/${match[1]}/${externalTopicId}`
    });
  });
  return Array.from(refs.values());
}

function firstPostFromJson(payload: unknown): {
  html: string | null;
  authorName: string | null;
  authorUsername: string | null;
  authorAvatarUrl: string | null;
  createdAt: string | null;
  likeCount: number | null;
} {
  const data = payload as {
    post_stream?: {
      posts?: Array<{
        cooked?: string;
        username?: string;
        name?: string;
        avatar_template?: string;
        created_at?: string;
        like_count?: number;
      }>;
    };
  };
  const first = data.post_stream?.posts?.[0];
  if (!first) {
    return { html: null, authorName: null, authorUsername: null, authorAvatarUrl: null, createdAt: null, likeCount: null };
  }
  return {
    html: first.cooked ?? null,
    authorName: first.name || first.username || null,
    // Keep the raw username distinct from the display name: the forum's author
    // search keys off username, and matching confirms identity by it.
    authorUsername: first.username ?? null,
    authorAvatarUrl: first.avatar_template ? new URL(first.avatar_template.replace("{size}", "120"), "https://forum.trae.cn").toString() : null,
    createdAt: first.created_at ?? null,
    likeCount: typeof first.like_count === "number" ? first.like_count : null
  };
}

async function topicFromJson(sourceType: TraeSourceType, ref: CategoryTopicRef, payload: unknown): Promise<TraeTopic> {
  const data = payload as {
    id?: number;
    slug?: string;
    title?: string;
    fancy_title?: string;
    tags?: string[];
    posts_count?: number;
    views?: number;
    created_at?: string;
    bumped_at?: string;
  };
  const firstPost = firstPostFromJson(payload);
  const html = firstPost.html ?? "";
  const signals = extractTopicSignals({
    title: data.title ?? ref.title,
    html,
    tags: data.tags ?? [],
    baseUrl: new URL(ref.url).origin
  });
  const externalTopicId = String(data.id ?? ref.externalTopicId);
  const now = nowIso();
  const contentHash = getContentHash(data.title ?? ref.title, signals.contentText, signals.demoUrl);

  return {
    id: `${sourceType}_${externalTopicId}`,
    sourceType,
    externalTopicId,
    slug: data.slug ?? ref.slug,
    title: data.title ?? data.fancy_title ?? ref.title,
    url: ref.url,
    authorName: firstPost.authorName ?? "未知用户",
    authorUsername: firstPost.authorUsername,
    authorAvatarUrl: firstPost.authorAvatarUrl,
    track: signals.track,
    tags: sanitizeTags(data.tags),
    replyCount: typeof data.posts_count === "number" ? Math.max(0, data.posts_count - 1) : null,
    viewCount: typeof data.views === "number" ? data.views : null,
    likeCount: firstPost.likeCount,
    createdAtExternal: data.created_at ?? firstPost.createdAt,
    lastActivityAtExternal: data.bumped_at ?? null,
    scrapedAt: now,
    updatedAt: now,
    contentText: signals.contentText,
    contentHtml: html,
    excerpt: signals.excerpt,
    demoUrl: signals.demoUrl,
    attachmentUrls: signals.attachmentUrls,
    imageUrls: signals.imageUrls,
    sessionIds: signals.sessionIds,
    traeEvidence: signals.traeEvidence,
    contentHash,
    status: sourceType === "preliminary" ? "needs_judging" : "scraped",
    rawJson: sanitizeRawJsonForDataConnect(payload),
    rawHtml: null
  };
}

async function topicFromHtml(sourceType: TraeSourceType, ref: CategoryTopicRef, html: string): Promise<TraeTopic> {
  const $ = cheerio.load(html);
  const title = normalizeWhitespace($("meta[property='og:title']").attr("content") ?? $("title").first().text() ?? ref.title);
  const firstPostHtml = $(".topic-post .cooked, article .cooked, .cooked").first().html() ?? html;
  const text = htmlToText(firstPostHtml);
  const signals = extractTopicSignals({
    title,
    html: firstPostHtml,
    text,
    baseUrl: new URL(ref.url).origin
  });
  const author =
    $("meta[name='author']").attr("content") ||
    $(".topic-meta-data .names span:first-child, .names .username, [itemprop='author']").first().text() ||
    "未知用户";
  const avatarSrc = $("img.avatar").first().attr("src");
  const now = nowIso();

  return {
    id: `${sourceType}_${ref.externalTopicId}`,
    sourceType,
    externalTopicId: ref.externalTopicId,
    slug: ref.slug,
    title,
    url: ref.url,
    authorName: normalizeWhitespace(author),
    // Best-effort username from the avatar template (uploaded avatars encode it);
    // null is fine — matching falls back to display-name confirmation.
    authorUsername:
      $("[data-user-card]").first().attr("data-user-card") || usernameFromAvatarUrl(avatarSrc) || null,
    authorAvatarUrl: normalizeUrlOrNull(avatarSrc, ref.url),
    track: signals.track,
    tags: [],
    replyCount: null,
    viewCount: null,
    likeCount: null,
    createdAtExternal: $("time").first().attr("datetime") ?? null,
    lastActivityAtExternal: $("time").last().attr("datetime") ?? null,
    scrapedAt: now,
    updatedAt: now,
    contentText: signals.contentText,
    contentHtml: firstPostHtml,
    excerpt: signals.excerpt,
    demoUrl: signals.demoUrl,
    attachmentUrls: signals.attachmentUrls,
    imageUrls: signals.imageUrls,
    sessionIds: signals.sessionIds,
    traeEvidence: signals.traeEvidence,
    contentHash: getContentHash(title, signals.contentText, signals.demoUrl),
    status: sourceType === "preliminary" ? "needs_judging" : "scraped",
    rawJson: null,
    rawHtml: html.slice(0, 100_000)
  };
}

function normalizeUrlOrNull(raw: string | undefined, base: string): string | null {
  if (!raw) return null;
  try {
    return new URL(raw, base).toString();
  } catch {
    return null;
  }
}

/**
 * Recover the Discourse username from an uploaded-avatar URL like
 * `…/user_avatar/forum.trae.cn/<username>/120/123_2.png`. Letter-avatar proxies
 * carry no username, so this returns null for them.
 */
export function usernameFromAvatarUrl(raw: string | undefined | null): string | null {
  if (!raw) return null;
  const match = raw.match(/\/user_avatar\/[^/]+\/([^/]+)\//);
  return match ? decodeURIComponent(match[1]) : null;
}

function assertSubmittedPreliminaryTopic(payload: unknown): void {
  if (!isSubmittedPreliminaryTopicPayload(payload)) {
    throw new TraeForumUrlError("只支持【大赛初赛专区】帖子。");
  }
}

export async function fetchTopic(sourceType: TraeSourceType, ref: CategoryTopicRef, options: FetchTopicOptions = {}): Promise<TraeTopic> {
  const jsonPayload = await tryFetchJson(topicJsonUrl(ref));
  if (jsonPayload) {
    if (options.requirePreliminaryCategory && !isSubmittedPreliminaryTopicPayload(jsonPayload)) {
      const html = await fetchText(ref.url, "text/html,application/xhtml+xml").then((result) => result.body);
      assertSubmittedPreliminaryTopic(html);
    }
    return topicFromJson(sourceType, ref, jsonPayload);
  }
  const html = await fetchText(ref.url, "text/html,application/xhtml+xml").then((result) => result.body);
  if (options.requirePreliminaryCategory) assertSubmittedPreliminaryTopic(html);
  return topicFromHtml(sourceType, ref, html);
}

const sourceTypeMap = {
  signup: "SIGNUP",
  preliminary: "PRELIMINARY"
} as const;

const topicStatusMap = {
  scraped: "SCRAPED",
  needs_judging: "NEEDS_JUDGING",
  judged: "JUDGED",
  scrape_error: "SCRAPE_ERROR",
  judge_error: "JUDGE_ERROR"
} as const;

export function nextScrapedTopicStatus(sourceType: TraeSourceType, existingStatus: unknown): keyof typeof topicStatusMap {
  if (sourceType !== "preliminary") return "scraped";
  return typeof existingStatus === "string" && existingStatus.toLowerCase() === "judged"
    ? "judged"
    : "needs_judging";
}

function topicToVariables(topic: TraeTopic, status: keyof typeof topicStatusMap) {
  return {
    id: topic.id,
    sourceType: sourceTypeMap[topic.sourceType],
    externalTopicId: topic.externalTopicId,
    slug: topic.slug,
    title: topic.title,
    url: topic.url,
    authorName: topic.authorName,
    authorAvatarUrl: topic.authorAvatarUrl ?? null,
    track: topic.track ?? null,
    tags: sanitizeTags(topic.tags),
    replyCount: topic.replyCount ?? null,
    viewCount: topic.viewCount ?? null,
    likeCount: topic.likeCount ?? null,
    createdAtExternal: topic.createdAtExternal ?? null,
    lastActivityAtExternal: topic.lastActivityAtExternal ?? null,
    contentText: topic.contentText,
    contentHtml: topic.contentHtml ?? null,
    excerpt: topic.excerpt,
    demoUrl: topic.demoUrl ?? null,
    attachmentUrls: topic.attachmentUrls ?? [],
    imageUrls: topic.imageUrls ?? [],
    sessionIds: topic.sessionIds ?? [],
    traeEvidence: topic.traeEvidence ?? null,
    contentHash: topic.contentHash,
    status: topicStatusMap[status],
    rawJson: topic.rawJson ?? null,
    rawHtml: topic.rawHtml ?? null
  };
}

export async function upsertTopic(topic: TraeTopic): Promise<"created" | "updated" | "unchanged"> {
  const dc = getDataConnectDb();
  const existingRes = await getTopicDetail(dc as any, { id: topic.id } as any);
  const existing = existingRes.data.topic;

  if (!existing) {
    await upsertTopicMutation(dc as any, topicToVariables(topic, topic.status) as any);
    await updateTopicEvaluationState(dc as any, {
      id: topic.id,
      status: topic.sourceType === "preliminary" ? "NEEDS_JUDGING" : "SCRAPED",
      totalScore: -1,
      innovationScore: -1,
      practicalityScore: -1,
      completionScore: -1,
      designScore: -1,
      complianceRiskScore: -1,
      directionConsistencyScore: null,
      confidenceScore: -1,
      competitionLevel: null
    } as any);
    return "created";
  }

  if (existing.contentHash === topic.contentHash) {
    return "unchanged";
  }

  const updatedStatus = nextScrapedTopicStatus(topic.sourceType, existing.status);
  await upsertTopicMutation(dc as any, topicToVariables(topic, updatedStatus) as any);
  return "updated";
}

async function readScrapeCursor(sourceType: TraeSourceType): Promise<TraeScrapeCursor> {
  const dc = getDataConnectDb();
  const res = await getScrapeCursor(dc as any, { sourceType: sourceTypeMap[sourceType] } as any);
  const cursor = res.data.scrapeCursors?.[0];
  if (cursor) {
    return {
      sourceType,
      nextPage: Math.max(0, Math.floor(cursor.nextPage ?? 0)),
      totalSeen: Math.max(0, Math.floor(cursor.totalSeen ?? 0)),
      lastRunAt: cursor.lastRunAt ?? nowIso(),
      lastCompletedCycleAt: cursor.lastCompletedCycleAt ?? null
    };
  }
  return { sourceType, nextPage: 0, totalSeen: 0, lastRunAt: nowIso(), lastCompletedCycleAt: null };
}

async function writeScrapeCursor(cursor: TraeScrapeCursor): Promise<void> {
  const dc = getDataConnectDb();
  await upsertScrapeCursor(dc as any, {
    sourceType: sourceTypeMap[cursor.sourceType],
    nextPage: cursor.nextPage,
    totalSeen: cursor.totalSeen,
    lastCompletedCycleAt: cursor.lastCompletedCycleAt ?? null
  } as any);
}

async function fetchCategoryPage(sourceType: TraeSourceType, page: number): Promise<CategoryTopicRef[]> {
  const config = getTraeConfig();
  const categoryUrl = config.categoryUrls[sourceType];
  const jsonPayload = await tryFetchJson(categoryJsonUrl(categoryUrl, page));
  if (jsonPayload) return parseCategoryJson(jsonPayload, categoryUrl);

  const url = new URL(categoryUrl);
  if (page > 0) url.searchParams.set("page", String(page + 1));
  const html = await fetchText(url.toString(), "text/html,application/xhtml+xml").then((result) => result.body);
  return parseCategoryHtml(html, categoryUrl);
}

export interface ScrapeOptions {
  /** Pages to scan this run (overrides config.maxScrapePagesPerRun). */
  maxPages?: number;
  /** Soft ceiling on topic detail fetches per run (overrides config.maxTopicDetailsPerRun). */
  maxDetails?: number;
  /** When false, ignore the saved cursor and start from page 0. Default true. */
  resume?: boolean;
}

export interface ScrapeResult {
  pagesScanned: number;
  startPage: number;
  nextPage: number;
  reachedEnd: boolean;
  topicsFound: number;
  topicsCreated: number;
  topicsUpdated: number;
  failedCount: number;
}

export async function scrapeTraeSource(sourceType: TraeSourceType, options: ScrapeOptions = {}): Promise<ScrapeResult> {
  const config = getTraeConfig();
  const maxPages = Math.max(1, Math.floor(options.maxPages ?? config.maxScrapePagesPerRun));
  const maxDetails = Math.max(1, Math.floor(options.maxDetails ?? config.maxTopicDetailsPerRun));
  const resume = options.resume ?? true;

  const run = await startRun("scrape", sourceType);
  const cursor = resume
    ? await readScrapeCursor(sourceType)
    : { sourceType, nextPage: 0, totalSeen: 0, lastRunAt: nowIso(), lastCompletedCycleAt: null };
  const startPage = cursor.nextPage;

  let pagesScanned = 0;
  let topicsFound = 0;
  let topicsCreated = 0;
  let topicsUpdated = 0;
  let failedCount = 0;
  let reachedEnd = false;
  const failureLogs: string[] = [];
  const seen = new Map<string, CategoryTopicRef>();

  try {
    for (let i = 0; i < maxPages; i += 1) {
      const page = startPage + i;
      const refs = await fetchCategoryPage(sourceType, page);
      pagesScanned += 1;
      if (!refs.length) {
        reachedEnd = true;
        break;
      }
      // Add the whole page so we never split a page across the cursor (no coverage gaps).
      for (const ref of refs) seen.set(ref.externalTopicId, ref);
      if (seen.size >= maxDetails) break;
    }

    // Process every ref we collected from the scanned pages — slicing here would skip
    // topics the cursor is about to step past.
    const refs = Array.from(seen.values());
    topicsFound = refs.length;
    for (const ref of refs) {
      try {
        const topic = await fetchTopic(sourceType, ref);
        const result = await upsertTopic(topic);
        if (result === "created") topicsCreated += 1;
        if (result === "updated") topicsUpdated += 1;
      } catch (error) {
        failedCount += 1;
        if (failureLogs.length < 5) {
          const message = error instanceof Error ? error.message : String(error);
          failureLogs.push(`Failed ${sourceType} topic ${ref.externalTopicId}: ${message}`);
        }
      }
    }

    // Advance the cursor exactly past the pages we fully processed; wrap to page 0 once
    // we hit the end so the next cycle re-checks the catalog for new/changed posts.
    const nextPage = reachedEnd ? 0 : startPage + pagesScanned;
    await writeScrapeCursor({
      sourceType,
      nextPage,
      totalSeen: cursor.totalSeen + topicsCreated,
      lastRunAt: nowIso(),
      lastCompletedCycleAt: reachedEnd ? nowIso() : cursor.lastCompletedCycleAt
    });

    await finishRun(run.id, {
      status: failedCount > 0 ? "partial" : "success",
      pagesScanned,
      topicsFound,
      topicsCreated,
      topicsUpdated,
      failedCount,
      logs: [
        `Scraped ${sourceType}: pages ${startPage}..${startPage + pagesScanned - 1} (${pagesScanned}), ${topicsFound} refs, ${topicsCreated} created, ${topicsUpdated} updated, ${failedCount} failed. nextPage=${nextPage}${reachedEnd ? " (cycle complete, wrapped)" : ""}.`,
        ...failureLogs
      ]
    });
    return { pagesScanned, startPage, nextPage, reachedEnd, topicsFound, topicsCreated, topicsUpdated, failedCount };
  } catch (error) {
    await finishRun(run.id, {
      status: "error",
      pagesScanned,
      topicsFound,
      topicsCreated,
      topicsUpdated,
      failedCount,
      error: error instanceof Error ? error.message : String(error)
    });
    throw error;
  }
}

export async function scrapeAllTraeSources(options: ScrapeOptions = {}): Promise<void> {
  await scrapeTraeSource("signup", options);
  await scrapeTraeSource("preliminary", options);
}
