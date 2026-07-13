// Test multiple models on friend API to find working ones
import { readFileSync } from "fs";

const envContent = readFileSync(".env", "utf-8");
const apiKeyMatch = envContent.match(/^TRAE_FRIEND_API=(.+)$/m);
const apiKey = apiKeyMatch ? apiKeyMatch[1].trim() : "";
const baseUrl = "http://47.93.17.237:8889/v1";

const models = [
  "google/gemma-4-31b-it",
  "grok-4.5",
  "deepseek-ai/deepseek-v4-pro",
  "z-ai/glm-5.2",
  "deepseek-ai/deepseek-v4-flash",
  "minimaxai/minimax-m3",
  "moonshotai/kimi-k2.6",
];

async function testModel(model) {
  const start = Date.now();
  try {
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: "Say OK" }],
        max_tokens: 10,
        temperature: 0,
      }),
      signal: AbortSignal.timeout(15000),
    });
    const elapsed = Date.now() - start;
    if (res.ok) {
      const data = await res.json();
      const content = data.choices?.[0]?.message?.content ?? "(empty)";
      console.log(`  ${model}: OK in ${elapsed}ms — "${content.slice(0, 50)}"`);
    } else {
      const text = await res.text();
      console.log(`  ${model}: ${res.status} in ${elapsed}ms — ${text.slice(0, 100)}`);
    }
  } catch (e) {
    const elapsed = Date.now() - start;
    console.log(`  ${model}: FAIL after ${elapsed}ms — ${e.message}`);
  }
}

console.log("Testing models on friend API...\n");
for (const model of models) {
  await testModel(model);
}
console.log("\nDone.");
