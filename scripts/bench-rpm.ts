import nextEnv from "@next/env";
import { getTraeConfig } from "../lib/trae/config.ts";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

const config = getTraeConfig();

// A representative judge-sized user prompt (kept moderate to limit load on the
// shared friend gateway) that still forces strict-JSON output like the real path.
const SAMPLE_PROMPT = `你是评分员。请阅读下面这段帖子材料并给出结构化评分。
标题：AI 驱动的智能助手 Demo
作者：tester
赛道：应用赛道
正文：这是一个使用 TRAE 构建的示例项目，包含前端界面、后端 API 和一个可交互的 Demo 页面。项目实现了用户登录、数据看板、AI 对话等核心功能，并提供了三张开发截图与两个 Session ID 作为过程证据。${"补充说明。".repeat(120)}
只返回严格 JSON：{"totalScore":0-100,"summary":"一句话","ok":true}`;

interface AttemptResult {
  ok: boolean;
  latencyMs: number;
  reason: string | null;
  outputTokens: number;
}

async function callOnce(model: string): Promise<AttemptResult> {
  const startedAt = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.aiRequestTimeoutMs);
  try {
    const res = await fetch(`${config.friendBaseUrl.replace(/\/+$/, "")}/chat/completions`, {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${config.friendApiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: "You return strict JSON only." },
          { role: "user", content: SAMPLE_PROMPT }
        ],
        temperature: 0.2,
        response_format: { type: "json_object" }
      })
    });
    const text = await res.text();
    const latencyMs = Date.now() - startedAt;
    if (!res.ok) return { ok: false, latencyMs, reason: `http_${res.status}`, outputTokens: 0 };
    let json: any;
    try {
      json = JSON.parse(text);
    } catch {
      return { ok: false, latencyMs, reason: "invalid_response", outputTokens: 0 };
    }
    const content = json?.choices?.[0]?.message?.content;
    if (!content) {
      const empty = Array.isArray(json?.choices) && json.choices.length === 0;
      return { ok: false, latencyMs, reason: empty ? "rate_limited(empty_choices)" : "no_content", outputTokens: 0 };
    }
    return { ok: true, latencyMs, reason: null, outputTokens: json?.usage?.completion_tokens ?? 0 };
  } catch (error) {
    const latencyMs = Date.now() - startedAt;
    const reason = error instanceof Error && error.name === "AbortError" ? "timeout" : "network_error";
    return { ok: false, latencyMs, reason, outputTokens: 0 };
  } finally {
    clearTimeout(timeout);
  }
}

function pct(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[idx];
}

function summarize(label: string, results: AttemptResult[], wallMs: number): void {
  const ok = results.filter((r) => r.ok);
  const lat = ok.map((r) => r.latencyMs);
  const failReasons = new Map<string, number>();
  for (const r of results.filter((r) => !r.ok)) {
    failReasons.set(r.reason ?? "unknown", (failReasons.get(r.reason ?? "unknown") ?? 0) + 1);
  }
  const okThroughputRpm = wallMs > 0 ? (ok.length / (wallMs / 60000)) : 0;
  console.log(
    `[${label}] n=${results.length} ok=${ok.length} fail=${results.length - ok.length} ` +
    `wall=${(wallMs / 1000).toFixed(1)}s ` +
    `lat(ms) min=${lat.length ? Math.min(...lat) : 0} med=${pct(lat, 50)} p95=${pct(lat, 95)} max=${lat.length ? Math.max(...lat) : 0} ` +
    `effRPM=${okThroughputRpm.toFixed(1)}` +
    (failReasons.size ? ` fails={${[...failReasons].map(([k, v]) => `${k}:${v}`).join(",")}}` : "")
  );
}

async function latencyProbe(model: string, n: number): Promise<number> {
  const results: AttemptResult[] = [];
  const start = Date.now();
  for (let i = 0; i < n; i += 1) {
    results.push(await callOnce(model));
  }
  summarize(`latency ${model}`, results, Date.now() - start);
  const okLat = results.filter((r) => r.ok).map((r) => r.latencyMs);
  return pct(okLat, 50) || 0;
}

async function burst(model: string, concurrency: number): Promise<AttemptResult[]> {
  const start = Date.now();
  const results = await Promise.all(Array.from({ length: concurrency }, () => callOnce(model)));
  summarize(`burst c=${concurrency} ${model}`, results, Date.now() - start);
  return results;
}

async function main(): Promise<void> {
  const model = config.friendPrimaryModel;
  console.log(`Friend gateway: ${config.friendBaseUrl}`);
  console.log(`Primary model: ${model} | fallbacks: ${config.friendFallbackModels.join(", ")}`);
  console.log(`Current AI_RPM_LIMIT=${config.aiRpmLimit} TRAE_JUDGE_CONCURRENCY=${config.judgeConcurrency}`);
  console.log("---");

  // 1) Per-model single-call latency (median of a few sequential calls).
  const medLatency = await latencyProbe(model, 3);
  for (const fb of config.friendFallbackModels) {
    await latencyProbe(fb, 2);
  }
  console.log("---");

  // 2) Concurrency ramp on the primary model. Stop escalating once the gateway
  //    starts failing (error rate > 15%) so we don't hammer a struggling backend.
  const levels = [8, 16, 24, 32, 48];
  let lastGoodConcurrency = 1;
  let lastGoodMedLatency = medLatency;
  for (const c of levels) {
    const results = await burst(model, c);
    const okCount = results.filter((r) => r.ok).length;
    const errorRate = 1 - okCount / results.length;
    if (okCount > 0) {
      lastGoodMedLatency = pct(results.filter((r) => r.ok).map((r) => r.latencyMs), 50);
    }
    if (errorRate > 0.15) {
      console.log(`>> error rate ${(errorRate * 100).toFixed(0)}% at concurrency ${c}; stopping ramp.`);
      break;
    }
    lastGoodConcurrency = c;
  }
  console.log("---");

  // 3) Recommendation. Throughput ≈ concurrency / latency. Apply a safety margin.
  const latSec = (lastGoodMedLatency || medLatency || 18000) / 1000;
  const sustainedRpm = lastGoodConcurrency / latSec * 60;
  const recommendedRpm = Math.floor(sustainedRpm * 0.8);
  console.log(
    `RESULT: sustained concurrency=${lastGoodConcurrency} medLatency=${latSec.toFixed(1)}s ` +
    `=> raw throughput≈${sustainedRpm.toFixed(0)} RPM, recommended AI_RPM_LIMIT≈${recommendedRpm}`
  );
}

main()
  .then(() => console.log("bench done"))
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  });
