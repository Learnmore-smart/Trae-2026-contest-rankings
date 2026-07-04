import nextEnv from "@next/env";
import { getDataConnectDb } from "../lib/trae/dataconnect.ts";
import { getBoardPage, getStats } from "@trae-contest/dataconnect-generated";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

async function main() {
  const dc = getDataConnectDb();

  const stats = await getStats(dc);
  const preliminaryCount = stats.data.preliminaryCount?.[0]?._count ?? 0;
  const evaluatedCount = stats.data.evaluatedCount?.[0]?._count ?? 0; // status == JUDGED
  console.log("GetStats.preliminaryCount (分母):", preliminaryCount);
  console.log("GetStats.evaluatedCount  (已评分=JUDGED):", evaluatedCount);

  const PAGE = 1000;
  const statusCounts: Record<string, number> = {};
  const scoreBuckets = { judgedButNegativeScore: 0, judgedGoodScore: 0 };
  let total = 0;
  for (let offset = 0; ; offset += PAGE) {
    const res = await getBoardPage(dc, { limit: PAGE, offset });
    const topics = res.data.topics ?? [];
    for (const t of topics) {
      total += 1;
      statusCounts[t.status] = (statusCounts[t.status] ?? 0) + 1;
      if (t.status === "JUDGED") {
        if ((t.totalScore ?? -1) >= 0) scoreBuckets.judgedGoodScore += 1;
        else scoreBuckets.judgedButNegativeScore += 1;
      }
    }
    if (topics.length < PAGE) break;
  }

  console.log("\nFull board scan total topics:", total);
  console.log("Status breakdown:", statusCounts);
  console.log("JUDGED score buckets:", scoreBuckets);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
