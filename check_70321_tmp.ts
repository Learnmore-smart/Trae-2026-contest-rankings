import nextEnv from "@next/env";
import { getDataConnectDb } from "./lib/trae/dataconnect.ts";
import { getTopicDetail } from "@trae-contest/dataconnect-generated";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

async function main() {
  const dc = getDataConnectDb();
  const id = "preliminary_70321";
  console.log(`Checking topic ${id} in DB...`);
  try {
    const res = await getTopicDetail(dc as any, { id });
    const topic = res.data.topic;
    if (!topic) {
      console.log("Topic not found in DB.");
    } else {
      console.log("Topic found!");
      console.log(JSON.stringify({
        id: topic.id,
        title: topic.title,
        status: topic.status,
        author: topic.authorName,
        totalScore: topic.totalScore,
        evaluatedAt: topic.evaluatedAt
      }, null, 2));
    }
  } catch (err) {
    console.error("Error fetching topic:", err);
  }
}

main().catch(console.error);
