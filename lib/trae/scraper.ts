import { setTimeout as sleep } from "node:timers/promises";
import * as cheerio from "cheerio";
import { getTraeConfig } from "./config.ts";
import { extractTopicSignals, getContentHash, htmlToText, normalizeWhitespace } from "./extractors.ts";
import { getFirestoreDb, nowIso, TRAE_COLLECTIONS } from "./firestore.ts";
import { finishRun, startRun } from "./runs.ts";
import type { TraeSourceType, TraeTopic } from "./types.ts";

interface CategoryTopicRef {
  externalTopicId: string;
  slug: string;
  title: string;
  url: string;
  rawJson?: unknown;
}

interface FetchResult {
  url: string;
  body: string;
  contentType: string;
}

const lastRequestByHost = new Map<string, number>();

async function waitForHost(url: string): Promise<void> {
  const host = new URL(url).host;
  const last = lastRequestByHost.get(host) ?? 0;
  const elapsed = Date.now() - last;
  if (elapsed < 800) await sleep(800 - elapsed);
  lastRequestByHost.set(host, Date.now());
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
      if ([403, 429, 500, 502, 503, 504].includes(response.status) && attempt < 4) {
        await sleep(Math.min(30_000, 1000 * 2 ** attempt));
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

async function tryFetchJson(url: string): Promise<unknown | null> {
  try {
    const result = await fetchText(url, "application/json,text/json;q=0.9,*/*;q=0.1");
    return JSON.parse(result.body) as unknown;
  } catch {
    return null;
  }
}

function categoryJsonUrl(sourceUrl: string, page: number): string {
  const jsonUrl = sourceUrl.endsWith("/") ? `${sourceUrl.slice(0, -1)}.json` : `${sourceUrl}.json`;
  if (page <= 0) return jsonUrl;
  const url = new URL(jsonUrl);
  url.searchParams.set("page", String(page));
  return url.toString();
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
      }>;
    };
  };
  const origin = new URL(categoryUrl).origin;
  return (data.topic_list?.topics ?? [])
    .filter((topic) => topic.id)
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
    return { html: null, authorName: null, authorAvatarUrl: null, createdAt: null, likeCount: null };
  }
  return {
    html: first.cooked ?? null,
    authorName: first.name || first.username || null,
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
    authorAvatarUrl: firstPost.authorAvatarUrl,
    track: signals.track,
    tags: data.tags ?? [],
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
    rawJson: payload,
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
  const now = nowIso();

  return {
    id: `${sourceType}_${ref.externalTopicId}`,
    sourceType,
    externalTopicId: ref.externalTopicId,
    slug: ref.slug,
    title,
    url: ref.url,
    authorName: normalizeWhitespace(author),
    authorAvatarUrl: normalizeUrlOrNull($("img.avatar").first().attr("src"), ref.url),
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

async function fetchTopic(sourceType: TraeSourceType, ref: CategoryTopicRef): Promise<TraeTopic> {
  const jsonPayload = await tryFetchJson(topicJsonUrl(ref));
  if (jsonPayload) return topicFromJson(sourceType, ref, jsonPayload);
  const html = await fetchText(ref.url, "text/html,application/xhtml+xml").then((result) => result.body);
  return topicFromHtml(sourceType, ref, html);
}

async function upsertTopic(topic: TraeTopic): Promise<"created" | "updated" | "unchanged"> {
  const db = getFirestoreDb();
  const ref = db.collection(TRAE_COLLECTIONS.topics).doc(topic.id);
  const existingSnapshot = await ref.get();
  if (!existingSnapshot.exists) {
    await ref.set(topic);
    return "created";
  }

  const existing = existingSnapshot.data() as TraeTopic;
  if (existing.contentHash === topic.contentHash) {
    await ref.set(
      {
        scrapedAt: topic.scrapedAt,
        lastActivityAtExternal: topic.lastActivityAtExternal,
        replyCount: topic.replyCount,
        viewCount: topic.viewCount,
        likeCount: topic.likeCount,
        updatedAt: nowIso()
      },
      { merge: true }
    );
    return "unchanged";
  }

  await ref.set(
    {
      ...topic,
      status: topic.sourceType === "preliminary" ? "needs_judging" : "scraped",
      updatedAt: nowIso()
    },
    { merge: true }
  );
  return "updated";
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

export async function scrapeTraeSource(sourceType: TraeSourceType): Promise<{
  pagesScanned: number;
  topicsFound: number;
  topicsCreated: number;
  topicsUpdated: number;
  failedCount: number;
}> {
  const config = getTraeConfig();
  const run = await startRun("scrape", sourceType);
  let pagesScanned = 0;
  let topicsFound = 0;
  let topicsCreated = 0;
  let topicsUpdated = 0;
  let failedCount = 0;
  const seen = new Map<string, CategoryTopicRef>();

  try {
    for (let page = 0; page < config.maxScrapePagesPerRun; page += 1) {
      const refs = await fetchCategoryPage(sourceType, page);
      pagesScanned += 1;
      if (!refs.length) break;
      for (const ref of refs) seen.set(ref.externalTopicId, ref);
    }

    const refs = Array.from(seen.values()).slice(0, config.maxTopicDetailsPerRun);
    topicsFound = refs.length;
    for (const ref of refs) {
      try {
        const topic = await fetchTopic(sourceType, ref);
        const result = await upsertTopic(topic);
        if (result === "created") topicsCreated += 1;
        if (result === "updated") topicsUpdated += 1;
      } catch {
        failedCount += 1;
      }
    }

    await finishRun(run.id, {
      status: failedCount > 0 ? "partial" : "success",
      pagesScanned,
      topicsFound,
      topicsCreated,
      topicsUpdated,
      failedCount,
      logs: [
        `Scraped ${sourceType}: ${pagesScanned} pages, ${topicsFound} topic refs, ${topicsCreated} created, ${topicsUpdated} updated, ${failedCount} failed.`
      ]
    });
    return { pagesScanned, topicsFound, topicsCreated, topicsUpdated, failedCount };
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

export async function scrapeAllTraeSources(): Promise<void> {
  await scrapeTraeSource("signup");
  await scrapeTraeSource("preliminary");
}
