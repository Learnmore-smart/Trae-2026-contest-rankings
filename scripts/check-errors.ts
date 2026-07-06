import nextEnv from "@next/env";
import { getDataConnectDb } from "../lib/trae/dataconnect.ts";
import { listRuns } from "@trae-contest/dataconnect-generated";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

async function main() {
  const dc = getDataConnectDb();
  const runsRes = await listRuns(dc as any, { limit: 3 } as any);
  console.log("Latest runs:");
  for (const r of runsRes.data.runs ?? []) {
    console.log(`Run ${r.id} type=${r.type} status=${r.status} error=${r.error}`);
    console.log("Logs:", JSON.stringify(r.logs, null, 2));
  }
}

main().catch(console.error);
