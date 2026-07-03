import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getTraeConfig } from "../lib/trae/config.ts";
import { auditDemoArtifact } from "../lib/trae/demo-audit.ts";
import {
  buildDemoScreenshotUrl,
  describeDemoScreenshot,
  describeTopicImages,
  gatherVisualEvidence
} from "../lib/trae/vision.ts";
import type { TraeTopic } from "../lib/trae/types.ts";

type EnvPatch = Record<string, string | undefined>;

const aiEnvKeys = [
  "TRAE_FRIEND_API",
  "TRAE_FRIEND_BASE_URL",
  "FRIEND_PRIMARY_MODEL",
  "FRIEND_FALLBACK_MODELS",
  "FRIEND_IMAGE_MODEL",
  "FRIEND_IMAGE_FALLBACK_MODEL",
  "NVIDIA_API_KEY",
  "NVIDIA_BASE_URL",
  "NVIDIA_PRIMARY_MODEL",
  "NVIDIA_FALLBACK_MODELS",
  "NVIDIA_IMAGE_MODEL",
  "NVIDIA_IMAGE_FALLBACK_MODEL",
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
    TRAE_FRIEND_API: "friend-key",
    TRAE_FRIEND_BASE_URL: "https://friend.example/v1",
    FRIEND_PRIMARY_MODEL: "z-ai/glm-5.2",
    FRIEND_FALLBACK_MODELS: "deepseek-ai/deepseek-v4-pro,minimaxai/minimax-m3,moonshotai/kimi-k2.6",
    FRIEND_IMAGE_MODEL: "moonshotai/kimi-k2.6",
    FRIEND_IMAGE_FALLBACK_MODEL: "minimaxai/minimax-m3",
    NVIDIA_API_KEY: "nvidia-key",
    NVIDIA_BASE_URL: "https://integrate.api.nvidia.com/v1",
    NVIDIA_PRIMARY_MODEL: "z-ai/glm-5.2",
    NVIDIA_FALLBACK_MODELS: "deepseek-ai/deepseek-v4-pro,minimaxai/minimax-m3,moonshotai/kimi-k2.6",
    NVIDIA_IMAGE_MODEL: "moonshotai/kimi-k2.6",
    NVIDIA_IMAGE_FALLBACK_MODEL: "minimaxai/minimax-m3",
    AI_PROVIDER_ORDER: "friend,nvidia",
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

function fakePlaywright(screenshotBytes: Uint8Array, navigations: string[], clicks: string[]) {
  return {
    chromium: {
      launch: async () => ({
        newPage: async () => ({
          goto: async (url: string) => {
            navigations.push(url);
          },
          waitForLoadState: async () => undefined,
          locator: (selector: string) => ({
            first() {
              return this;
            },
            count: async () => (selector.includes("button") ? 1 : 0),
            isVisible: async () => true,
            click: async () => {
              clicks.push(selector);
            }
          }),
          screenshot: async () => Buffer.from(screenshotBytes)
        }),
        close: async () => undefined
      })
    }
  };
}

function makeStoredZip(entries: Array<{ name: string; content: string }>): Buffer {
  const chunks: Buffer[] = [];
  for (const entry of entries) {
    const name = Buffer.from(entry.name);
    const content = Buffer.from(entry.content);
    const header = Buffer.alloc(30);
    header.writeUInt32LE(0x04034b50, 0);
    header.writeUInt16LE(20, 4);
    header.writeUInt16LE(0, 6);
    header.writeUInt16LE(0, 8);
    header.writeUInt32LE(0, 10);
    header.writeUInt32LE(0, 14);
    header.writeUInt32LE(content.length, 18);
    header.writeUInt32LE(content.length, 22);
    header.writeUInt16LE(name.length, 26);
    header.writeUInt16LE(0, 28);
    chunks.push(header, name, content);
  }
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  chunks.push(end);
  return Buffer.concat(chunks);
}

describe("auditDemoArtifact", () => {
  it("opens a web demo with a browser adapter, clicks a primary control, and sends the screenshot to vision", async () => {
    await withEnv(zeroBudgetEnv(), async () => {
      const navigations: string[] = [];
      const clicks: string[] = [];
      let sawScreenshot = false;
      const evidence = await auditDemoArtifact(baseTopic, {
        config: getTraeConfig(),
        importPlaywright: async () => fakePlaywright(Buffer.from("fake-png"), navigations, clicks),
        fetchFn: async (_url, init) => {
          const body = JSON.parse(String(init?.body)) as { messages: Array<{ content: Array<{ type: string; image_url?: { url: string } }> }> };
          sawScreenshot = body.messages[0]?.content.some((part) => part.image_url?.url.startsWith("data:image/png;base64,")) ?? false;
          return visionResponse("浏览器审核显示点击后进入了可交互产品界面。");
        },
        sleepFn: async () => undefined
      });

      assert.deepEqual(navigations, [baseTopic.demoUrl]);
      assert.ok(clicks.length >= 1);
      assert.equal(sawScreenshot, true);
      assert.equal(evidence?.source, "browser_agent");
      assert.equal(evidence?.auditStatus, "browser_verified");
      assert.equal(evidence?.artifactType, "web");
      assert.match(evidence?.summary ?? "", /可交互产品界面/);
    });
  });

  it("extracts a zip demo, opens index.html with a browser adapter, and sends the screenshot to vision", async () => {
    await withEnv(zeroBudgetEnv(), async () => {
      const navigations: string[] = [];
      const baseEvidence = baseTopic.traeEvidence;
      assert.ok(baseEvidence);
      const zip = makeStoredZip([
        { name: "dist/index.html", content: "<!doctype html><button>Start</button>" },
        { name: "dist/app.js", content: "console.log('demo')" }
      ]);
      const evidence = await auditDemoArtifact(
        {
          ...baseTopic,
          demoUrl: null,
          attachmentUrls: ["https://forum.example.test/uploads/source.zip"],
          traeEvidence: {
            ...baseEvidence,
            hasDemoUrl: false,
            hasDemoEvidence: true,
            demoEvidenceTypes: ["download"],
            downloadDemoUrls: ["https://forum.example.test/uploads/source.zip"]
          }
        },
        {
          config: getTraeConfig(),
          importPlaywright: async () => fakePlaywright(Buffer.from("zip-png"), navigations, []),
          fetchFn: async (url, init) => {
            if (String(url).includes("/uploads/source.zip")) return new Response(new Uint8Array(zip));
            const body = JSON.parse(String(init?.body)) as { messages: Array<{ content: Array<{ image_url?: { url: string } }> }> };
            assert.ok(body.messages[0]?.content.some((part) => part.image_url?.url.startsWith("data:image/png;base64,")));
            return visionResponse("ZIP 包审核显示 index.html 可以渲染为产品界面。");
          },
          sleepFn: async () => undefined
        }
      );

      assert.ok(navigations[0]?.startsWith("file://"));
      assert.equal(evidence?.source, "package_agent");
      assert.equal(evidence?.auditStatus, "package_verified");
      assert.equal(evidence?.artifactType, "download");
      assert.match(evidence?.summary ?? "", /index\.html/);
    });
  });
});

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

  it("sends all post images across bounded batches so later process screenshots are visible", async () => {
    await withEnv(zeroBudgetEnv(), async () => {
      const manyImages = Array.from({ length: 9 }, (_, i) => `https://a.test/${i}.png`);
      const sentUrls: string[] = [];
      await describeTopicImages(
        { ...baseTopic, imageUrls: manyImages },
        {
          config: getTraeConfig(),
          fetchFn: async (_url, init) => {
            const body = JSON.parse(String(init?.body)) as { messages: Array<{ content: Array<{ type: string; image_url?: { url: string } }> }> };
            for (const part of body.messages[0]?.content ?? []) {
              if (part.type === "image_url" && part.image_url?.url) sentUrls.push(part.image_url.url);
            }
            return visionResponse("ok");
          },
          sleepFn: async () => undefined
        }
      );

      assert.deepEqual(sentUrls, manyImages);
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

      assert.equal(evidence?.summary, "图片批次 1/2: qr first\n图片批次 2/2: qr first");
      assert.equal(sentUrls[0], "https://a.test/qr.png");
      assert.deepEqual(sentUrls, [
        "https://a.test/qr.png",
        "https://a.test/screenshot-1.png",
        "https://a.test/screenshot-2.png",
        "https://a.test/screenshot-3.png",
        "https://a.test/screenshot-4.png"
      ]);
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

      assert.equal(evidence?.summary, "图片批次 1/2: legacy qr first\n图片批次 2/2: legacy qr first");
      assert.equal(sentUrls[0], "https://a.test/miniprogram-qr.png");
      assert.deepEqual(sentUrls, [
        "https://a.test/miniprogram-qr.png",
        "https://a.test/screenshot-1.png",
        "https://a.test/screenshot-2.png",
        "https://a.test/screenshot-3.png",
        "https://a.test/screenshot-4.png"
      ]);
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
  it("uses injected browser audit evidence before the screenshot-proxy fallback", async () => {
    await withEnv(zeroBudgetEnv(), async () => {
      let auditCalled = false;
      let fetchCalled = false;
      const evidence = await describeDemoScreenshot(baseTopic, {
        config: getTraeConfig(),
        demoAuditFn: async (topic) => {
          auditCalled = true;
          assert.equal(topic.id, baseTopic.id);
          return {
            summary: "Browser agent opened the demo, clicked the primary control, and captured an interactive product screen.",
            provider: "browser-agent",
            model: "playwright+kimi-k2.6",
            source: "browser_agent",
            auditStatus: "browser_verified",
            artifactType: "web"
          };
        },
        fetchFn: async () => {
          fetchCalled = true;
          return visionResponse("unused");
        }
      });

      assert.equal(auditCalled, true);
      assert.equal(fetchCalled, false);
      assert.equal(evidence?.source, "browser_agent");
      assert.equal(evidence?.auditStatus, "browser_verified");
      assert.equal(evidence?.artifactType, "web");
      assert.match(evidence?.summary ?? "", /clicked the primary control/);
    });
  });

  it("allows injected package audit evidence when only a downloadable zip demo exists", async () => {
    await withEnv(zeroBudgetEnv(), async () => {
      const baseEvidence = baseTopic.traeEvidence;
      assert.ok(baseEvidence);
      const evidence = await describeDemoScreenshot(
        {
          ...baseTopic,
          demoUrl: null,
          attachmentUrls: ["https://forum.example.test/uploads/source.zip"],
          traeEvidence: {
            ...baseEvidence,
            hasDemoUrl: false,
            hasDemoEvidence: true,
            demoEvidenceTypes: ["download"],
            downloadDemoUrls: ["https://forum.example.test/uploads/source.zip"]
          }
        },
        {
          config: getTraeConfig(),
          demoAuditFn: async () => ({
            summary: "Package auditor extracted index.html from the zip and captured a rendered product screen.",
            provider: "browser-agent",
            model: "zip-html+kimi-k2.6",
            source: "package_agent",
            auditStatus: "package_verified",
            artifactType: "download"
          }),
          fetchFn: async () => {
            throw new Error("screenshot proxy should not be called for package audit evidence");
          }
        }
      );

      assert.equal(evidence?.source, "package_agent");
      assert.equal(evidence?.auditStatus, "package_verified");
      assert.equal(evidence?.artifactType, "download");
      assert.match(evidence?.summary ?? "", /extracted index\.html/);
    });
  });

  it("sends a thum.io screenshot URL of the demo link to the vision model", async () => {
    await withEnv(zeroBudgetEnv(), async () => {
      let sentImageUrl: string | undefined;
      const evidence = await describeDemoScreenshot(baseTopic, {
        config: getTraeConfig(),
        fetchFn: async (_url, init) => {
          const body = JSON.parse(String(init?.body)) as { messages: Array<{ content: Array<{ type: string; image_url?: { url: string } }> }> };
          sentImageUrl = body.messages[0]?.content.find((part) => part.type === "image_url")?.image_url?.url;
          return visionResponse("这是一个静态营销落地页。");
        },
        sleepFn: async () => undefined
      });

      assert.equal(sentImageUrl, "https://image.thum.io/get/width/1200/noanimate/https://warmguide.netlify.app/");
      assert.equal(evidence?.summary, "这是一个静态营销落地页。");
      assert.equal(evidence?.source, "screenshot_proxy");
      assert.equal(evidence?.auditStatus, "first_screen_only");
      assert.equal(evidence?.artifactType, "web");
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
        },
        sleepFn: async () => undefined
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
