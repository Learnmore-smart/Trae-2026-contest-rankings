import { createHash } from "node:crypto";
import * as cheerio from "cheerio";
import type { TraeEvidence } from "./types.ts";

const TRACKS = [
  "效率工具",
  "创意娱乐",
  "教育学习",
  "生活服务",
  "开发者工具",
  "硬件交互",
  "AI 应用",
  "游戏",
  "公益",
  "商业"
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
  const labeled = /(?:session\s*id|sessionid|会话\s*(?:id|编号)|session\s*编号)\s*[:：#-]?\s*([A-Za-z0-9][A-Za-z0-9_-]{8,})/gi;
  for (const match of text.matchAll(labeled)) {
    ids.add(match[1]);
  }

  const direct = /\b(?:trae[-_])?session[-_][A-Za-z0-9_-]{8,}\b/gi;
  for (const match of text.matchAll(direct)) {
    ids.add(match[0]);
  }

  return Array.from(ids);
}

function detectTrack(title: string, text: string, tags: string[] = []): string | null {
  const haystack = `${title} ${text} ${tags.join(" ")}`;
  return TRACKS.find((track) => haystack.includes(track)) ?? null;
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
    track: detectTrack(input.title, contentText, input.tags),
    links
  };
}
