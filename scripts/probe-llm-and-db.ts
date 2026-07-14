import nextEnv from "@next/env";
import { getDataConnectDb } from "../lib/trae/dataconnect.ts";
import { getTopicDetail } from "@trae-contest/dataconnect-generated";
import { getTraeConfig } from "../lib/trae/config.ts";
import { callLLMWithFallback } from "../lib/trae/llm.ts";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

const id = process.argv[2] ?? "preliminary_46867";

console.log("1) config...");
const config = getTraeConfig();
console.log({
  friendBase: config.friendBaseUrl,
  friendPrimary: config.friendPrimaryModel,
  nvidiaPrimary: config.nvidiaPrimaryModel,
  order: config.aiProviderOrder,
  hasFriendKey: Boolean(config.friendApiKey),
  nvidiaKeyCount: config.nvidiaApiKeys.length,
  vision: config.judgeVisionEnabled
});

console.log("2) getTopicDetail", id);
const t0 = Date.now();
const dc = getDataConnectDb();
const res = await getTopicDetail(dc as any, { id });
console.log("topic ok in", Date.now() - t0, "ms", "title=", res.data.topic?.title?.slice(0, 60));

console.log("3) LLM tiny JSON call...");
const t1 = Date.now();
try {
  const result = await callLLMWithFallback({
    config,
    messages: [
      { role: "system", content: "Return strict JSON only." },
      { role: "user", content: 'Return {"ok":true,"n":1} only.' }
    ],
    validateContent: (content) => {
      const parsed = JSON.parse(content);
      if (!parsed || typeof parsed !== "object") throw new Error("not object");
      return parsed;
    }
  });
  console.log("LLM ok in", Date.now() - t1, "ms", {
    provider: result.provider,
    model: result.model,
    content: result.content.slice(0, 200),
    logs: result.callLogs.length
  });
} catch (err) {
  console.error("LLM FAIL in", Date.now() - t1, "ms");
  console.error(err instanceof Error ? err.message : err);
  if (err && typeof err === "object" && "callLogs" in err) {
    console.error(JSON.stringify((err as any).callLogs, null, 2).slice(0, 5000));
  }
  process.exitCode = 1;
}

console.log("done");
