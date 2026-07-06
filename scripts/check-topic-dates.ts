import nextEnv from "@next/env";
import { getDataConnectDb } from "../lib/trae/dataconnect.ts";
import { getBoardPage } from "@trae-contest/dataconnect-generated";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

async function main() {
  const dc = getDataConnectDb();
  const res = await getBoardPage(dc as any, { limit: 5, offset: 0 } as any);
  const topics = res.data.topics ?? [];
  for (const t of topics) {
    console.log("Topic ID:", t.id);
    console.log("lastActivityAtExternal:", t.lastActivityAtExternal, typeof t.lastActivityAtExternal);
    console.log("createdAtExternal:", t.createdAtExternal, typeof t.createdAtExternal);
    console.log("updatedAt:", t.updatedAt, typeof t.updatedAt);
  }
}

main().catch(console.error);
