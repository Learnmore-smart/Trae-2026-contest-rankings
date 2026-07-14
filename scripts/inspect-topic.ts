import nextEnv from "@next/env";
import { getDataConnectDb } from "../lib/trae/dataconnect.ts";
import { getTopicDetail } from "@trae-contest/dataconnect-generated";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

async function main() {
  const dc = getDataConnectDb();
  const id = "preliminary_95423";
  const res = await getTopicDetail(dc as any, { id });
  const topic = res.data.topic;
  if (!topic) {
    console.error("Topic not found in DB!");
    return;
  }
  console.log("Topic ID:", topic.id);
  console.log("Title:", topic.title);
  console.log("Author:", topic.authorName);
  console.log("Demo URL:", topic.demoUrl);
  console.log("Image URLs:", JSON.stringify(topic.imageUrls, null, 2));
  console.log("Attachment URLs:", JSON.stringify(topic.attachmentUrls, null, 2));
  console.log("Content Text length:", topic.contentText?.length);
}

main().catch(console.error);
