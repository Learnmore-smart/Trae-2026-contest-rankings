import nextEnv from "@next/env";
import { getDataConnectDb } from "../lib/trae/dataconnect.ts";
import { getBoardData, getStats, listRuns } from "@trae-contest/dataconnect-generated";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

async function main(): Promise<void> {
  const dc = getDataConnectDb();
  const [statsRes, boardRes, runsRes] = await Promise.all([getStats(dc), getBoardData(dc), listRuns(dc, { limit: 6 })]);
  const topics = boardRes.data.topics ?? [];
  const evals = topics.flatMap((topic) => topic.evaluations_on_topic ?? []);

  console.log("TOPICS signup:", statsRes.data.signupCount?.[0]?._count ?? 0);
  console.log("TOPICS preliminary:", statsRes.data.preliminaryCount?.[0]?._count ?? 0);
  console.log("EVALUATIONS latest-on-board:", evals.length, "errors:", evals.filter((evaluation) => evaluation.error).length);
  console.log("MATCHES:", statsRes.data.matchedCount?.[0]?._count ?? 0);
  console.log("\n--- sample topic urls (first 8) ---");
  for (const t of topics.slice(0, 8)) {
    console.log(`[${t.sourceType}] ${t.externalTopicId} ${t.url} :: ${t.title.slice(0, 40)} :: status=${t.status}`);
  }
  console.log("\n--- evaluations by provider (latest 6) ---");
  for (const x of [...evals].sort((p, q) => (q.createdAt > p.createdAt ? 1 : -1)).slice(0, 6)) {
    console.log(`${x.createdAt} provider=${x.provider} model=${x.model} in=${x.inputTokens} out=${x.outputTokens} error=${x.error ? "Y" : "n"}`);
  }
  console.log("\n--- latest runs ---");
  for (const run of runsRes.data.runs ?? []) {
    console.log(`${run.startedAt} ${run.type}${run.sourceType ? `/${run.sourceType}` : ""} ${run.status} ${run.finishedAt ?? "running"}`);
  }

  console.log("\n--- sample evaluation (first) ---");
  const e = evals[0];
  if (e) {
    console.log("provider:", e.provider, "model:", e.model, "error:", e.error);
    console.log("rawModelResponse: omitted by board diagnostic query");
    console.log("keys:", Object.keys(e).sort().join(", "));
  } else {
    console.log("(no evaluations)");
  }
}

main().then(() => process.exit(0)).catch((err) => { console.error(err); process.exit(1); });
