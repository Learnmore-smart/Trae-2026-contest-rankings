import { createHash } from "node:crypto";
import * as cheerio from "cheerio";
import type { TraeEvidence } from "./types.ts";

const TRACKS = [
  "生活娱乐",
  "学习工作",
  "社会服务",
  "硬件交互",
  "社会公益"
];

const IMAGE_EXTENSIONS = [".png", ".jpg", ".jpeg", ".gif", ".webp", ".avif", ".svg"];
const ATTACHMENT_EXTENSIONS = [".zip", ".rar", ".7z", ".pdf", ".doc", ".docx", ".ppt", ".pptx", ".xls", ".xlsx"];

export interface TopicSignalInput {
  title: string;
  html?: string | null;
  text?: string | null;
  tags?: string[];
  baseUrl?: string;
}

export interface TopicSignals {
  contentText: string;
  excerpt: string;
  demoUrl: string | null;
  attachmentUrls: string[];
  imageUrls: string[];
  sessionIds: string[];
  traeEvidence: TraeEvidence;
  track: string | null;
  links: string[];
}

export function getContentHash(...parts: Array<string | null | undefined>): string {
  return createHash("sha256")
    .update(parts.filter(Boolean).join("\n\n"))
    .digest("hex");
}

export function htmlToText(html: string): string {
  const $ = cheerio.load(html);
  $("script, style, noscript").remove();
  return normalizeWhitespace($.root().text());
}

export function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function normalizeUrl(raw: string | undefined, baseUrl: string): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed || /^(mailto|tel|javascript):/i.test(trimmed)) return null;
  try {
    return new URL(trimmed, baseUrl).toString();
  } catch {
    return null;
  }
}

function unique(values: Array<string | null>): string[] {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value))));
}

function isImageUrl(url: string): boolean {
  const pathname = new URL(url).pathname.toLowerCase();
  return IMAGE_EXTENSIONS.some((extension) => pathname.endsWith(extension));
}

function isAttachmentUrl(url: string): boolean {
  const pathname = new URL(url).pathname.toLowerCase();
  return ATTACHMENT_EXTENSIONS.some((extension) => pathname.endsWith(extension)) || pathname.includes("/uploads/");
}

function selectDemoUrl(links: Array<{ url: string; label: string }>, forumHost: string): string | null {
  const demoKeywords = ["demo", "体验", "演示", "在线", "预览", "访问", "试用", "vercel", "netlify"];
  const preferredHosts = ["vercel.app", "netlify.app", "github.io", "pages.dev", "huggingface.co", "replicate.com"];
  const candidates = links.filter(({ url }) => {
    const parsed = new URL(url);
    return parsed.host !== forumHost && !isImageUrl(url) && !isAttachmentUrl(url);
  });

  const keywordMatch = candidates.find(({ url, label }) => {
    const haystack = `${url} ${label}`.toLowerCase();
    return demoKeywords.some((keyword) => haystack.includes(keyword.toLowerCase()));
  });
  if (keywordMatch) return keywordMatch.url;

  const hostMatch = candidates.find(({ url }) => preferredHosts.some((host) => new URL(url).host.endsWith(host)));
  return hostMatch?.url ?? candidates[0]?.url ?? null;
}

function extractSessionIds(text: string): string[] {
  const ids = new Set<string>();

  // 1. Lenient labeled matching:
  // Match session/会话/uuid/id/编号, followed by optional numbers/letters/symbols, then a string of 8+ alphanumeric/dash/underscore characters
  const labeled = /(?:session|会话|uuid|id|编号)\s*[a-zA-Z0-9一二三四五六七八九十]*\s*[:：=\-#\-]*\s*([A-Za-z0-9][A-Za-z0-9_\-]{7,})/gi;
  for (const match of text.matchAll(labeled)) {
    const val = match[1].trim();
    // Exclude common false positives like HTML tags, vercel, etc.
    if (!/^(http|https|github|vercel|netlify|preview|detail|image|picture|avatar|active)/i.test(val)) {
      ids.add(val);
    }
  }

  // 2. Direct session patterns (e.g. trae-session-xxx, session-xxx, trae_session_xxx, session_xxx)
  const direct = /\b(?:trae[-_]?)?session[-_]?[A-Za-z0-9_-]{8,}\b/gi;
  for (const match of text.matchAll(direct)) {
    ids.add(match[0]);
  }

  // 3. Standard UUIDs
  const uuidRegex = /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi;
  for (const match of text.matchAll(uuidRegex)) {
    ids.add(match[0]);
  }

  return Array.from(ids);
}

function detectTrack(title: string, text: string, tags: string[] = []): string | null {
  // 1. Prioritize explicit bracket prefixes in the title first
  const prefixMatch = title.match(/[【\[]([^】\]\s]+)(?:赛道)?[】\]]/);
  if (prefixMatch?.[1]) {
    const rawPrefix = prefixMatch[1].trim();
    if (rawPrefix.includes("生活娱乐") || rawPrefix.includes("娱乐")) return "生活娱乐";
    if (rawPrefix.includes("学习工作") || rawPrefix.includes("学习") || rawPrefix.includes("工作")) return "学习工作";
    if (rawPrefix.includes("社会服务") || rawPrefix.includes("生活服务")) return "社会服务";
    if (rawPrefix.includes("硬件交互") || rawPrefix.includes("硬件")) return "硬件交互";
    if (rawPrefix.includes("社会公益") || rawPrefix.includes("公益")) return "社会公益";
  }

  // 2. Search title for track names
  if (title.includes("生活娱乐") || title.includes("生活娱乐赛道")) return "生活娱乐";
  if (title.includes("学习工作") || title.includes("学习工作赛道")) return "学习工作";
  if (title.includes("社会服务") || title.includes("社会服务赛道")) return "社会服务";
  if (title.includes("硬件交互") || title.includes("硬件交互赛道")) return "硬件交互";
  if (title.includes("社会公益") || title.includes("社会公益赛道") || title.includes("公益")) return "社会公益";

  // 3. Fallback to tags
  for (const tag of tags) {
    if (tag.includes("生活娱乐") || tag.includes("娱乐")) return "生活娱乐";
    if (tag.includes("学习工作") || tag.includes("学习") || tag.includes("工作")) return "学习工作";
    if (tag.includes("社会服务") || tag.includes("服务")) return "社会服务";
    if (tag.includes("硬件交互") || tag.includes("硬件")) return "硬件交互";
    if (tag.includes("社会公益") || tag.includes("公益")) return "社会公益";
  }

  // 4. Fallback to keyword matching in text body (least priority)
  const haystack = `${title} ${text} ${tags.join(" ")}`;
  const exactMatch = TRACKS.find((track) => haystack.includes(track));
  if (exactMatch) return exactMatch;

  if (haystack.includes("生活服务")) return "社会服务";
  if (haystack.includes("教育学习")) return "学习工作";
  if (haystack.includes("创意娱乐")) return "生活娱乐";
  if (haystack.includes("硬件")) return "硬件交互";

  return null;
}

function extractProcessKeywords(text: string): string[] {
  const keywords = ["TRAE", "Trae", "实践过程", "开发过程", "Session", "截图", "提示词", "生成", "调试", "迭代"];
  return keywords.filter((keyword) => text.includes(keyword));
}

export function extractTopicSignals(input: TopicSignalInput): TopicSignals {
  const baseUrl = input.baseUrl ?? "https://forum.trae.cn";
  const baseHost = new URL(baseUrl).host;
  const html = input.html ?? "";
  const $ = cheerio.load(html);
  const contentText = normalizeWhitespace(input.text ?? (html ? htmlToText(html) : ""));
  // Discourse may return non-string tag entries despite the type signature.
  const tags = (input.tags ?? []).filter((t): t is string => typeof t === "string");
  const links = unique(
    $("a")
      .toArray()
      .map((element) => normalizeUrl($(element).attr("href"), baseUrl))
  );
  const linkLabels = $("a")
    .toArray()
    .map((element) => ({
      url: normalizeUrl($(element).attr("href"), baseUrl),
      label: normalizeWhitespace($(element).text())
    }))
    .filter((item): item is { url: string; label: string } => Boolean(item.url));
  const imageUrls = unique(
    $("img")
      .toArray()
      .map((element) => normalizeUrl($(element).attr("src") ?? $(element).attr("data-src"), baseUrl))
  );
  const attachmentUrls = links.filter((url) => !isImageUrl(url) && isAttachmentUrl(url));
  const demoUrl = selectDemoUrl(linkLabels, baseHost);
  const sessionIds = extractSessionIds(`${contentText} ${html}`);
  const processKeywords = extractProcessKeywords(contentText);

  const traeEvidence: TraeEvidence = {
    hasDemoUrl: Boolean(demoUrl),
    hasTraeProcess: /trae/i.test(contentText) && processKeywords.length > 0,
    screenshotCount: imageUrls.length,
    sessionIdCount: sessionIds.length,
    hasThreeScreenshots: imageUrls.length >= 3,
    hasThreeSessionIds: sessionIds.length >= 3,
    processKeywords
  };

  return {
    contentText,
    excerpt: contentText.slice(0, 240),
    demoUrl,
    attachmentUrls,
    imageUrls,
    sessionIds,
    traeEvidence,
    track: detectTrack(input.title, contentText, tags),
    links
  };
}
