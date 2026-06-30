import nextEnv from "@next/env";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { getDataConnectDb } from "../lib/trae/dataconnect.ts";
import { upsertTopic as upsertTopicMutation } from "@trae-contest/dataconnect-generated";
import { extractTopicSignals, getContentHash } from "../lib/trae/extractors.ts";

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
  const contentText = topic.contentText ?? "";
  const title = topic.title ?? "";
  const hash = topic.contentHash || getContentHash(title, contentText);
  
  return {
    id: topic.id,
    sourceType: sourceTypeMap[topic.sourceType as keyof typeof sourceTypeMap] ?? "PRELIMINARY",
    externalTopicId: topic.externalTopicId ?? topic.id,
    slug: topic.slug ?? "",
    title: title,
    url: topic.url ?? `https://china-forum.trae.sh/t/topic/${topic.id}`,
    authorName: topic.authorName ?? "Unknown",
    authorAvatarUrl: topic.authorAvatarUrl ?? null,
    track: topic.track ?? null,
    tags: sanitizeTags(topic.tags),
    replyCount: topic.replyCount ?? 0,
    viewCount: topic.viewCount ?? 0,
    likeCount: topic.likeCount ?? 0,
    createdAtExternal: topic.createdAtExternal ?? new Date().toISOString(),
    lastActivityAtExternal: topic.lastActivityAtExternal ?? new Date().toISOString(),
    contentText: contentText,
    contentHtml: topic.contentHtml ?? null,
    excerpt: topic.excerpt ?? "",
    demoUrl: topic.demoUrl ?? null,
    attachmentUrls: topic.attachmentUrls ?? [],
    imageUrls: topic.imageUrls ?? [],
    sessionIds: topic.sessionIds ?? [],
    traeEvidence: topic.traeEvidence ?? null,
    contentHash: hash,
    status: topicStatusMap[topic.status as keyof typeof topicStatusMap] ?? "NEEDS_JUDGING",
    rawJson: topic.rawJson ?? null,
    rawHtml: topic.rawHtml ?? null
  };
}

async function main() {
  const dc = getDataConnectDb();
  
  console.log("Loading topics from local topics-cache.json...");
  const cachePath = path.join(process.cwd(), "lib", "trae", "topics-cache.json");
  const content = await fs.readFile(cachePath, "utf8");
  const allTopics: any[] = JSON.parse(content);
  
  console.log(`Loaded ${allTopics.length} topics from cache.`);
  let updatedCount = 0;
  
  for (let i = 0; i < allTopics.length; i++) {
    const topic = allTopics[i];
    
    // Extract signals using the new, lenient regex
    const signals = extractTopicSignals({
      title: topic.title,
      text: topic.contentText,
      html: topic.contentHtml,
      tags: sanitizeTags(topic.tags)
    });
    
    // Check if the session IDs or evidence count changed
    const oldIdsStr = JSON.stringify((topic.sessionIds ?? []).sort());
    const newIdsStr = JSON.stringify(signals.sessionIds.sort());
    
    if (oldIdsStr !== newIdsStr || topic.traeEvidence?.sessionIdCount !== signals.traeEvidence.sessionIdCount) {
      console.log(`Updating session IDs for topic "${topic.title}" (${topic.id}):`);
      console.log(`  Old: ${oldIdsStr} (Count: ${topic.traeEvidence?.sessionIdCount ?? 0})`);
      console.log(`  New: ${newIdsStr} (Count: ${signals.traeEvidence.sessionIdCount})`);
      
      const updatedTopic = {
        ...topic,
        sessionIds: signals.sessionIds,
        traeEvidence: {
          ...topic.traeEvidence,
          ...signals.traeEvidence
        }
      };
      
      // Update database
      await upsertTopicMutation(dc, topicToVariables(updatedTopic) as any);
      
      // Update in-memory list
      allTopics[i] = updatedTopic;
      updatedCount++;
    }
  }
  
  if (updatedCount > 0) {
    console.log(`Saving updated list back to ${cachePath}...`);
    await fs.writeFile(cachePath, JSON.stringify(allTopics, null, 2), "utf8");
  }
  
  console.log(`Finished. Re-evaluated and updated ${updatedCount} topics.`);
}

main().catch(console.error);
