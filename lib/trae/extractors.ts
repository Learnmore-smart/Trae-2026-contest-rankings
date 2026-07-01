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
const ATTACHMENT_EXTENSIONS = [
  ".zip", ".rar", ".7z", ".tar", ".gz", ".tgz",
  ".apk", ".ipa", ".exe", ".dmg", ".msi", ".pkg", ".deb", ".rpm",
  ".pdf", ".doc", ".docx", ".ppt", ".pptx", ".xls", ".xlsx"
];
const DEMO_DOWNLOAD_EXTENSIONS = [".zip", ".rar", ".7z", ".tar", ".gz", ".tgz", ".apk", ".ipa", ".exe", ".dmg", ".msi", ".pkg", ".deb", ".rpm"];

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
  demoUrls: string[];
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
  if (!trimmed || /^(mailto|tel|javascript|data):/i.test(trimmed)) return null;
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

function isPlaceholderImageUrl(url: string): boolean {
  const pathname = new URL(url).pathname.toLowerCase();
  return pathname.includes("/images/transparent") || pathname.includes("/assets/transparent");
}

function isDownloadDemoUrl(url: string): boolean {
  const pathname = new URL(url).pathname.toLowerCase();
  return DEMO_DOWNLOAD_EXTENSIONS.some((extension) => pathname.endsWith(extension));
}

function parseSrcsetUrls(srcset: string | undefined): string[] {
  if (!srcset) return [];
  return srcset
    .split(",")
    .map((candidate) => candidate.trim().split(/\s+/)[0])
    .filter(Boolean);
}

function hasVisualDemoCue(title: string, text: string, tags: string[]): boolean {
  const haystack = `${title} ${text} ${tags.join(" ")}`;
  return /二维码|扫码|小程序|微信|体验码|QR\s*code|qrcode|wechat|mini\s*program|miniprogram|scan\s*(qr|code)/i.test(haystack);
}

function selectDemoUrls(links: Array<{ url: string; label: string }>, forumHost: string): string[] {
  const demoKeywords = ["demo", "体验", "演示", "在线", "预览", "访问", "试用", "vercel", "netlify"];
  const preferredHosts = ["vercel.app", "netlify.app", "github.io", "pages.dev", "huggingface.co", "replicate.com"];
  const candidates = links.filter(({ url }) => {
    const parsed = new URL(url);
    return parsed.host !== forumHost && !isImageUrl(url) && !isAttachmentUrl(url);
  });

  const ranked = candidates
    .map((candidate, index) => {
      const { url, label } = candidate;
      const parsed = new URL(url);
      const haystack = `${url} ${label}`.toLowerCase();
      const keywordScore = demoKeywords.some((keyword) => haystack.includes(keyword.toLowerCase())) ? 3 : 0;
      const hostScore = preferredHosts.some((host) => parsed.host.endsWith(host)) ? 2 : 0;
      return { url, index, score: Math.max(keywordScore, hostScore) };
    })
    .filter((candidate) => candidate.score > 0)
    .sort((a, b) => b.score - a.score || a.index - b.index);

  const demoUrls = unique(ranked.map((candidate) => candidate.url));
  if (demoUrls.length > 0) return demoUrls;
  return candidates[0]?.url ? [candidates[0].url] : [];
}

function isExcludedSessionCandidate(value: string): boolean {
  return /^(http|https|github|vercel|netlify|preview|detail|image|picture|avatar|active)/i.test(value);
}

function extractSessionIds(text: string): string[] {
  const ids = new Set<string>();

  // Trae CN exports long conversation IDs as dotted/colon-prefixed strings that
  // are not UUIDs and do not contain the word "session".
  const traeConversation = /(?<![A-Za-z0-9_])((?:\.\d{10,}:)?[A-Za-z0-9_-]{16,}_[A-Za-z0-9_-]{12,}(?:\.[A-Za-z0-9_-]{12,}){2})(?=:Trae\b|[\s\]\|]|$)/g;
  for (const match of text.matchAll(traeConversation)) {
    ids.add(match[1]);
  }

  // 1. Lenient labeled matching:
  // Match session/会话/uuid/id/编号, followed by optional numbers/letters/symbols, then a string of 8+ alphanumeric/dash/underscore characters
  const labeled = /(?:session|会话|uuid|id|编号)\s*[a-zA-Z0-9一二三四五六七八九十]*\s*[:：=\-#\-]*\s*([A-Za-z0-9][A-Za-z0-9_\-]{7,})/gi;
  for (const match of text.matchAll(labeled)) {
    const val = match[1].trim();
    // Exclude common false positives like HTML tags, vercel, etc.
    if (!isExcludedSessionCandidate(val)) {
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
  const imageAttributeUrls = $("img")
    .toArray()
    .flatMap((element) => {
      const image = $(element);
      return [
        image.attr("src"),
        image.attr("data-src"),
        image.attr("data-original-src"),
        image.attr("data-orig-src"),
        image.attr("data-large-url"),
        image.attr("data-canonical-src"),
        ...parseSrcsetUrls(image.attr("srcset"))
      ];
    })
    .map((url) => normalizeUrl(url, baseUrl));
  const linkedImageUrls = links.filter(isImageUrl);
  const imageUrls = unique([...imageAttributeUrls, ...linkedImageUrls]).filter((url) => !isPlaceholderImageUrl(url));
  const attachmentUrls = links.filter((url) => !isImageUrl(url) && isAttachmentUrl(url));
  const demoUrls = selectDemoUrls(linkLabels, baseHost);
  const demoUrl = demoUrls[0] ?? null;
  const downloadDemoUrls = attachmentUrls.filter(isDownloadDemoUrl);
  const visualDemoImageUrls = hasVisualDemoCue(input.title, contentText, tags) ? imageUrls : [];
  const demoEvidenceTypes = [
    ...(demoUrls.length > 0 ? ["web_url"] : []),
    ...(downloadDemoUrls.length > 0 ? ["download"] : []),
    ...(visualDemoImageUrls.length > 0 ? ["qr_or_image"] : [])
  ];
  const sessionIds = extractSessionIds(`${contentText} ${html}`);
  const processKeywords = extractProcessKeywords(contentText);

  const traeEvidence: TraeEvidence = {
    hasDemoUrl: demoUrls.length > 0,
    demoUrlCount: demoUrls.length,
    detectedDemoUrls: demoUrls,
    hasDemoEvidence: demoEvidenceTypes.length > 0,
    demoEvidenceTypes,
    downloadDemoUrls,
    visualDemoImageUrls,
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
    demoUrls,
    attachmentUrls,
    imageUrls,
    sessionIds,
    traeEvidence,
    track: detectTrack(input.title, contentText, tags),
    links
  };
}
