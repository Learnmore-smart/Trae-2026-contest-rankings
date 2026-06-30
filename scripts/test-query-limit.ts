import nextEnv from "@next/env";
import { getDataConnectDb } from "../lib/trae/dataconnect.ts";
import { getBoardData, getTopicsBySourceType } from "@trae-contest/dataconnect-generated";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

async function main() {
  const dc = getDataConnectDb();
  
  const boardRes = await getBoardData(dc);
  console.log(`getBoardData returned: ${boardRes.data.topics?.length ?? 0} topics`);

  const topicsRes = await getTopicsBySourceType(dc, { sourceType: "PRELIMINARY" } as any);
  console.log(`getTopicsBySourceType returned: ${topicsRes.data.topics?.length ?? 0} topics`);
}

main().catch(console.error);
