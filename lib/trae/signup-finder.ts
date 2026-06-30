import { getTraeConfig } from "./config.ts";
import { tryFetchJson, usernameFromAvatarUrl, type CategoryTopicRef } from "./scraper.ts";
import type { TraeTopic } from "./types.ts";

// The matcher can't pre-scrape ~20K signup posts and fuzzy-match titles — a 报名帖
// and the 初赛 Demo post legitimately have different titles. The reliable join key
// is the *person*. Discourse indexes posts by author, so we ask the forum directly
// for one user's signup post instead of hunting the whole haystack. Everything here
// is read-only HTTP against the public forum; nothing new is persisted.

// ─── Pure parse helpers (unit-tested) ────────────────────────────────────────

/** The last numeric path segment of a Discourse category URL is its id. */
export function categoryIdFromUrl(categoryUrl: string): string | null {
  let segments: string[];
  try {
    segments = new URL(categoryUrl).pathname.split("/").filter(Boolean);
  } catch {
    return null;
  }
  for (let i = segments.length - 1; i >= 0; i -= 1) {
    if (/^\d+$/.test(segments[i])) return segments[i];
  }
  return null;
}

/** Case/space-insensitive username key for identity comparison. */
export function normalizeUsername(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

interface DiscourseSearchPost {
  topic_id?: number;
  post_number?: number;
  username?: string;
  name?: string;
}

interface DiscourseTopicRef {
  id?: number;
  slug?: string;
  title?: string;
  fancy_title?: string;
  category_id?: number;
}

function toRef(topic: DiscourseTopicRef, origin: string, fallbackId: number): CategoryTopicRef {
  const id = String(topic.id ?? fallbackId);
  const slug = topic.slug ?? "topic";
  return {
    externalTopicId: id,
    slug,
    title: topic.title ?? topic.fancy_title ?? `Topic ${id}`,
    url: `${origin}/t/${slug}/${id}`
  };
}

/**
 * Parse a Discourse `/search.json` payload into signup topic refs authored by
 * `username` (case-insensitive) and scoped to `categoryId`. Restricts to first
 * posts so we return the OP's 报名帖, never a reply they left on someone else's.
 */
export function parseSearchSignupRefs(
  payload: unknown,
  categoryId: number | null,
  origin: string,
  username: string
): CategoryTopicRef[] {
  const data = payload as { posts?: DiscourseSearchPost[]; topics?: DiscourseTopicRef[] };
  const target = normalizeUsername(username);
  const topicsById = new Map<number, DiscourseTopicRef>();
  for (const topic of data.topics ?? []) {
    if (typeof topic.id === "number") topicsById.set(topic.id, topic);
  }
  const refs = new Map<string, CategoryTopicRef>();
  for (const post of data.posts ?? []) {
    if (normalizeUsername(post.username) !== target) continue;
    if (typeof post.post_number === "number" && post.post_number !== 1) continue;
    if (typeof post.topic_id !== "number") continue;
    const topic = topicsById.get(post.topic_id);
    if (!topic) continue;
    if (categoryId != null && typeof topic.category_id === "number" && topic.category_id !== categoryId) continue;
    const ref = toRef(topic, origin, post.topic_id);
    refs.set(ref.externalTopicId, ref);
  }
  return Array.from(refs.values());
}

/** Parse `/u/<username>/activity/topics.json` (fallback) into signup refs. */
export function parseUserTopicsSignupRefs(
  payload: unknown,
  categoryId: number | null,
  origin: string
): CategoryTopicRef[] {
  const data = payload as { topic_list?: { topics?: DiscourseTopicRef[] } };
  const refs = new Map<string, CategoryTopicRef>();
  for (const topic of data.topic_list?.topics ?? []) {
    if (typeof topic.id !== "number") continue;
    if (categoryId != null && typeof topic.category_id === "number" && topic.category_id !== categoryId) continue;
    const ref = toRef(topic, origin, topic.id);
    refs.set(ref.externalTopicId, ref);
  }
  return Array.from(refs.values());
}

function firstPostUsername(payload: unknown): string | null {
  const data = payload as { post_stream?: { posts?: Array<{ username?: string }> } };
  return data?.post_stream?.posts?.[0]?.username ?? null;
}

function toTopicJsonUrl(rawUrl: string): string {
  const parsed = new URL(rawUrl);
  if (parsed.pathname.endsWith(".json")) return parsed.toString();
  parsed.pathname = parsed.pathname.endsWith("/")
    ? `${parsed.pathname.slice(0, -1)}.json`
    : `${parsed.pathname}.json`;
  parsed.search = "";
  return parsed.toString();
}

// ─── Network wrappers ────────────────────────────────────────────────────────

function signupSearchContext(): { origin: string; categoryId: string | null } {
  const categoryUrl = getTraeConfig().categoryUrls.signup;
  return { origin: new URL(categoryUrl).origin, categoryId: categoryIdFromUrl(categoryUrl) };
}

/**
 * Find a contestant's signup topic(s) by Discourse username, scoped to the signup
 * category. Tries the author-scoped search first, then the user's created-topics
 * feed as a fallback. Returns [] on any failure — the caller keeps its in-DB
 * fuzzy fallback, so a forum hiccup degrades gracefully instead of erroring.
 */
export async function findSignupRefsByUsername(username: string): Promise<CategoryTopicRef[]> {
  const clean = username.trim();
  if (!clean) return [];
  const { origin, categoryId } = signupSearchContext();
  const numericCategoryId = categoryId ? Number(categoryId) : null;

  const searchUrl = new URL("/search.json", origin);
  const filter = categoryId ? ` category:${categoryId}` : "";
  searchUrl.searchParams.set("q", `@${clean}${filter} in:first`);
  const searchPayload = await tryFetchJson(searchUrl.toString());
  const fromSearch = searchPayload
    ? parseSearchSignupRefs(searchPayload, numericCategoryId, origin, clean)
    : [];
  if (fromSearch.length) return fromSearch;

  const activityUrl = new URL(`/u/${encodeURIComponent(clean)}/activity/topics.json`, origin);
  const activityPayload = await tryFetchJson(activityUrl.toString());
  return activityPayload ? parseUserTopicsSignupRefs(activityPayload, numericCategoryId, origin) : [];
}

/**
 * Resolve the Discourse username for a preliminary topic. Prefers the in-memory
 * username (fresh scrapes), then the avatar URL (zero network), then the topic's
 * own JSON as a last resort. Returns null when it can't be determined.
 */
export async function resolveAuthorUsername(
  topic: Pick<TraeTopic, "authorUsername" | "authorAvatarUrl" | "url">
): Promise<string | null> {
  if (topic.authorUsername) return topic.authorUsername;
  const fromAvatar = usernameFromAvatarUrl(topic.authorAvatarUrl);
  if (fromAvatar) return fromAvatar;
  try {
    return firstPostUsername(await tryFetchJson(toTopicJsonUrl(topic.url)));
  } catch {
    return null;
  }
}
