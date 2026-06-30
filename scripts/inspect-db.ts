import nextEnv from "@next/env";
import { getDataConnectDb } from "../lib/trae/dataconnect.ts";
import { getBoardData } from "@trae-contest/dataconnect-generated";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

async function main() {
  const dc = getDataConnectDb();
  const boardRes = await getBoardData(dc);
  const topics = boardRes.data.topics ?? [];
  
  const statusCounts: Record<string, number> = {};
  const topicsWithEvals: string[] = [];
  
  for (const t of topics) {
    statusCounts[t.status] = (statusCounts[t.status] ?? 0) + 1;
    const hasEvals = t.evaluations_on_topic && t.evaluations_on_topic.length > 0;
    if (hasEvals) {
      topicsWithEvals.push(t.id);
    }
  }
  
  console.log("Total topics fetched:", topics.length);
  console.log("Status counts:", statusCounts);
  console.log("Topics with evaluations count:", topicsWithEvals.length);
  if (topicsWithEvals.length > 0) {
    console.log("Sample topic IDs with evals:", topicsWithEvals.slice(0, 5));
    const sampleTopic = topics.find(t => t.id === topicsWithEvals[0]);
    console.log("Sample evaluation on topic:", JSON.stringify(sampleTopic?.evaluations_on_topic?.[0], null, 2));
  }
}

main().catch(console.error);
