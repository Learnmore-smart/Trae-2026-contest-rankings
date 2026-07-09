import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getTraeConfig } from "../lib/trae/config.ts";
import {
  buildLLMFallbackPlan,
  buildVisionLLMFallbackPlan,
  callLLMWithFallback,
  callVisionLLMWithFallback,
  formatLLMCallFailureSummary,
  LLMFallbackError
} from "../lib/trae/llm.ts";

type EnvPatch = Record<string, string | undefined>;

const aiEnvKeys = [
  "TRAE_FRIEND_API",
  "TRAE_FRIEND_BASE_URL",
  "FRIEND_PRIMARY_MODEL",
  "FRIEND_FALLBACK_MODELS",
  "FRIEND_IMAGE_MODEL",
  "FRIEND_IMAGE_FALLBACK_MODEL",
  "NVIDIA_API_KEY",
  "NVIDIA_API_KEY_2",
  "NVIDIA_BASE_URL",
  "NVIDIA_PRIMARY_MODEL",
  "NVIDIA_FALLBACK_MODELS",
  "NVIDIA_IMAGE_MODEL",
  "NVIDIA_IMAGE_FALLBACK_MODEL",
  "AI_PROVIDER_ORDER",
  "AI_ZERO_BUDGET_ONLY",
  "AI_RPM_LIMIT",
  "AI_MAX_RETRIES_PER_MODEL",
  "AI_MAX_RATE_LIMIT_RETRIES",
  "AI_MAX_RATE_LIMIT_WAIT_MS",
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
    FRIEND_PRIMARY_MODEL: "minimaxai/minimax-m3",
    FRIEND_FALLBACK_MODELS: "google/gemma-4-31b-it,deepseek-ai/deepseek-v4-pro,z-ai/glm-5.2",
    FRIEND_IMAGE_MODEL: "minimaxai/minimax-m3",
    FRIEND_IMAGE_FALLBACK_MODEL: "google/gemma-4-31b-it",
    NVIDIA_API_KEY: "nvidia-key",
    NVIDIA_BASE_URL: "https://integrate.api.nvidia.com/v1",
    NVIDIA_PRIMARY_MODEL: "minimaxai/minimax-m3",
    NVIDIA_FALLBACK_MODELS: "google/gemma-4-31b-it,deepseek-ai/deepseek-v4-pro,z-ai/glm-5.2",
    NVIDIA_IMAGE_MODEL: "minimaxai/minimax-m3",
    NVIDIA_IMAGE_FALLBACK_MODEL: "google/gemma-4-31b-it",
    AI_PROVIDER_ORDER: "friend,nvidia",
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

  it("defaults the per-call rate-limit wall-clock ceiling to 90s and honors the env override", () => {
    withEnv(zeroBudgetEnv({ AI_MAX_RATE_LIMIT_WAIT_MS: undefined }), () => {
      assert.equal(getTraeConfig().aiMaxRateLimitWaitMs, 90_000);
    });
    withEnv(zeroBudgetEnv({ AI_MAX_RATE_LIMIT_WAIT_MS: "0" }), () => {
      assert.equal(getTraeConfig().aiMaxRateLimitWaitMs, 0);
    });
  });

  it("defaults NVIDIA text order to MiniMax M3, Gemma 4 31B, DeepSeek V4 Pro, then GLM 5.2", () => {
    withEnv(
      zeroBudgetEnv({
        NVIDIA_PRIMARY_MODEL: undefined,
        NVIDIA_FALLBACK_MODELS: undefined
      }),
      () => {
        const config = getTraeConfig();
        const plan = buildLLMFallbackPlan(config);
        // MiniMax M3 is the primary text model; Gemma 4 31B is the first fallback.
        // DeepSeek V4 Flash (hangs) and GLM 5.1 (410 EOL 2026-07-02) are intentionally
        // excluded from the defaults; kimi-k2.6 was removed upstream on 2026-07-08.
        assert.deepEqual(
          plan
            .filter((entry) => entry.provider === "nvidia")
            .map((entry) => entry.model),
          [
            "minimaxai/minimax-m3",
            "google/gemma-4-31b-it",
            "deepseek-ai/deepseek-v4-pro",
            "z-ai/glm-5.2"
          ]
        );
        assert.equal(config.nvidiaImageModel, "minimaxai/minimax-m3");
      }
    );
  });

  it("builds the Friend-first, NVIDIA-second free model plan", () => {
    withEnv(zeroBudgetEnv(), () => {
      const plan = buildLLMFallbackPlan(getTraeConfig());
      assert.deepEqual(
        plan.map((entry) => `${entry.provider}:${entry.model}`),
        [
          "friend:minimaxai/minimax-m3",
          "friend:google/gemma-4-31b-it",
          "friend:deepseek-ai/deepseek-v4-pro",
          "friend:z-ai/glm-5.2",
          "nvidia:minimaxai/minimax-m3",
          "nvidia:google/gemma-4-31b-it",
          "nvidia:deepseek-ai/deepseek-v4-pro",
          "nvidia:z-ai/glm-5.2"
        ]
      );
      assert.deepEqual(new Set(plan.map((entry) => entry.provider)), new Set(["friend", "nvidia"]));
    });
  });

  it("ignores stale unsupported provider-order entries", () => {
    withEnv(zeroBudgetEnv({ AI_PROVIDER_ORDER: "legacy,friend,nvidia" }), () => {
      const plan = buildLLMFallbackPlan(getTraeConfig());
      assert.deepEqual([...new Set(plan.map((entry) => entry.provider))], ["friend", "nvidia"]);
    });
  });

  it("uses NVIDIA capacity when Friend is rate-limited before waiting on Friend", async () => {
    await withEnv(zeroBudgetEnv(), async () => {
      const requests: Array<{ provider: string; model: string; authorization: string | null }> = [];
      const sleeps: number[] = [];
      let friendPrimaryCalls = 0;

      const result = await callLLMWithFallback({
        messages: [{ role: "user", content: "score this" }],
        config: getTraeConfig(),
        validateContent: (content) => JSON.parse(content) as { ok: boolean },
        fetchFn: async (url, init) => {
          const body = JSON.parse(String(init?.body)) as { model: string };
          const provider = String(url).startsWith("https://friend.example") ? "friend" : "nvidia";
          const headers = new Headers(init?.headers);
          requests.push({
            provider,
            model: body.model,
            authorization: headers.get("authorization")
          });

          if (provider === "friend" && body.model === "minimaxai/minimax-m3") {
            friendPrimaryCalls += 1;
            // Two 429s in a row, then the limit clears — the client must wait it out.
            if (friendPrimaryCalls === 1) return new Response("rate limited", { status: 429 });
          }

          return Response.json({
            choices: [{ message: { content: JSON.stringify({ ok: true }) } }]
          });
        },
        sleepFn: async (delayMs) => {
          sleeps.push(delayMs);
        }
      });

      // Friend has a balance/quota lane; when it throttles, direct NVIDIA keys should
      // be used before the client waits on Friend to clear.
      assert.equal(result.provider, "nvidia");
      assert.equal(result.model, "minimaxai/minimax-m3");
      assert.deepEqual(
        requests.map((request) => `${request.provider}:${request.model}`),
        ["friend:minimaxai/minimax-m3", "nvidia:minimaxai/minimax-m3"]
      );
      assert.deepEqual(
        requests.map((request) => request.authorization),
        ["Bearer friend-key", "Bearer nvidia-key"]
      );
      assert.equal(sleeps.length, 0);
      assert.deepEqual(
        result.callLogs.map((log) => log.errorReason),
        ["http_429", null]
      );
      assert.deepEqual(
        result.callLogs.map((log) => log.retryCount),
        [0, 0]
      );
      assert.match(result.callLogs[1]?.rawResponse ?? "", /choices/);
      assert.deepEqual(result.parsed, { ok: true });
    });
  });

  it("waits and retries the full free plan only after Friend and NVIDIA are both saturated", async () => {
    await withEnv(zeroBudgetEnv(), async () => {
      const attempts: string[] = [];
      const sleeps: number[] = [];

      const result = await callLLMWithFallback({
        messages: [{ role: "user", content: "score this" }],
        config: getTraeConfig(),
        validateContent: (content) => JSON.parse(content) as { ok: boolean },
        plan: [
          {
            provider: "friend",
            model: "z-ai/glm-5.2",
            baseUrl: "https://friend.example/v1",
            apiKeys: ["friend-key"]
          },
          {
            provider: "nvidia",
            model: "z-ai/glm-5.2",
            baseUrl: "https://integrate.api.nvidia.com/v1",
            apiKeys: ["nvidia-key"]
          }
        ],
        fetchFn: async (url) => {
          const provider = String(url).startsWith("https://friend.example") ? "friend" : "nvidia";
          attempts.push(provider);
          if (attempts.length <= 2) return new Response("rate limited", { status: 429 });
          return Response.json({ choices: [{ message: { content: JSON.stringify({ ok: true }) } }] });
        },
        sleepFn: async (delayMs) => {
          sleeps.push(delayMs);
        }
      });

      assert.equal(result.provider, "friend");
      assert.deepEqual(attempts, ["friend", "nvidia", "friend"]);
      assert.deepEqual(sleeps, [2000]);
      assert.deepEqual(
        result.callLogs.map((log) => log.errorReason),
        ["http_429", "http_429", null]
      );
    });
  });

  it("honors AI_MAX_RATE_LIMIT_RETRIES as a cap on full-plan wait cycles", async () => {
    await withEnv(
      zeroBudgetEnv({ AI_PROVIDER_ORDER: "nvidia", AI_MAX_RATE_LIMIT_RETRIES: "2" }),
      async () => {
        const models: string[] = [];

        await assert.rejects(
          callLLMWithFallback({
            messages: [{ role: "user", content: "score this" }],
            config: getTraeConfig(),
            validateContent: (content) => JSON.parse(content) as { ok: boolean },
            plan: [
              {
                provider: "nvidia",
                model: "z-ai/glm-5.2",
                baseUrl: "https://integrate.api.nvidia.com/v1",
                apiKeys: ["nvidia-key"]
              }
            ],
            fetchFn: async (_url, init) => {
              const body = JSON.parse(String(init?.body)) as { model: string };
              models.push(body.model);
              return new Response("rate limited", { status: 429 });
            },
            sleepFn: async () => undefined
          }),
          (error) => {
            assert.ok(error instanceof LLMFallbackError);
            assert.equal(error.callLogs.length, 3);
            return true;
          }
        );

        // Initial full-plan pass + 2 capped waits = 3 attempts, then fail cleanly.
        assert.equal(models.filter((model) => model === "z-ai/glm-5.2").length, 3);
      }
    );
  });

  it("bounds unlimited rate-limit retries by a wall-clock deadline so one call can't hang the cron", async () => {
    await withEnv(
      zeroBudgetEnv({
        AI_PROVIDER_ORDER: "nvidia",
        AI_MAX_RATE_LIMIT_RETRIES: "0",
        AI_MAX_RATE_LIMIT_WAIT_MS: "90000"
      }),
      async () => {
        // Virtual clock advanced only by sleepFn, so the deadline is deterministic and the test
        // never waits real time. Without the deadline this loop would spin forever (429 every pass).
        let virtualNow = 1_000_000;
        let attempts = 0;

        await assert.rejects(
          callLLMWithFallback({
            messages: [{ role: "user", content: "score this" }],
            config: getTraeConfig(),
            validateContent: (content) => JSON.parse(content) as { ok: boolean },
            plan: [
              {
                provider: "nvidia",
                model: "z-ai/glm-5.2",
                baseUrl: "https://integrate.api.nvidia.com/v1",
                apiKeys: ["nvidia-key"]
              }
            ],
            fetchFn: async () => {
              attempts += 1;
              return new Response("rate limited", { status: 429 });
            },
            sleepFn: async (delayMs) => {
              virtualNow += delayMs;
            },
            nowFn: () => virtualNow
          }),
          (error) => {
            assert.ok(error instanceof LLMFallbackError);
            assert.ok(error.callLogs.every((log) => log.errorReason === "http_429"));
            return true;
          }
        );

        // The wall-clock ceiling (not the retry count, which is unlimited here) stops the loop
        // after a small, bounded number of passes — proving it terminates instead of hanging.
        assert.ok(attempts >= 2 && attempts <= 20, `expected a bounded attempt count, got ${attempts}`);
      }
    );
  });

  it("keeps riding out rate limits when the wall-clock ceiling is disabled (0)", async () => {
    await withEnv(
      zeroBudgetEnv({
        AI_PROVIDER_ORDER: "nvidia",
        AI_MAX_RATE_LIMIT_RETRIES: "3",
        AI_MAX_RATE_LIMIT_WAIT_MS: "0"
      }),
      async () => {
        let attempts = 0;

        await assert.rejects(
          callLLMWithFallback({
            messages: [{ role: "user", content: "score this" }],
            config: getTraeConfig(),
            validateContent: (content) => JSON.parse(content) as { ok: boolean },
            plan: [
              {
                provider: "nvidia",
                model: "z-ai/glm-5.2",
                baseUrl: "https://integrate.api.nvidia.com/v1",
                apiKeys: ["nvidia-key"]
              }
            ],
            fetchFn: async () => {
              attempts += 1;
              return new Response("rate limited", { status: 429 });
            },
            sleepFn: async () => undefined
          }),
          (error) => {
            assert.ok(error instanceof LLMFallbackError);
            return true;
          }
        );

        // Ceiling disabled → only the retry-count cap (3) stops it: initial pass + 3 waits = 4.
        assert.equal(attempts, 4);
      }
    );
  });

  it("falls through to NVIDIA when Friend reports a balance-style client error", async () => {
    await withEnv(zeroBudgetEnv(), async () => {
      const attempts: string[] = [];

      const result = await callLLMWithFallback({
        messages: [{ role: "user", content: "score this" }],
        config: getTraeConfig(),
        validateContent: (content) => JSON.parse(content) as { ok: boolean },
        plan: [
          {
            provider: "friend",
            model: "z-ai/glm-5.2",
            baseUrl: "https://friend.example/v1",
            apiKeys: ["friend-key"]
          },
          {
            provider: "nvidia",
            model: "z-ai/glm-5.2",
            baseUrl: "https://integrate.api.nvidia.com/v1",
            apiKeys: ["nvidia-key"]
          }
        ],
        fetchFn: async (url) => {
          const provider = String(url).startsWith("https://friend.example") ? "friend" : "nvidia";
          attempts.push(provider);
          if (provider === "friend") return new Response("insufficient balance", { status: 402 });
          return Response.json({ choices: [{ message: { content: JSON.stringify({ ok: true }) } }] });
        },
        sleepFn: async () => undefined
      });

      assert.equal(result.provider, "nvidia");
      assert.deepEqual(attempts, ["friend", "nvidia"]);
      assert.deepEqual(
        result.callLogs.map((log) => log.errorReason),
        ["http_402", null]
      );
    });
  });

  it("falls through all Friend models on invalid JSON before trying NVIDIA", async () => {
    await withEnv(zeroBudgetEnv({ AI_MAX_RETRIES_PER_MODEL: "0" }), async () => {
      const attempts: string[] = [];

      const result = await callLLMWithFallback({
        messages: [{ role: "user", content: "score this" }],
        config: getTraeConfig(),
        validateContent: (content) => JSON.parse(content) as { ok: boolean },
        fetchFn: async (url, init) => {
          const body = JSON.parse(String(init?.body)) as { model: string };
          const provider = String(url).startsWith("https://friend.example") ? "friend" : "nvidia";
          attempts.push(`${provider}:${body.model}`);
          const content = provider === "nvidia" && body.model === "minimaxai/minimax-m3" ? JSON.stringify({ ok: true }) : "not json";
          return Response.json({ choices: [{ message: { content } }] });
        },
        sleepFn: async () => undefined
      });

      assert.equal(result.provider, "nvidia");
      assert.equal(result.model, "minimaxai/minimax-m3");
      assert.deepEqual(attempts, [
        "friend:minimaxai/minimax-m3",
        "friend:google/gemma-4-31b-it",
        "friend:deepseek-ai/deepseek-v4-pro",
        "friend:z-ai/glm-5.2",
        "nvidia:minimaxai/minimax-m3"
      ]);
      assert.deepEqual(
        result.callLogs.map((log) => log.errorReason),
        ["invalid_json", "invalid_json", "invalid_json", "invalid_json", null]
      );
    });
  });

  it("applies NVIDIA-specific reasoning effort and thinking toggles only on the nvidia provider", async () => {
    await withEnv(zeroBudgetEnv({ AI_MAX_RETRIES_PER_MODEL: "0" }), async () => {
      const requests: Array<{ model: string; reasoningEffort?: string; enableThinking?: boolean }> = [];

      await callLLMWithFallback({
        messages: [{ role: "user", content: "score this" }],
        config: getTraeConfig(),
        validateContent: (content) => JSON.parse(content) as { ok: boolean },
        fetchFn: async (_url, init) => {
          const body = JSON.parse(String(init?.body)) as {
            model: string;
            reasoning_effort?: string;
            chat_template_kwargs?: { enable_thinking?: boolean };
          };
          requests.push({
            model: body.model,
            reasoningEffort: body.reasoning_effort,
            enableThinking: body.chat_template_kwargs?.enable_thinking
          });
          const provider = new Headers(init?.headers).get("authorization") === "Bearer nvidia-key" ? "nvidia" : "friend";
          const content = provider === "nvidia" && body.model === "deepseek-ai/deepseek-v4-pro" ? JSON.stringify({ ok: true }) : "not json";
          return Response.json({ choices: [{ message: { content } }] });
        },
        sleepFn: async () => undefined
      });

      assert.deepEqual(requests, [
        { model: "minimaxai/minimax-m3", reasoningEffort: undefined, enableThinking: undefined },
        { model: "google/gemma-4-31b-it", reasoningEffort: undefined, enableThinking: undefined },
        { model: "deepseek-ai/deepseek-v4-pro", reasoningEffort: undefined, enableThinking: undefined },
        { model: "z-ai/glm-5.2", reasoningEffort: undefined, enableThinking: undefined },
        { model: "minimaxai/minimax-m3", reasoningEffort: undefined, enableThinking: undefined },
        { model: "google/gemma-4-31b-it", reasoningEffort: undefined, enableThinking: true },
        { model: "deepseek-ai/deepseek-v4-pro", reasoningEffort: "max", enableThinking: undefined }
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

  it("records sanitized fetch error details on network failures", async () => {
    await withEnv(zeroBudgetEnv(), async () => {
      await assert.rejects(
        callLLMWithFallback({
          messages: [{ role: "user", content: "score this" }],
          config: { ...getTraeConfig(), aiMaxRetriesPerModel: 0 },
          plan: [
            {
              provider: "friend",
              model: "z-ai/glm-5.2",
              baseUrl: "http://127.0.0.1:8889/v1",
              apiKeys: ["friend-key"]
            }
          ],
          fetchFn: async () => {
            const cause = new Error("connect ECONNREFUSED 127.0.0.1:8889") as Error & { code?: string };
            cause.code = "ECONNREFUSED";
            const error = new TypeError("fetch failed") as TypeError & { cause?: unknown };
            error.cause = cause;
            throw error;
          },
          sleepFn: async () => undefined
        }),
        (error) => {
          assert.ok(error instanceof LLMFallbackError);
          const log = error.callLogs[0];
          assert.equal(log?.provider, "friend");
          assert.equal(log?.model, "z-ai/glm-5.2");
          assert.equal(log?.errorReason, "network_error");
          assert.match(log?.errorDetails ?? "", /fetch failed/);
          assert.match(log?.errorDetails ?? "", /ECONNREFUSED/);
          return true;
        }
      );
    });
  });

  it("formats compact LLM failure summaries for CLI diagnostics", () => {
    const summary = formatLLMCallFailureSummary([
      {
        provider: "friend",
        model: "z-ai/glm-5.2",
        latencyMs: 12,
        retryCount: 0,
        errorReason: "network_error",
        errorDetails: "fetch failed; ECONNREFUSED connect ECONNREFUSED 127.0.0.1:8889",
        inputTokens: 0,
        outputTokens: 0,
        rawResponse: ""
      },
      {
        provider: "nvidia",
        model: "deepseek-ai/deepseek-v4-pro",
        latencyMs: 34,
        retryCount: 1,
        errorReason: "http_401",
        inputTokens: 0,
        outputTokens: 0,
        rawResponse: "{\"error\":{\"message\":\"invalid api key\"}}"
      }
    ]);

    assert.match(summary, /friend:z-ai\/glm-5\.2 retry=0 network_error/);
    assert.match(summary, /fetch failed/);
    assert.match(summary, /nvidia:deepseek-ai\/deepseek-v4-pro retry=1 http_401/);
    assert.match(summary, /invalid api key/);
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

      assert.deepEqual(startedModels, ["minimaxai/minimax-m3", "minimaxai/minimax-m3"]);
      assert.equal(sleeps.length, 1);
      assert.ok(sleeps[0] >= 1400 && sleeps[0] <= 1500, `expected about 1500ms, got ${sleeps[0]}`);
    });
  });

  it("treats an HTTP 200 empty-choices reply as a rate limit and retries the same model until it clears", async () => {
    await withEnv(zeroBudgetEnv(), async () => {
      let primaryCalls = 0;

      const result = await callLLMWithFallback({
        messages: [{ role: "user", content: "score this" }],
        config: getTraeConfig(),
        validateContent: (content) => JSON.parse(content) as { ok: boolean },
        fetchFn: async (_url, init) => {
          const body = JSON.parse(String(init?.body)) as { model: string };
          if (body.model === "minimaxai/minimax-m3") {
            primaryCalls += 1;
            // NVIDIA soft-throttle shape: HTTP 200 with no choices and null usage.
            if (primaryCalls <= 2) return Response.json({ id: "", choices: [], created: 0, model: "", usage: null });
          }
          return Response.json({ choices: [{ message: { content: JSON.stringify({ ok: true }) } }] });
        },
        sleepFn: async () => undefined
      });

      // Two soft-429s, then success on the SAME model — never falls through to DeepSeek.
      assert.equal(primaryCalls, 3);
      assert.equal(result.provider, "friend");
      assert.equal(result.model, "minimaxai/minimax-m3");
      assert.deepEqual(
        result.callLogs.map((log) => log.errorReason),
        ["rate_limited", "rate_limited", null]
      );
      assert.deepEqual(result.parsed, { ok: true });
    });
  });

  it("round-robins across multiple NVIDIA keys so each carries its own rpm budget", async () => {
    await withEnv(
      zeroBudgetEnv({
        AI_PROVIDER_ORDER: "nvidia",
        AI_RPM_LIMIT: "40",
        NVIDIA_API_KEY: "nvidia-key-1",
        NVIDIA_API_KEY_2: "nvidia-key-2"
      }),
      async () => {
        const config = getTraeConfig();
        assert.deepEqual(config.nvidiaApiKeys, ["nvidia-key-1", "nvidia-key-2"]);

        const auths: string[] = [];
        const options = {
          messages: [{ role: "user" as const, content: "score this" }],
          config,
          validateContent: (content: string) => JSON.parse(content) as { ok: boolean },
          fetchFn: (async (_url: string | URL, init?: RequestInit) => {
            auths.push(new Headers(init?.headers).get("authorization") ?? "");
            return Response.json({ choices: [{ message: { content: JSON.stringify({ ok: true }) } }] });
          }) as unknown as typeof fetch,
          sleepFn: async () => undefined
        };

        await callLLMWithFallback(options);
        await callLLMWithFallback(options);

        // Consecutive calls land on different keys (round-robin), and both keys are used.
        assert.equal(new Set(auths).size, 2);
        assert.ok(auths.includes("Bearer nvidia-key-1"));
        assert.ok(auths.includes("Bearer nvidia-key-2"));
      }
    );
  });

  it("builds the vision plan friend-first, then nvidia, from the image + fallback models", () => {
    withEnv(zeroBudgetEnv(), () => {
      const plan = buildVisionLLMFallbackPlan(getTraeConfig());
      assert.deepEqual(
        plan.map((entry) => `${entry.provider}:${entry.model}`),
        [
          "friend:minimaxai/minimax-m3",
          "friend:google/gemma-4-31b-it",
          "nvidia:minimaxai/minimax-m3",
          "nvidia:google/gemma-4-31b-it"
        ]
      );
    });
  });

  it("deduplicates the vision plan per provider when a model and its fallback are the same", () => {
    withEnv(
      zeroBudgetEnv({
        FRIEND_IMAGE_MODEL: "minimaxai/minimax-m3",
        FRIEND_IMAGE_FALLBACK_MODEL: "minimaxai/minimax-m3",
        NVIDIA_IMAGE_FALLBACK_MODEL: "minimaxai/minimax-m3"
      }),
      () => {
        const plan = buildVisionLLMFallbackPlan(getTraeConfig());
        // Dedup is keyed by provider:model, so the same model on friend and nvidia is kept once each.
        assert.deepEqual(
          plan.map((entry) => `${entry.provider}:${entry.model}`),
          ["friend:minimaxai/minimax-m3", "nvidia:minimaxai/minimax-m3"]
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

      assert.equal(requests[0]?.model, "minimaxai/minimax-m3");
      assert.equal(requests[0]?.responseFormat, undefined);
      assert.equal(result.content, "a description");
    });
  });
});
