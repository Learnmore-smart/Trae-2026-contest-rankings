import nextEnv from "@next/env";
import { getDataConnectDb } from "../lib/trae/dataconnect.ts";
import { getBoardData, updateTopicEvaluationState } from "@trae-contest/dataconnect-generated";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

const topicStatusMap = {
  scraped: "SCRAPED",
  needs_judging: "NEEDS_JUDGING",
  judged: "JUDGED",
  scrape_error: "SCRAPE_ERROR",
  judge_error: "JUDGE_ERROR",
  SCRAPED: "SCRAPED",
  NEEDS_JUDGING: "NEEDS_JUDGING",
  JUDGED: "JUDGED",
  SCRAPE_ERROR: "SCRAPE_ERROR",
  JUDGE_ERROR: "JUDGE_ERROR"
} as const;

async function main() {
  const dc = getDataConnectDb();
  console.log("Starting iterative null score updates...");

  let loopCount = 0;
  while (true) {
    loopCount++;
    console.log(`\n--- Iteration ${loopCount} ---`);
    console.log("Fetching board data...");
    const res = await getBoardData(dc);
    const topics = res.data.topics ?? [];
    
    const nullTopics = topics.filter(t => t.totalScore === null);
    console.log(`Found ${nullTopics.length} topics with null scores out of ${topics.length} fetched.`);
    
    if (nullTopics.length === 0) {
      console.log("No more null scores found! Migration complete.");
      break;
    }

    let updatedInThisBatch = 0;
    for (const topic of nullTopics) {
      console.log(`Updating null scores for: "${topic.title}"`);
      const status = topicStatusMap[topic.status as keyof typeof topicStatusMap] || "NEEDS_JUDGING";
      
      await updateTopicEvaluationState(dc, {
        id: topic.id,
        status: status as any,
        totalScore: -1,
        innovationScore: -1,
        practicalityScore: -1,
        completionScore: -1,
        designScore: -1,
        complianceRiskScore: -1,
        directionConsistencyScore: null,
        confidenceScore: -1,
        competitionLevel: null
      } as any);
      updatedInThisBatch++;
    }
    console.log(`Updated ${updatedInThisBatch} topics in this iteration.`);
  }
}

main().catch(console.error);
