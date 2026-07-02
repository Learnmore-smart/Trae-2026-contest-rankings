import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getTraeConfig } from "../lib/trae/config.ts";
import { buildLLMFallbackPlan, buildVisionLLMFallbackPlan, callLLMWithFallback, callVisionLLMWithFallback } from "../lib/trae/llm.ts";

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
    OPENROUTER_FALLBACK_MODELS:
      "nvidia/nemotron-3-ultra-550b-a55b:free,google/gemma-4-31b-it:free",
    AI_PROVIDER_ORDER: "nvidia,openrouter",
    AI_ZERO_BUDGET_ONLY: "true",
    AI_RPM_LIMIT: "60000",
    AI_MAX_RETRIES_PER_MODEL: "1",
    AI_REQUEST_TIMEOUT_MS: "120000",
    ...overrides
  };
}

describe("LLM zero-budget fallback client", () => {
  it("defaults the shared AI rate limit to 40 rpm", () => {
    withEnv(zeroBudgetEnv({ AI_RPM_LIMIT: undefined }), () => {
      assert.equal(getTraeConfig().aiRpmLimit, 40);
    });
  });

  it("defaults NVIDIA text order to DeepSeek V4 Pro, MiniMax M3, then Kimi K2.6", () => {
    withEnv(
      zeroBudgetEnv({
        NVIDIA_PRIMARY_MODEL: undefined,
        NVIDIA_FALLBACK_MODELS: undefined
      }),
      () => {
        const config = getTraeConfig();
        const plan = buildLLMFallbackPlan(config);
        // DeepSeek V4 Flash (hangs) and GLM 5.1 (410 EOL 2026-07-02) are intentionally
        // excluded from the defaults; only verified-live models remain.
        assert.deepEqual(
          plan
            .filter((entry) => entry.provider === "nvidia")
            .map((entry) => entry.model),
          ["deepseek-ai/deepseek-v4-pro", "minimaxai/minimax-m3", "moonshotai/kimi-k2.6"]
        );
        assert.equal(config.nvidiaImageModel, "moonshotai/kimi-k2.6");
      }
    );
  });

  it("builds the NVIDIA-first, OpenRouter-second free model plan", () => {
    withEnv(zeroBudgetEnv(), () => {
      const plan = buildLLMFallbackPlan(getTraeConfig());
      assert.deepEqual(
        plan.map((entry) => `${entry.provider}:${entry.model}`),
        [
          "nvidia:moonshotai/kimi-k2.6",
          "nvidia:z-ai/glm-5.1",
          "nvidia:deepseek-ai/deepseek-v4-flash",
          "openrouter:openai/gpt-oss-120b",
          "openrouter:nvidia/nemotron-3-ultra-550b-a55b:free",
          "openrouter:google/gemma-4-31b-it:free"
        ]
      );
      assert.deepEqual(new Set(plan.map((entry) => entry.provider)), new Set(["nvidia", "openrouter"]));
    });
  });

  it("retries a 429 with backoff before falling back to NVIDIA GLM 5.1", async () => {
    await withEnv(zeroBudgetEnv(), async () => {
      const requests: Array<{ url: string; model: string; authorization: string | null }> = [];
      const sleeps: number[] = [];

      const result = await callLLMWithFallback({
        messages: [{ role: "user", content: "score this" }],
        config: getTraeConfig(),
        validateContent: (content) => JSON.parse(content) as { ok: boolean },
        fetchFn: async (url, init) => {
          const body = JSON.parse(String(init?.body)) as { model: string };
          const headers = new Headers(init?.headers);
          requests.push({
            url: String(url),
            model: body.model,
            authorization: headers.get("authorization")
          });

          if (body.model === "moonshotai/kimi-k2.6") {
            return new Response("rate limited", { status: 429 });
          }

          return Response.json({
            choices: [{ message: { content: JSON.stringify({ ok: true }) } }]
          });
        },
        sleepFn: async (delayMs) => {
          sleeps.push(delayMs);
        }
      });

      assert.equal(result.provider, "nvidia");
      assert.equal(result.model, "z-ai/glm-5.1");
      assert.deepEqual(
        requests.map((request) => request.model),
        [
          "moonshotai/kimi-k2.6",
          "moonshotai/kimi-k2.6",
          "z-ai/glm-5.1"
        ]
      );
      assert.equal(requests.every((request) => request.url.endsWith("/chat/completions")), true);
      assert.equal(requests[0]?.authorization, "Bearer nvidia-key");
      assert.equal(sleeps.length, 1);
      assert.equal(result.callLogs[0]?.provider, "nvidia");
      assert.equal(result.callLogs[0]?.model, "moonshotai/kimi-k2.6");
      assert.equal(result.callLogs[0]?.retryCount, 0);
      assert.equal(result.callLogs[0]?.errorReason, "http_429");
      assert.equal(result.callLogs[1]?.retryCount, 1);
      assert.equal(result.callLogs[1]?.errorReason, "http_429");
      assert.equal(result.callLogs[2]?.errorReason, null);
      assert.match(result.callLogs[2]?.rawResponse ?? "", /choices/);
      assert.deepEqual(result.parsed, { ok: true });
    });
  });

  it("falls through all NVIDIA models on invalid JSON before trying OpenRouter", async () => {
    await withEnv(zeroBudgetEnv({ AI_MAX_RETRIES_PER_MODEL: "0" }), async () => {
      const models: string[] = [];

      const result = await callLLMWithFallback({
        messages: [{ role: "user", content: "score this" }],
        config: getTraeConfig(),
        validateContent: (content) => JSON.parse(content) as { ok: boolean },
        fetchFn: async (_url, init) => {
          const body = JSON.parse(String(init?.body)) as { model: string };
          models.push(body.model);
          const content = body.model === "openai/gpt-oss-120b" ? JSON.stringify({ ok: true }) : "not json";
          return Response.json({ choices: [{ message: { content } }] });
        },
        sleepFn: async () => undefined
      });

      assert.equal(result.provider, "openrouter");
      assert.equal(result.model, "openai/gpt-oss-120b");
      assert.deepEqual(models, [
        "moonshotai/kimi-k2.6",
        "z-ai/glm-5.1",
        "deepseek-ai/deepseek-v4-flash",
        "openai/gpt-oss-120b"
      ]);
      assert.deepEqual(
        result.callLogs.map((log) => log.errorReason),
        ["invalid_json", "invalid_json", "invalid_json", null]
      );
    });
  });

  it("requests max reasoning effort only for NVIDIA DeepSeek models", async () => {
    await withEnv(zeroBudgetEnv({ AI_MAX_RETRIES_PER_MODEL: "0" }), async () => {
      const requests: Array<{ model: string; reasoningEffort?: string }> = [];

      await callLLMWithFallback({
        messages: [{ role: "user", content: "score this" }],
        config: getTraeConfig(),
        validateContent: (content) => JSON.parse(content) as { ok: boolean },
        fetchFn: async (_url, init) => {
          const body = JSON.parse(String(init?.body)) as { model: string; reasoning_effort?: string };
          requests.push({ model: body.model, reasoningEffort: body.reasoning_effort });
          const content = body.model === "deepseek-ai/deepseek-v4-flash" ? JSON.stringify({ ok: true }) : "not json";
          return Response.json({ choices: [{ message: { content } }] });
        },
        sleepFn: async () => undefined
      });

      assert.deepEqual(requests, [
        { model: "moonshotai/kimi-k2.6", reasoningEffort: undefined },
        { model: "z-ai/glm-5.1", reasoningEffort: undefined },
        { model: "deepseek-ai/deepseek-v4-flash", reasoningEffort: "max" }
      ]);
    });
  });

  it("captures input and output token usage from model responses", async () => {
    await withEnv(zeroBudgetEnv(), async () => {
      const result = await callLLMWithFallback({
        messages: [{ role: "user", content: "score this" }],
        config: getTraeConfig(),
        validateContent: (content) => JSON.parse(content) as { ok: boolean },
        fetchFn: async () =>
          Response.json({
            choices: [{ message: { content: JSON.stringify({ ok: true }) } }],
            usage: {
              prompt_tokens: 321,
              completion_tokens: 45,
              total_tokens: 366
            }
          }),
        sleepFn: async () => undefined
      });

      assert.equal(result.callLogs[0]?.inputTokens, 321);
      assert.equal(result.callLogs[0]?.outputTokens, 45);
    });
  });

  it("paces consecutive model attempts by AI_RPM_LIMIT", async () => {
    await withEnv(zeroBudgetEnv({ AI_RPM_LIMIT: "40", AI_MAX_RETRIES_PER_MODEL: "0" }), async () => {
      const sleeps: number[] = [];
      const startedModels: string[] = [];

      const fetchFn: typeof fetch = async (_url, init) => {
        const body = JSON.parse(String(init?.body)) as { model: string };
        startedModels.push(body.model);
        return Response.json({ choices: [{ message: { content: JSON.stringify({ ok: true }) } }] });
      };

      const options = {
        messages: [{ role: "user" as const, content: "score this" }],
        config: getTraeConfig(),
        validateContent: (content: string) => JSON.parse(content) as { ok: boolean },
        fetchFn,
        sleepFn: async (delayMs: number) => {
          sleeps.push(delayMs);
        }
      };

      await callLLMWithFallback(options);
      await callLLMWithFallback(options);

      assert.deepEqual(startedModels, ["moonshotai/kimi-k2.6", "moonshotai/kimi-k2.6"]);
      assert.equal(sleeps.length, 1);
      assert.ok(sleeps[0] >= 1400 && sleeps[0] <= 1500, `expected about 1500ms, got ${sleeps[0]}`);
    });
  });

  it("treats an HTTP 200 empty-choices reply as a retryable rate limit", async () => {
    await withEnv(zeroBudgetEnv({ AI_MAX_RETRIES_PER_MODEL: "1" }), async () => {
      let primaryCalls = 0;

      const result = await callLLMWithFallback({
        messages: [{ role: "user", content: "score this" }],
        config: getTraeConfig(),
        validateContent: (content) => JSON.parse(content) as { ok: boolean },
        fetchFn: async (_url, init) => {
          const body = JSON.parse(String(init?.body)) as { model: string };
          if (body.model === "moonshotai/kimi-k2.6") {
            primaryCalls += 1;
            // NVIDIA soft-throttle shape: HTTP 200 with no choices and null usage.
            return Response.json({ id: "", choices: [], created: 0, model: "", usage: null });
          }
          return Response.json({ choices: [{ message: { content: JSON.stringify({ ok: true }) } }] });
        },
        sleepFn: async () => undefined
      });

      // Primary was retried once (rate-limited) before falling through to GLM.
      assert.equal(primaryCalls, 2);
      assert.equal(result.provider, "nvidia");
      assert.equal(result.model, "z-ai/glm-5.1");
      assert.deepEqual(
        result.callLogs.slice(0, 2).map((log) => log.errorReason),
        ["rate_limited", "rate_limited"]
      );
      assert.deepEqual(result.parsed, { ok: true });
    });
  });

  it("builds the vision plan friend-first, then nvidia, from the image + fallback models", () => {
    withEnv(zeroBudgetEnv(), () => {
      const plan = buildVisionLLMFallbackPlan(getTraeConfig());
      assert.deepEqual(
        plan.map((entry) => `${entry.provider}:${entry.model}`),
        [
          "friend:moonshotai/kimi-k2.6",
          "friend:minimaxai/minimax-m3",
          "nvidia:moonshotai/kimi-k2.6",
          "nvidia:minimaxai/minimax-m3"
        ]
      );
    });
  });

  it("deduplicates the vision plan per provider when a model and its fallback are the same", () => {
    withEnv(
      zeroBudgetEnv({
        FRIEND_IMAGE_MODEL: "moonshotai/kimi-k2.6",
        FRIEND_IMAGE_FALLBACK_MODEL: "moonshotai/kimi-k2.6",
        NVIDIA_IMAGE_FALLBACK_MODEL: "moonshotai/kimi-k2.6"
      }),
      () => {
        const plan = buildVisionLLMFallbackPlan(getTraeConfig());
        // Dedup is keyed by provider:model, so the same model on friend and nvidia is kept once each.
        assert.deepEqual(
          plan.map((entry) => `${entry.provider}:${entry.model}`),
          ["friend:moonshotai/kimi-k2.6", "nvidia:moonshotai/kimi-k2.6"]
        );
      }
    );
  });

  it("sends multimodal image_url content and omits response_format for vision calls", async () => {
    await withEnv(zeroBudgetEnv(), async () => {
      const requests: Array<{ model: string; responseFormat: unknown }> = [];

      const result = await callVisionLLMWithFallback({
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: "describe this" },
              { type: "image_url", image_url: { url: "https://example.test/a.png" } }
            ]
          }
        ],
        config: getTraeConfig(),
        fetchFn: async (_url, init) => {
          const body = JSON.parse(String(init?.body)) as { model: string; response_format?: unknown };
          requests.push({ model: body.model, responseFormat: body.response_format });
          return Response.json({ choices: [{ message: { content: "a description" } }] });
        },
        sleepFn: async () => undefined
      });

      assert.equal(requests[0]?.model, "moonshotai/kimi-k2.6");
      assert.equal(requests[0]?.responseFormat, undefined);
      assert.equal(result.content, "a description");
    });
  });
});
