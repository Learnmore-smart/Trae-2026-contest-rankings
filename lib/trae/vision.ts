import { getTraeConfig, type TraeConfig } from "./config.ts";
import { callVisionLLMWithFallback, type LLMContentPart } from "./llm.ts";
import type { TraeTopic } from "./types.ts";

/** Cap each vision request while still covering every uploaded image across batches. */
const MAX_TOPIC_IMAGES_PER_BATCH = 4;

export interface VisualEvidence {
  summary: string;
  provider: string;
  model: string;
}

export interface TopicVisualEvidence {
  imageEvidence: VisualEvidence | null;
  demoEvidence: VisualEvidence | null;
}

export interface GatherVisualEvidenceOptions {
  config?: TraeConfig;
  fetchFn?: typeof fetch;
  sleepFn?: (delayMs: number) => Promise<void>;
}

function isHttpUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values));
}

function chunk<T>(values: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }
  return chunks;
}

function hasVisualDemoCue(topic: TraeTopic): boolean {
  const haystack = `${topic.title} ${topic.contentText} ${topic.tags.join(" ")}`;
  return /二维码|扫码|小程序|微信|体验码|QR\s*code|qrcode|wechat|mini\s*program|miniprogram|scan\s*(qr|code)/i.test(haystack);
}

function isLikelyVisualDemoImageUrl(url: string): boolean {
  return /qr|qrcode|wechat|weixin|mini-?program|miniprogram/i.test(url);
}

function selectTopicImageUrls(topic: TraeTopic): string[] {
  const visualDemoImageUrls = Array.isArray(topic.traeEvidence?.visualDemoImageUrls)
    ? topic.traeEvidence.visualDemoImageUrls.filter((url): url is string => typeof url === "string")
    : [];
  const legacyVisualDemoImageUrls = hasVisualDemoCue(topic)
    ? [...topic.imageUrls.filter(isLikelyVisualDemoImageUrl), ...topic.imageUrls]
    : [];
  return unique([...visualDemoImageUrls, ...legacyVisualDemoImageUrls, ...topic.imageUrls]).filter(isHttpUrl);
}

function buildTopicImagesContent(imageUrls: string[], batchNumber: number, batchCount: number): LLMContentPart[] {
  const batchNote = batchCount > 1 ? `这是第 ${batchNumber}/${batchCount} 批图片。` : "";
  return [
    {
      type: "text",
      text:
        "以下是 TRAE 大赛参赛帖子中作者上传的图片（开发过程截图或产品截图）。" +
        batchNote +
        "请按官方普通截图证据标准客观检查：是否至少有一张（at least one）Trae usage/development process screenshot（展示使用 Trae、提示词、会话、开发过程或调试过程），" +
        "以及是否至少有一张（at least one）finished Demo/product interface screenshot（展示成品 Demo、产品界面、二维码/小程序体验入口或可运行结果）。" +
        "请同时描述你实际看到的内容：是否显示真实可用的产品界面、是否只是营销/概念/占位图、界面完成度与质量如何。" +
        "用中文写 2-4 句话总结，只描述图片中实际出现的内容，不要编造未展示的功能。"
    },
    ...imageUrls.map((url) => ({ type: "image_url" as const, image_url: { url } }))
  ];
}

/**
 * thum.io renders the target URL server-side and returns the screenshot image itself
 * (no API key, no signup). We never fetch the demo URL ourselves, so classic SSRF
 * against our own infra is not in play; thum.io does the fetching, same as a link
 * preview widget. The vision model then fetches this screenshot URL server-side.
 */
export function buildDemoScreenshotUrl(demoUrl: string): string | null {
  if (!isHttpUrl(demoUrl)) return null;
  return `https://image.thum.io/get/width/1200/noanimate/${demoUrl}`;
}

export async function describeTopicImages(
  topic: TraeTopic,
  options: GatherVisualEvidenceOptions = {}
): Promise<VisualEvidence | null> {
  const config = options.config ?? getTraeConfig();
  const imageUrls = selectTopicImageUrls(topic);
  if (imageUrls.length === 0) return null;

  const imageBatches = chunk(imageUrls, MAX_TOPIC_IMAGES_PER_BATCH);
  const evidence: VisualEvidence[] = [];

  for (const [index, batch] of imageBatches.entries()) {
    try {
      const result = await callVisionLLMWithFallback({
        config,
        messages: [{ role: "user", content: buildTopicImagesContent(batch, index + 1, imageBatches.length) }],
        fetchFn: options.fetchFn,
        sleepFn: options.sleepFn
      });
      evidence.push({ summary: result.content.trim(), provider: result.provider, model: result.model });
    } catch {
      // Continue with remaining batches; one failed batch should not erase all visual evidence.
    }
  }

  if (evidence.length === 0) return null;

  const summary = evidence.length === 1
    ? evidence[0].summary
    : evidence.map((item, index) => `图片批次 ${index + 1}/${imageBatches.length}: ${item.summary}`).join("\n");
  return {
    summary,
    provider: unique(evidence.map((item) => item.provider)).join(", "),
    model: unique(evidence.map((item) => item.model)).join(", ")
  };
}

export async function describeDemoScreenshot(
  topic: TraeTopic,
  options: GatherVisualEvidenceOptions = {}
): Promise<VisualEvidence | null> {
  if (!topic.demoUrl) return null;
  const screenshotUrl = buildDemoScreenshotUrl(topic.demoUrl);
  if (!screenshotUrl) return null;

  const config = options.config ?? getTraeConfig();
  const content: LLMContentPart[] = [
    {
      type: "text",
      text:
        `这是刚刚自动截图的参赛作品 Demo 网页（${topic.demoUrl}）当前实际渲染效果，等同于人类打开链接第一眼看到的画面。` +
        "请客观描述实际看到的页面：是可交互的真实产品界面，还是只是静态介绍/营销落地页，还是加载失败/空白/报错页面。" +
        "评估界面完整度和观摩价值。用中文写 2-4 句话总结，只描述截图中实际出现的内容，不要编造未显示的功能。"
    },
    { type: "image_url", image_url: { url: screenshotUrl } }
  ];

  try {
    const result = await callVisionLLMWithFallback({
      config,
      messages: [{ role: "user", content }],
      fetchFn: options.fetchFn,
      sleepFn: options.sleepFn
    });
    return { summary: result.content.trim(), provider: result.provider, model: result.model };
  } catch {
    return null;
  }
}

/**
 * Best-effort: both calls swallow their own failures and resolve to null so a
 * throttled/broken vision model never blocks text-based judging. Callers must fall
 * back to an honest "not performed" disclaimer when a field is null.
 */
export async function gatherVisualEvidence(
  topic: TraeTopic,
  options: GatherVisualEvidenceOptions = {}
): Promise<TopicVisualEvidence> {
  const [imageEvidence, demoEvidence] = await Promise.all([
    describeTopicImages(topic, options),
    describeDemoScreenshot(topic, options)
  ]);
  return { imageEvidence, demoEvidence };
}
