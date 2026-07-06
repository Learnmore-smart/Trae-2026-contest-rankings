import nextEnv from "@next/env";
import { getDataConnectDb } from "../lib/trae/dataconnect.ts";
import { getBoardPage, getTopicDetail } from "@trae-contest/dataconnect-generated";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

async function main() {
  const dc = getDataConnectDb();
  console.log("Scanning board to find JUDGE_ERROR topics...");
  
  const PAGE = 1000;
  const judgeErrorTopicIds: string[] = [];
  for (let offset = 0; ; offset += PAGE) {
    const res = await getBoardPage(dc as any, { limit: PAGE, offset } as any);
    const topics = res.data.topics ?? [];
    for (const t of topics) {
      if (t.status === "JUDGE_ERROR") {
        judgeErrorTopicIds.push(t.id);
      }
    }
    if (topics.length < PAGE) break;
  }
  
  console.log(`Found ${judgeErrorTopicIds.length} topics with JUDGE_ERROR status.`);
  if (judgeErrorTopicIds.length === 0) return;
  
  console.log("Details for the first 3 errors:");
  for (const id of judgeErrorTopicIds.slice(0, 3)) {
    const detailRes = await getTopicDetail(dc as any, { id } as any);
    const topic = detailRes.data.topic;
    const latestEval = topic?.evaluations_on_topic?.[0];
    console.log(`Topic ID: ${id} | Title: ${topic?.title}`);
    console.log(`Latest Evaluation error:`, latestEval?.error);
    console.log(`Model response:`, latestEval?.rawModelResponse?.slice(0, 300));
    console.log("---");
  }
}

main().catch(console.error);
