import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { inflateRawSync } from "node:zlib";
import { getTraeConfig, type TraeConfig } from "./config.ts";
import { callVisionLLMWithFallback, type LLMContentPart } from "./llm.ts";
import type { TraeTopic } from "./types.ts";
import type { DemoArtifactType, DemoAuditStatus, DemoEvidenceSource, VisualEvidence } from "./vision.ts";

const MAX_PACKAGE_BYTES = 30 * 1024 * 1024;
const MAX_ENTRY_BYTES = 8 * 1024 * 1024;
const MAX_TOTAL_EXTRACTED_BYTES = 50 * 1024 * 1024;
const MAX_EXTRACTED_FILES = 300;

const PRIMARY_CONTROL_SELECTORS = [
  'button:has-text("开始")',
  'button:has-text("体验")',
  'button:has-text("Start")',
  'button:has-text("Try")',
  'a:has-text("开始")',
  'a:has-text("体验")',
  'a:has-text("Start")',
  'a:has-text("Try")',
  "button",
  "[role='button']",
  "input[type='submit']",
  "a[href]"
];

interface LocatorLike {
  first?: () => LocatorLike;
  count?: () => Promise<number>;
  isVisible?: () => Promise<boolean>;
  click?: (options?: { timeout?: number }) => Promise<void>;
}

interface PageLike {
  goto: (url: string, options?: Record<string, unknown>) => Promise<unknown>;
  waitForLoadState?: (state: string, options?: Record<string, unknown>) => Promise<unknown>;
  locator: (selector: string) => LocatorLike;
  screenshot: (options?: Record<string, unknown>) => Promise<Uint8Array>;
}

interface BrowserLike {
  newPage: (options?: Record<string, unknown>) => Promise<PageLike>;
  close: () => Promise<unknown>;
}

interface PlaywrightLike {
  chromium?: {
    launch: (options?: Record<string, unknown>) => Promise<BrowserLike>;
  };
}

export interface DemoAuditOptions {
  config?: TraeConfig;
  fetchFn?: typeof fetch;
  sleepFn?: (delayMs: number) => Promise<void>;
  importPlaywright?: () => Promise<PlaywrightLike | null>;
  maxPackageBytes?: number;
}

interface ZipEntry {
  name: string;
  data: Buffer;
}

async function importPlaywrightDefault(): Promise<PlaywrightLike | null> {
  const dynamicImport = new Function("specifier", "return import(specifier)") as (specifier: string) => Promise<PlaywrightLike>;
  try {
    return await dynamicImport("playwright");
  } catch {
    try {
      return await dynamicImport("playwright-core");
    } catch {
      return null;
    }
  }
}

function isHttpUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function isObviouslyUnsafeBrowserUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return (
      host === "localhost" ||
      host === "0.0.0.0" ||
      host === "::1" ||
      host.startsWith("127.") ||
      host.startsWith("10.") ||
      host.startsWith("192.168.") ||
      host.startsWith("169.254.") ||
      /^172\.(1[6-9]|2\d|3[0-1])\./.test(host) ||
      host.endsWith(".local")
    );
  } catch {
    return true;
  }
}

function getDownloadPackageUrls(topic: TraeTopic): string[] {
  const storedUrls = Array.isArray(topic.traeEvidence?.downloadDemoUrls)
    ? topic.traeEvidence.downloadDemoUrls.filter((url): url is string => typeof url === "string")
    : [];
  const urls = [...storedUrls, ...topic.attachmentUrls];
  return Array.from(new Set(urls)).filter((url) => {
    try {
      return new URL(url).pathname.toLowerCase().endsWith(".zip");
    } catch {
      return false;
    }
  });
}

async function clickLikelyPrimaryControl(page: PageLike): Promise<void> {
  for (const selector of PRIMARY_CONTROL_SELECTORS) {
    try {
      const locator = page.locator(selector).first?.() ?? page.locator(selector);
      const count = await locator.count?.();
      if (typeof count === "number" && count < 1) continue;
      const visible = await locator.isVisible?.();
      if (visible === false) continue;
      await locator.click?.({ timeout: 3000 });
      return;
    } catch {
      // Try the next likely control.
    }
  }
}

async function captureBrowserScreenshot(targetUrl: string, options: DemoAuditOptions): Promise<Buffer | null> {
  const playwright = await (options.importPlaywright ?? importPlaywrightDefault)();
  if (!playwright?.chromium) return null;

  const browser = await playwright.chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"]
  });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await page.goto(targetUrl, { waitUntil: "domcontentloaded", timeout: 20_000 });
    await page.waitForLoadState?.("networkidle", { timeout: 5000 }).catch(() => undefined);
    await clickLikelyPrimaryControl(page);
    await page.waitForLoadState?.("networkidle", { timeout: 5000 }).catch(() => undefined);
    return Buffer.from(await page.screenshot({ type: "png", fullPage: false }));
  } finally {
    await browser.close();
  }
}

async function describeAuditedScreenshot(
  screenshot: Buffer,
  topic: TraeTopic,
  options: DemoAuditOptions,
  source: DemoEvidenceSource,
  auditStatus: DemoAuditStatus,
  artifactType: DemoArtifactType,
  context: string
): Promise<VisualEvidence | null> {
  const config = options.config ?? getTraeConfig();
  const content: LLMContentPart[] = [
    {
      type: "text",
      text:
        `${context}\n` +
        "Objectively describe what is actually visible after the audit. State whether this shows an interactive product surface, a static/marketing page, a broken/blank/error page, or only a setup entry point. " +
        "Mention whether the screenshot is enough to verify core functionality. Use Chinese, 2-4 sentences, and do not invent unseen behavior."
    },
    { type: "image_url", image_url: { url: `data:image/png;base64,${screenshot.toString("base64")}` } }
  ];

  try {
    const result = await callVisionLLMWithFallback({
      config,
      messages: [{ role: "user", content }],
      fetchFn: options.fetchFn,
      sleepFn: options.sleepFn
    });
    return {
      summary: result.content.trim(),
      provider: result.provider,
      model: result.model,
      source,
      auditStatus,
      artifactType
    };
  } catch {
    return null;
  }
}

function safeZipEntryName(name: string): string | null {
  const normalized = name.replace(/\\/g, "/").replace(/^\/+/, "");
  if (!normalized || normalized.endsWith("/")) return null;
  if (normalized.includes("\0")) return null;
  if (/^[A-Za-z]:/.test(normalized)) return null;
  if (normalized.split("/").some((segment) => segment === "..")) return null;
  return normalized;
}

function parseZipEntries(buffer: Buffer): ZipEntry[] {
  const entries: ZipEntry[] = [];
  let offset = 0;
  while (offset + 30 <= buffer.length && buffer.readUInt32LE(offset) === 0x04034b50) {
    const method = buffer.readUInt16LE(offset + 8);
    const compressedSize = buffer.readUInt32LE(offset + 18);
    const uncompressedSize = buffer.readUInt32LE(offset + 22);
    const nameLength = buffer.readUInt16LE(offset + 26);
    const extraLength = buffer.readUInt16LE(offset + 28);
    const nameStart = offset + 30;
    const dataStart = nameStart + nameLength + extraLength;
    const dataEnd = dataStart + compressedSize;
    if (dataEnd > buffer.length) break;

    const rawName = buffer.toString("utf8", nameStart, nameStart + nameLength);
    const name = safeZipEntryName(rawName);
    if (name && uncompressedSize <= MAX_ENTRY_BYTES) {
      const compressed = buffer.subarray(dataStart, dataEnd);
      if (method === 0) entries.push({ name, data: Buffer.from(compressed) });
      else if (method === 8) entries.push({ name, data: Buffer.from(inflateRawSync(compressed)) });
    }

    offset = dataEnd;
  }
  return entries;
}

function findHtmlEntry(entries: ZipEntry[]): ZipEntry | null {
  const htmlEntries = entries.filter((entry) => entry.name.toLowerCase().endsWith(".html"));
  htmlEntries.sort((a, b) => {
    const aIndex = /(^|\/)index\.html$/i.test(a.name) ? 0 : 1;
    const bIndex = /(^|\/)index\.html$/i.test(b.name) ? 0 : 1;
    return aIndex - bIndex || a.name.length - b.name.length;
  });
  return htmlEntries[0] ?? null;
}

async function extractZipToTemp(entries: ZipEntry[]): Promise<{ root: string; htmlFile: string } | null> {
  const htmlEntry = findHtmlEntry(entries);
  if (!htmlEntry) return null;

  const root = await mkdtemp(path.join(tmpdir(), "trae-demo-audit-"));
  let extractedFiles = 0;
  let extractedBytes = 0;
  for (const entry of entries) {
    const safeName = safeZipEntryName(entry.name);
    if (!safeName) continue;
    extractedFiles += 1;
    extractedBytes += entry.data.length;
    if (extractedFiles > MAX_EXTRACTED_FILES || extractedBytes > MAX_TOTAL_EXTRACTED_BYTES) break;

    const target = path.join(root, safeName);
    const relative = path.relative(root, target);
    if (relative.startsWith("..") || path.isAbsolute(relative)) continue;
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, entry.data);
  }

  return { root, htmlFile: path.join(root, htmlEntry.name) };
}

async function auditWebDemo(topic: TraeTopic, options: DemoAuditOptions): Promise<VisualEvidence | null> {
  if (!topic.demoUrl || !isHttpUrl(topic.demoUrl) || isObviouslyUnsafeBrowserUrl(topic.demoUrl)) return null;
  const screenshot = await captureBrowserScreenshot(topic.demoUrl, options);
  if (!screenshot) return null;
  return describeAuditedScreenshot(
    screenshot,
    topic,
    options,
    "browser_agent",
    "browser_verified",
    "web",
    `Browser agent opened the submitted web Demo (${topic.demoUrl}), attempted one likely primary click, and captured the resulting viewport.`
  );
}

async function fetchPackage(url: string, options: DemoAuditOptions): Promise<Buffer | null> {
  if (!isHttpUrl(url) || isObviouslyUnsafeBrowserUrl(url)) return null;
  const response = await (options.fetchFn ?? fetch)(url);
  if (!response.ok) return null;
  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.length > (options.maxPackageBytes ?? MAX_PACKAGE_BYTES)) return null;
  return buffer;
}

async function auditZipDemo(topic: TraeTopic, options: DemoAuditOptions): Promise<VisualEvidence | null> {
  for (const url of getDownloadPackageUrls(topic)) {
    let extracted: { root: string; htmlFile: string } | null = null;
    try {
      const buffer = await fetchPackage(url, options);
      if (!buffer) continue;
      extracted = await extractZipToTemp(parseZipEntries(buffer));
      if (!extracted) continue;
      const screenshot = await captureBrowserScreenshot(pathToFileURL(extracted.htmlFile).toString(), options);
      if (!screenshot) continue;
      const evidence = await describeAuditedScreenshot(
        screenshot,
        topic,
        options,
        "package_agent",
        "package_verified",
        "download",
        `Package auditor downloaded ${url}, extracted the best HTML entry (${path.basename(extracted.htmlFile)}), opened it locally, attempted one likely primary click, and captured the viewport.`
      );
      if (evidence) return evidence;
    } catch {
      // Try the next package URL.
    } finally {
      if (extracted) await rm(extracted.root, { recursive: true, force: true }).catch(() => undefined);
    }
  }
  return null;
}

export async function auditDemoArtifact(
  topic: TraeTopic,
  options: DemoAuditOptions = {}
): Promise<VisualEvidence | null> {
  try {
    return (await auditWebDemo(topic, options)) ?? (await auditZipDemo(topic, options));
  } catch {
    return null;
  }
}
