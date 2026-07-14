import nextEnv from "@next/env";
import { getTraeConfig } from "../lib/trae/config.ts";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

const config = getTraeConfig();

type Target = { name: string; baseUrl: string; key: string | null; model: string };

const targets: Target[] = [
  { name: "nvidia/glm-5.2", baseUrl: config.nvidiaBaseUrl, key: config.nvidiaApiKeys[0] ?? null, model: "z-ai/glm-5.2" },
  { name: "nvidia/gemma", baseUrl: config.nvidiaBaseUrl, key: config.nvidiaApiKeys[0] ?? null, model: "google/gemma-4-31b-it" },
  { name: "friend/nemotron", baseUrl: config.friendBaseUrl, key: config.friendApiKey, model: "nvidia/nemotron-3-ultra-550b-a55b" },
  { name: "friend/deepseek-v4-pro", baseUrl: config.friendBaseUrl, key: config.friendApiKey, model: "deepseek-ai/deepseek-v4-pro" },
  { name: "friend/kimi", baseUrl: config.friendBaseUrl, key: config.friendApiKey, model: "moonshotai/kimi-k2.6" },
  { name: "friend/gpt-oss-120b", baseUrl: config.friendBaseUrl, key: config.friendApiKey, model: "openai/gpt-oss-120b" },
  { name: "friend/DeepSeek-V3.2", baseUrl: config.friendBaseUrl, key: config.friendApiKey, model: "deepseek-ai/DeepSeek-V3.2" }
];

async function ping(t: Target): Promise<void> {
  const started = Date.now();
  if (!t.key) {
    console.log(`${t.name}: NO KEY`);
    return;
  }
  try {
    const res = await fetch(`${t.baseUrl.replace(/\/+$/, "")}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${t.key}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: t.model,
        messages: [{ role: "user", content: 'Return {"ok":true} only.' }],
        temperature: 0,
        response_format: { type: "json_object" },
        max_tokens: 32
      }),
      signal: AbortSignal.timeout(45_000)
    });
    const text = await res.text();
    const ms = Date.now() - started;
    if (!res.ok) {
      console.log(`${t.name}: HTTP ${res.status} in ${ms}ms — ${text.slice(0, 180)}`);
      return;
    }
    let content = "";
    try {
      content = JSON.parse(text)?.choices?.[0]?.message?.content ?? "";
    } catch {
      content = text.slice(0, 120);
    }
    console.log(`${t.name}: OK ${ms}ms — ${String(content).slice(0, 80)}`);
  } catch (err) {
    const ms = Date.now() - started;
    console.log(`${t.name}: FAIL ${ms}ms — ${err instanceof Error ? err.message : err}`);
  }
}

console.log("Pinging models in parallel...\n");
await Promise.all(targets.map(ping));
console.log("\nDone.");
