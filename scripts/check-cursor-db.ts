import nextEnv from "@next/env";
import { getDataConnectDb } from "../lib/trae/dataconnect.ts";
import { getScrapeCursor } from "@trae-contest/dataconnect-generated";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

async function main() {
  const dc = getDataConnectDb();
  const signupRes = await getScrapeCursor(dc as any, { sourceType: "SIGNUP" } as any);
  console.log("Signup cursor:", JSON.stringify(signupRes.data.scrapeCursors, null, 2));

  const prelimRes = await getScrapeCursor(dc as any, { sourceType: "PRELIMINARY" } as any);
  console.log("Preliminary cursor:", JSON.stringify(prelimRes.data.scrapeCursors, null, 2));

  // Query latest runs
  const { listRuns } = await import("@trae-contest/dataconnect-generated");
  const runsRes = await listRuns(dc as any, { limit: 5 } as any);
  console.log("Latest runs:", JSON.stringify(runsRes.data.runs, null, 2));
}

main().catch(console.error);
