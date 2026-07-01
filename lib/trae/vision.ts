import { getTraeConfig, type TraeConfig } from "./config.ts";
import { callVisionLLMWithFallback, type LLMContentPart } from "./llm.ts";
import type { TraeTopic } from "./types.ts";

/** Cap tokens/cost and keep one failed image from derailing the whole batch. */
const MAX_TOPIC_IMAGES = 4;

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

/**
 * thum.io renders the target URL server-side and returns the screenshot image itself
 * (no API key, no signup). We never fetch the demo URL ourselves, so classic SSRF
 * against our own infra isn't in play — thum.io does the fetching, same as any link
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
  const imageUrls = topic.imageUrls.filter(isHttpUrl).slice(0, MAX_TOPIC_IMAGES);
  if (imageUrls.length === 0) return null;

  const content: LLMContentPart[] = [
    {
      type: "text",
      text:
        "以下是 TRAE 大赛参赛帖子中作者上传的图片（开发过程截图或产品截图）。" +
        "请客观描述你实际看到的内容：是否显示真实可用的产品界面、是否只是营销/概念/占位图、界面完成度与质量如何。" +
        "用中文写 2-4 句话总结，只描述图片中实际出现的内容，不要编造未展示的功能。"
    },
    ...imageUrls.map((url) => ({ type: "image_url" as const, image_url: { url } }))
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
