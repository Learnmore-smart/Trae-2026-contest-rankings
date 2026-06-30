import nextEnv from "@next/env";
import { getDataConnectDb } from "../lib/trae/dataconnect.ts";
import { getStats, listRuns } from "@trae-contest/dataconnect-generated";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

async function checkDb() {
  try {
    const dc = getDataConnectDb();
    console.log("Checking Cloud SQL via Data Connect...");

    const statsRes = await getStats(dc);
    console.log("Stats:");
    console.log(`- Signup topics: ${statsRes.data.signupCount?.[0]?._count ?? 0}`);
    console.log(`- Preliminary topics: ${statsRes.data.preliminaryCount?.[0]?._count ?? 0}`);
    console.log(`- Evaluated topics: ${statsRes.data.evaluatedCount?.[0]?._count ?? 0}`);
    console.log(`- Matched topics: ${statsRes.data.matchedCount?.[0]?._count ?? 0}`);

    const runsRes = await listRuns(dc, { limit: 5 });
    console.log("\nLatest 5 Runs:");
    const runs = runsRes.data.runs ?? [];
    for (const run of runs) {
      console.log(`- Run ID: ${run.id}`);
      console.log(`  Type: ${run.type}, Status: ${run.status}`);
      console.log(`  Started: ${run.startedAt}, Finished: ${run.finishedAt ?? "N/A"}`);
      if (run.logs && run.logs.length > 0) {
        console.log(`  Latest log: ${run.logs[run.logs.length - 1]}`);
      }
    }
  } catch (err) {
    console.error("Error querying Data Connect:", err);
  }
}

checkDb();
