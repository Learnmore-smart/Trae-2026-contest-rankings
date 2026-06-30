import nextEnv from "@next/env";
import { getDataConnectDb } from "../lib/trae/dataconnect.ts";
import { getTopicsBySourceType, upsertTopic as upsertTopicMutation } from "@trae-contest/dataconnect-generated";
import { extractTopicSignals } from "../lib/trae/extractors.ts";
import type { TraeTopic } from "../lib/trae/types.ts";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

const sourceTypeMap = {
  signup: "SIGNUP",
  preliminary: "PRELIMINARY",
  SIGNUP: "SIGNUP",
  PRELIMINARY: "PRELIMINARY"
} as const;

const topicStatusMap = {
  scraped: "SCRAPED",
  needs_judging: "NEEDS_JUDGING",
  judged: "JUDGED",
  scrape_error: "SCRAPE_ERROR",
  judge_error: "JUDGE_ERROR",
  SCRAPED: "SCRAPED",
  NEEDS_JUDGING: "NEEDS_JUDGING",
  JUDGED: "JUDGED",
  SCRAPE_ERROR: "SCRAPE_ERROR",
  JUDGE_ERROR: "JUDGE_ERROR"
} as const;

function sanitizeTags(tags: any[] | undefined): string[] {
  if (!tags || !Array.isArray(tags)) return [];
  return tags.map((tag) => {
    if (typeof tag === "string") return tag;
    if (tag && typeof tag === "object") {
      const record = tag as Record<string, unknown>;
      return String(record.name || record.slug || record.id || JSON.stringify(tag));
    }
    return String(tag);
  }).filter(Boolean);
}

function topicToVariables(topic: any) {
  return {
    id: topic.id,
    sourceType: sourceTypeMap[topic.sourceType as keyof typeof sourceTypeMap],
    externalTopicId: topic.externalTopicId,
    slug: topic.slug,
    title: topic.title,
    url: topic.url,
    authorName: topic.authorName,
    authorAvatarUrl: topic.authorAvatarUrl ?? null,
    track: topic.track ?? null,
    tags: sanitizeTags(topic.tags),
    replyCount: topic.replyCount ?? null,
    viewCount: topic.viewCount ?? null,
    likeCount: topic.likeCount ?? null,
    createdAtExternal: topic.createdAtExternal ?? null,
    lastActivityAtExternal: topic.lastActivityAtExternal ?? null,
    contentText: topic.contentText,
    contentHtml: topic.contentHtml ?? null,
    excerpt: topic.excerpt,
    demoUrl: topic.demoUrl ?? null,
    attachmentUrls: topic.attachmentUrls ?? [],
    imageUrls: topic.imageUrls ?? [],
    sessionIds: topic.sessionIds ?? [],
    traeEvidence: topic.traeEvidence ?? null,
    contentHash: topic.contentHash,
    status: topicStatusMap[topic.status as keyof typeof topicStatusMap],
    rawJson: topic.rawJson ?? null,
    rawHtml: topic.rawHtml ?? null
  };
}

async function main() {
  const dc = getDataConnectDb();
  console.log("Fetching all preliminary and signup topics...");
  
  const [prelimRes, signupRes] = await Promise.all([
    getTopicsBySourceType(dc, { sourceType: "PRELIMINARY" }),
    getTopicsBySourceType(dc, { sourceType: "SIGNUP" })
  ]);
  
  const prelimTopics = prelimRes.data.topics ?? [];
  const signupTopics = signupRes.data.topics ?? [];
  const allTopics = [...prelimTopics, ...signupTopics];
  
  console.log(`Loaded ${prelimTopics.length} preliminary and ${signupTopics.length} signup topics.`);
  
  let updatedCount = 0;
  
  for (const topic of allTopics) {
    const signals = extractTopicSignals({
      title: topic.title,
      text: topic.contentText,
      tags: sanitizeTags(topic.tags)
    });
    
    const newTrack = signals.track;
    if (newTrack !== topic.track) {
      console.log(`Updating track for topic "${topic.title}": "${topic.track}" -> "${newTrack}"`);
      
      const updatedTopic = {
        ...topic,
        track: newTrack
      };
      
      await upsertTopicMutation(dc, topicToVariables(updatedTopic) as any);
      updatedCount++;
    }
  }
  
  console.log(`Finished updating tracks. Updated ${updatedCount} topics.`);
}

main().catch(console.error);
