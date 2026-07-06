import nextEnv from "@next/env";
import { getDataConnectDb } from "../lib/trae/dataconnect.ts";
import { getBoardPage } from "@trae-contest/dataconnect-generated";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

async function main() {
  const dc = getDataConnectDb();
  console.log("Scanning database to count matches...");
  
  const PAGE = 1000;
  let totalMatched = 0;
  let totalPreliminary = 0;
  for (let offset = 0; ; offset += PAGE) {
    const res = await getBoardPage(dc as any, { limit: PAGE, offset } as any);
    const topics = res.data.topics ?? [];
    totalPreliminary += topics.length;
    for (const t of topics) {
      // Find matches in matching_on_preliminary
      const match = t.match_on_preliminaryTopic;
      if (match && match.signupTopicId) {
        totalMatched += 1;
      }
    }
    if (topics.length < PAGE) break;
  }
  
  console.log(`Total preliminary topics scanned: ${totalPreliminary}`);
  console.log(`Total matched to a signup topic: ${totalMatched}`);
}

main().catch(console.error);
