import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getTraeConfig } from "../lib/trae/config.ts";
import {
  buildDemoScreenshotUrl,
  describeDemoScreenshot,
  describeTopicImages,
  gatherVisualEvidence
} from "../lib/trae/vision.ts";
import type { TraeTopic } from "../lib/trae/types.ts";

type EnvPatch = Record<string, string | undefined>;

const aiEnvKeys = [
  "NVIDIA_API_KEY",
  "NVIDIA_BASE_URL",
  "NVIDIA_PRIMARY_MODEL",
  "NVIDIA_FALLBACK_MODELS",
  "NVIDIA_IMAGE_MODEL",
  "NVIDIA_IMAGE_FALLBACK_MODEL",
  "OPENROUTER_API_KEY",
  "OPENROUTER_BASE_URL",
  "OPENROUTER_PRIMARY_MODEL",
  "OPENROUTER_FALLBACK_MODELS",
  "AI_PROVIDER_ORDER",
  "AI_ZERO_BUDGET_ONLY",
  "AI_RPM_LIMIT",
  "AI_MAX_RETRIES_PER_MODEL",
  "AI_REQUEST_TIMEOUT_MS"
];

function withEnv<T>(patch: EnvPatch, fn: () => T): T {
  const previous = new Map<string, string | undefined>();
  for (const key of aiEnvKeys) {
    previous.set(key, process.env[key]);
    delete process.env[key];
  }
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }

  try {
    return fn();
  } finally {
    for (const [key, value] of previous) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

function zeroBudgetEnv(overrides: EnvPatch = {}): EnvPatch {
  return {
    NVIDIA_API_KEY: "nvidia-key",
    NVIDIA_BASE_URL: "https://integrate.api.nvidia.com/v1",
    NVIDIA_PRIMARY_MODEL: "moonshotai/kimi-k2.6",
    NVIDIA_FALLBACK_MODELS: "z-ai/glm-5.1,deepseek-ai/deepseek-v4-flash",
    NVIDIA_IMAGE_MODEL: "moonshotai/kimi-k2.6",
    NVIDIA_IMAGE_FALLBACK_MODEL: "minimaxai/minimax-m3",
    OPENROUTER_API_KEY: "openrouter-key",
    OPENROUTER_BASE_URL: "https://openrouter.ai/api/v1",
    OPENROUTER_PRIMARY_MODEL: "openai/gpt-oss-120b",
    OPENROUTER_FALLBACK_MODELS: "nvidia/nemotron-3-ultra-550b-a55b:free,google/gemma-4-31b-it:free",
    AI_PROVIDER_ORDER: "nvidia,openrouter",
    AI_ZERO_BUDGET_ONLY: "true",
    AI_RPM_LIMIT: "30",
    AI_MAX_RETRIES_PER_MODEL: "0",
    AI_REQUEST_TIMEOUT_MS: "120000",
    ...overrides
  };
}

const baseTopic: TraeTopic = {
  id: "topic-1",
  sourceType: "preliminary",
  externalTopicId: "123",
  slug: "demo-post",
  title: "Vision test topic",
  url: "https://forum.example.test/t/demo-post/123",
  authorName: "Noah",
  authorAvatarUrl: null,
  track: "学习工作",
  tags: ["AI"],
  replyCount: 2,
  viewCount: 99,
  likeCount: 5,
  createdAtExternal: null,
  lastActivityAtExternal: null,
  scrapedAt: "2026-07-01T00:00:00.000Z",
  updatedAt: "2026-07-01T00:00:00.000Z",
  contentText: "A post with images and a demo link.",
  contentHtml: null,
  excerpt: "excerpt",
  demoUrl: "https://warmguide.netlify.app/",
  attachmentUrls: [],
  imageUrls: ["https://forum.example.test/a.png", "https://forum.example.test/b.png"],
  sessionIds: ["s1", "s2", "s3"],
  traeEvidence: {
    hasDemoUrl: true,
    hasTraeProcess: true,
    screenshotCount: 2,
    sessionIdCount: 3,
    hasThreeScreenshots: false,
    hasThreeSessionIds: true,
    processKeywords: ["TRAE"]
  },
  contentHash: "hash",
  status: "needs_judging",
  rawJson: null,
  rawHtml: null
};

function visionResponse(text: string): Response {
  return Response.json({ choices: [{ message: { content: text } }] });
}

describe("buildDemoScreenshotUrl", () => {
  it("builds a thum.io screenshot URL for http(s) demo links", () => {
    assert.equal(
      buildDemoScreenshotUrl("https://warmguide.netlify.app/"),
      "https://image.thum.io/get/width/1200/noanimate/https://warmguide.netlify.app/"
    );
  });

  it("rejects non-http(s) schemes", () => {
    assert.equal(buildDemoScreenshotUrl("javascript:alert(1)"), null);
    assert.equal(buildDemoScreenshotUrl("not a url"), null);
  });
});

describe("describeTopicImages", () => {
  it("sends up to 4 image_url parts to the primary vision model and returns its summary", async () => {
    await withEnv(zeroBudgetEnv(), async () => {
      const requests: Array<{ model: string; content: unknown }> = [];
      const evidence = await describeTopicImages(
        { ...baseTopic, imageUrls: ["https://a.test/1.png", "https://a.test/2.png"] },
        {
          config: getTraeConfig(),
          fetchFn: async (_url, init) => {
            const body = JSON.parse(String(init?.body)) as { model: string; messages: Array<{ content: unknown }> };
            requests.push({ model: body.model, content: body.messages[0]?.content });
            return visionResponse("这两张图片显示真实产品界面。");
          },
          sleepFn: async () => undefined
        }
      );

      assert.equal(requests.length, 1);
      assert.equal(requests[0]?.model, "moonshotai/kimi-k2.6");
      const parts = requests[0]?.content as Array<{ type: string; image_url?: { url: string } }>;
      assert.equal(parts.filter((part) => part.type === "image_url").length, 2);
      assert.equal(evidence?.summary, "这两张图片显示真实产品界面。");
      assert.equal(evidence?.model, "moonshotai/kimi-k2.6");
    });
  });

  it("asks Kimi to classify official screenshot evidence categories", async () => {
    await withEnv(zeroBudgetEnv(), async () => {
      let promptText = "";
      await describeTopicImages(
        { ...baseTopic, imageUrls: ["https://a.test/trae.png", "https://a.test/demo.png"] },
        {
          config: getTraeConfig(),
          fetchFn: async (_url, init) => {
            const body = JSON.parse(String(init?.body)) as { messages: Array<{ content: Array<{ type: string; text?: string }> }> };
            const textPart = body.messages[0]?.content.find((part) => part.type === "text");
            promptText = textPart?.text ?? "";
            return visionResponse("ok");
          },
          sleepFn: async () => undefined
        }
      );

      assert.match(promptText, /Trae usage\/development process screenshot/i);
      assert.match(promptText, /finished Demo\/product interface screenshot/i);
      assert.match(promptText, /at least one/i);
    });
  });

  it("caps image count at 4 to bound tokens/cost", async () => {
    await withEnv(zeroBudgetEnv(), async () => {
      const manyImages = Array.from({ length: 8 }, (_, i) => `https://a.test/${i}.png`);
      const requests: Array<Array<{ type: string }>> = [];
      await describeTopicImages(
        { ...baseTopic, imageUrls: manyImages },
        {
          config: getTraeConfig(),
          fetchFn: async (_url, init) => {
            const body = JSON.parse(String(init?.body)) as { messages: Array<{ content: Array<{ type: string }> }> };
            requests.push(body.messages[0]?.content ?? []);
            return visionResponse("ok");
          }
        }
      );

      const imageParts = requests[0]?.filter((part) => part.type === "image_url") ?? [];
      assert.equal(imageParts.length, 4);
    });
  });

  it("prioritizes QR or mini-program demo images before generic screenshots", async () => {
    await withEnv(zeroBudgetEnv(), async () => {
      const sentUrls: string[] = [];
      const baseEvidence = baseTopic.traeEvidence;
      assert.ok(baseEvidence);
      const evidence = await describeTopicImages(
        {
          ...baseTopic,
          imageUrls: [
            "https://a.test/screenshot-1.png",
            "https://a.test/screenshot-2.png",
            "https://a.test/screenshot-3.png",
            "https://a.test/screenshot-4.png",
            "https://a.test/qr.png"
          ],
          traeEvidence: {
            ...baseEvidence,
            visualDemoImageUrls: ["https://a.test/qr.png"]
          }
        },
        {
          config: getTraeConfig(),
          fetchFn: async (_url, init) => {
            const body = JSON.parse(String(init?.body)) as { messages: Array<{ content: Array<{ type: string; image_url?: { url: string } }> }> };
            for (const part of body.messages[0]?.content ?? []) {
              if (part.type === "image_url" && part.image_url?.url) sentUrls.push(part.image_url.url);
            }
            return visionResponse("qr first");
          },
          sleepFn: async () => undefined
        }
      );

      assert.equal(evidence?.summary, "qr first");
      assert.equal(sentUrls[0], "https://a.test/qr.png");
      assert.equal(sentUrls.length, 4);
    });
  });

  it("infers QR priority from legacy topic text when visual demo fields are absent", async () => {
    await withEnv(zeroBudgetEnv(), async () => {
      const sentUrls: string[] = [];
      const evidence = await describeTopicImages(
        {
          ...baseTopic,
          title: "微信小程序 Demo",
          contentText: "微信小程序扫码体验，二维码见下图。",
          imageUrls: [
            "https://a.test/screenshot-1.png",
            "https://a.test/screenshot-2.png",
            "https://a.test/screenshot-3.png",
            "https://a.test/screenshot-4.png",
            "https://a.test/miniprogram-qr.png"
          ],
          traeEvidence: baseTopic.traeEvidence
        },
        {
          config: getTraeConfig(),
          fetchFn: async (_url, init) => {
            const body = JSON.parse(String(init?.body)) as { messages: Array<{ content: Array<{ type: string; image_url?: { url: string } }> }> };
            for (const part of body.messages[0]?.content ?? []) {
              if (part.type === "image_url" && part.image_url?.url) sentUrls.push(part.image_url.url);
            }
            return visionResponse("legacy qr first");
          },
          sleepFn: async () => undefined
        }
      );

      assert.equal(evidence?.summary, "legacy qr first");
      assert.equal(sentUrls[0], "https://a.test/miniprogram-qr.png");
      assert.equal(sentUrls.length, 4);
    });
  });

  it("returns null without calling the model when there are no images", async () => {
    await withEnv(zeroBudgetEnv(), async () => {
      let called = false;
      const evidence = await describeTopicImages(
        { ...baseTopic, imageUrls: [] },
        {
          config: getTraeConfig(),
          fetchFn: async () => {
            called = true;
            return visionResponse("unused");
          }
        }
      );
      assert.equal(evidence, null);
      assert.equal(called, false);
    });
  });

  it("falls back to the secondary vision model when the primary is throttled", async () => {
    await withEnv(zeroBudgetEnv(), async () => {
      const models: string[] = [];
      const evidence = await describeTopicImages(baseTopic, {
        config: getTraeConfig(),
        fetchFn: async (_url, init) => {
          const body = JSON.parse(String(init?.body)) as { model: string };
          models.push(body.model);
          if (body.model === "moonshotai/kimi-k2.6") {
            return Response.json({ id: "", choices: [], usage: null });
          }
          return visionResponse("minimax 描述");
        },
        sleepFn: async () => undefined
      });

      assert.deepEqual(models, ["moonshotai/kimi-k2.6", "minimaxai/minimax-m3"]);
      assert.equal(evidence?.model, "minimaxai/minimax-m3");
    });
  });

  it("returns null (not a throw) when every vision model fails", async () => {
    await withEnv(zeroBudgetEnv(), async () => {
      const evidence = await describeTopicImages(baseTopic, {
        config: getTraeConfig(),
        fetchFn: async () => new Response("boom", { status: 500 }),
        sleepFn: async () => undefined
      });
      assert.equal(evidence, null);
    });
  });
});

describe("describeDemoScreenshot", () => {
  it("sends a thum.io screenshot URL of the demo link to the vision model", async () => {
    await withEnv(zeroBudgetEnv(), async () => {
      let sentImageUrl: string | undefined;
      const evidence = await describeDemoScreenshot(baseTopic, {
        config: getTraeConfig(),
        fetchFn: async (_url, init) => {
          const body = JSON.parse(String(init?.body)) as { messages: Array<{ content: Array<{ type: string; image_url?: { url: string } }> }> };
          sentImageUrl = body.messages[0]?.content.find((part) => part.type === "image_url")?.image_url?.url;
          return visionResponse("这是一个静态营销落地页。");
        }
      });

      assert.equal(sentImageUrl, "https://image.thum.io/get/width/1200/noanimate/https://warmguide.netlify.app/");
      assert.equal(evidence?.summary, "这是一个静态营销落地页。");
    });
  });

  it("returns null without calling the model when there is no demo URL", async () => {
    await withEnv(zeroBudgetEnv(), async () => {
      let called = false;
      const evidence = await describeDemoScreenshot(
        { ...baseTopic, demoUrl: null },
        {
          config: getTraeConfig(),
          fetchFn: async () => {
            called = true;
            return visionResponse("unused");
          }
        }
      );
      assert.equal(evidence, null);
      assert.equal(called, false);
    });
  });
});

describe("gatherVisualEvidence", () => {
  it("runs image and demo vision concurrently and returns both results", async () => {
    await withEnv(zeroBudgetEnv(), async () => {
      const evidence = await gatherVisualEvidence(baseTopic, {
        config: getTraeConfig(),
        fetchFn: async (_url, init) => {
          const body = JSON.parse(String(init?.body)) as { messages: Array<{ content: Array<{ type: string }> }> };
          const isDemo = body.messages[0]?.content.length === 2;
          return visionResponse(isDemo ? "demo summary" : "image summary");
        }
      });

      assert.equal(evidence.imageEvidence?.summary, "image summary");
      assert.equal(evidence.demoEvidence?.summary, "demo summary");
    });
  });

  it("keeps image evidence even when demo screenshot vision fails", async () => {
    await withEnv(zeroBudgetEnv(), async () => {
      const evidence = await gatherVisualEvidence(baseTopic, {
        config: getTraeConfig(),
        fetchFn: async (_url, init) => {
          const body = JSON.parse(String(init?.body)) as { messages: Array<{ content: Array<{ type: string }> }> };
          const isDemo = body.messages[0]?.content.length === 2;
          if (isDemo) return new Response("boom", { status: 500 });
          return visionResponse("image summary");
        },
        sleepFn: async () => undefined
      });

      assert.equal(evidence.imageEvidence?.summary, "image summary");
      assert.equal(evidence.demoEvidence, null);
    });
  });
});
