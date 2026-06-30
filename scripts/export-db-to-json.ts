import nextEnv from "@next/env";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { getDataConnectDb } from "../lib/trae/dataconnect.ts";
import { getTopicDetail } from "@trae-contest/dataconnect-generated";
import { getTraeConfig } from "../lib/trae/config.ts";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

// Helper to fetch a JSON category page from the forum
async function fetchCategoryPage(categoryUrl: string, page: number): Promise<any[]> {
  const jsonUrl = categoryUrl.endsWith("/") ? `${categoryUrl.slice(0, -1)}.json` : `${categoryUrl}.json`;
  const url = new URL(jsonUrl);
  if (page > 0) url.searchParams.set("page", String(page));
  
  try {
    const res = await fetch(url.toString(), {
      headers: { "Accept": "application/json" }
    });
    if (!res.ok) return [];
    const payload: any = await res.json();
    return payload.topic_list?.topics ?? [];
  } catch (err) {
    console.error(`Failed to fetch page ${page}:`, err);
    return [];
  }
}

async function main() {
  const dc = getDataConnectDb();
  const config = getTraeConfig();
  const categoryUrl = config.categoryUrls.preliminary;
  const topicsMap = new Map<string, any>();

  console.log("Scraping category pages to collect all preliminary topic IDs...");
  let page = 0;
  while (true) {
    console.log(`Fetching category page ${page}...`);
    const topics = await fetchCategoryPage(categoryUrl, page);
    if (!topics.length) {
      console.log("Reached end of category pages.");
      break;
    }
    for (const t of topics) {
      if (t.id && !t.pinned && !t.pinned_globally && t.archetype === "regular") {
        topicsMap.set(String(t.id), t);
      }
    }
    page++;
    // Bounded safety limit
    if (page > 15) break;
  }

  const topicIds = Array.from(topicsMap.keys());
  console.log(`Found ${topicIds.length} preliminary topics in total from the forum.`);

  console.log("\nFetching details for each topic from the database by ID...");
  const exportedItems: any[] = [];
  let fetchedCount = 0;

  for (const id of topicIds) {
    fetchedCount++;
    if (fetchedCount % 20 === 0) {
      console.log(`Processed ${fetchedCount}/${topicIds.length} topics...`);
    }
    const prefixedId = `preliminary_${id}`;
    try {
      const res = await getTopicDetail(dc, { id: prefixedId });
      const topic = res.data.topic;
      if (topic) {
        // We structure it like the items in GetBoardData query
        exportedItems.push({
          ...topic,
          evaluations_on_topic: topic.evaluations_on_topic ?? [],
          match_on_preliminaryTopic: topic.match_on_preliminaryTopic ?? null
        });
      } else {
        // Topic exists on forum but not in DB yet, scrape basic info from the ref
        const rawRef = topicsMap.get(id);
        exportedItems.push({
          id: prefixedId,
          sourceType: "PRELIMINARY",
          externalTopicId: id,
          slug: rawRef.slug || "",
          title: rawRef.title || "",
          url: `https://china-forum.trae.sh/t/topic/${id}`,
          authorName: "Unknown",
          scrapedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          contentText: "",
          excerpt: "",
          status: "NEEDS_JUDGING",
          totalScore: -1,
          evaluations_on_topic: [],
          match_on_preliminaryTopic: null
        });
      }
    } catch (err) {
      console.error(`Error fetching topic ${prefixedId} from DB:`, err);
    }
  }

  const cachePath = path.join(process.cwd(), "lib", "trae", "topics-cache.json");
  await fs.mkdir(path.dirname(cachePath), { recursive: true });
  await fs.writeFile(cachePath, JSON.stringify(exportedItems, null, 2), "utf8");
  console.log(`\nSuccessfully exported ${exportedItems.length} topics to ${cachePath}`);
}

main().catch(console.error);
