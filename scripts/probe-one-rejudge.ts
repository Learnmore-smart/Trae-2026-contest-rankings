import nextEnv from "@next/env";
import { rejudgeTopicById } from "../lib/trae/judge.ts";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

const id = process.argv[2] ?? "preliminary_46867";
console.log("start", id, new Date().toISOString());
const started = Date.now();
try {
  const r = await rejudgeTopicById(id);
  console.log("status", r.status);
  if (r.status === "ok") {
    console.log("model", r.evaluation.model);
    console.log("score", r.evaluation.totalScore);
    console.log("confidence", r.evaluation.confidenceScore);
  }
  console.log("elapsed_ms", Date.now() - started);
} catch (err) {
  console.error("ERROR", err instanceof Error ? err.message : err);
  if (err && typeof err === "object" && "callLogs" in err) {
    console.error("callLogs", JSON.stringify((err as any).callLogs?.slice?.(-3) ?? (err as any).callLogs, null, 2).slice(0, 4000));
  }
  process.exitCode = 1;
}
