import nextEnv from "@next/env";
import { getDataConnectDb } from "../lib/trae/dataconnect.ts";
import { getBoardData } from "@trae-contest/dataconnect-generated";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

async function main() {
  const dc = getDataConnectDb();
  console.log("Fetching board data...");
  const res = await getBoardData(dc);
  const topics = res.data.topics ?? [];
  
  // Filter evaluated topics (excluding -1 placeholder scores)
  const evaluated = topics.filter(t => t.totalScore !== null && t.totalScore >= 0);
  console.log(`Loaded ${evaluated.length} evaluated topics.\n`);

  for (const topic of evaluated.slice(0, 10)) {
    const latestEval = topic.evaluations_on_topic?.[0];
    const match = topic.match_on_preliminaryTopic;
    console.log(`Topic: "${topic.title}"`);
    console.log(`Author: ${topic.authorName}`);
    console.log(`Scores: Total=${topic.totalScore}, Confidence=${topic.confidenceScore}%`);
    console.log(`Status: TopicStatus=${topic.status}`);
    if (latestEval) {
      console.log(`Evaluation:`);
      console.log(`  Compliance Risks:`, latestEval.complianceRisks);
      console.log(`  Compliance Risk Score:`, latestEval.complianceRiskScore);
      console.log(`  Summary: "${latestEval.summary}"`);
    } else {
      console.log(`Evaluation: none`);
    }
    if (match) {
      console.log(`Match:`);
      console.log(`  Signup ID:`, match.signupTopicId);
      console.log(`  Match Confidence:`, match.matchConfidence);
      console.log(`  Mismatch Risk:`, match.mismatchRisk);
    } else {
      console.log(`Match: none`);
    }
    console.log("------------------------------------------\n");
  }
}

main().catch(console.error);
