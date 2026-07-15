import nextEnv from "@next/env";
const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

// Override primary model to the working/stable openai/gpt-oss-120b
process.env.FRIEND_PRIMARY_MODEL = "openai/gpt-oss-120b";
// Disable retries for failed/timeout models to failover instantly
process.env.AI_MAX_RETRIES_PER_MODEL = "0";
// Set timeout to 30 seconds for fast failover
process.env.AI_REQUEST_TIMEOUT_MS = "30000";

import { fetchTopic, upsertTopic } from "../lib/trae/scraper.ts";
import { rejudgeTopicById } from "../lib/trae/judge.ts";
import { getTraeConfig } from "../lib/trae/config.ts";
import { upsertMatch, getTopicsBySourceType } from "@trae-contest/dataconnect-generated";
import { withSqlRetry, getDataConnectDb } from "../lib/trae/dataconnect.ts";
import { scoreTopicMatch, scoreConfirmedAuthorMatch } from "../lib/trae/matcher.ts";
import { findSignupRefsByUsername, normalizeUsername, resolveAuthorUsername } from "../lib/trae/signup-finder.ts";
import type { TraeTopic } from "../lib/trae/types.ts";

async function fetchAllTopicsBySourceType(dc: any, sourceType: "PRELIMINARY" | "SIGNUP"): Promise<TraeTopic[]> {
  const all: TraeTopic[] = [];
  const PAGE_SIZE = 1000;
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const res = await withSqlRetry(() => getTopicsBySourceType(dc, { sourceType, offset } as any));
    const topics = (res.data.topics ?? []) as unknown as TraeTopic[];
    all.push(...topics);
    if (topics.length < PAGE_SIZE) break;
  }
  return all;
}

function filterImageUrls(urls: string[]): string[] {
  if (!urls) return [];
  // 1. Filter out emojis
  let filtered = urls.filter(url => !url.includes("/emoji/") && !url.includes("emoji/twitter"));

  // 2. Deduplicate by image hash
  const uniqueHashes = new Map<string, string>();
  for (const url of filtered) {
    const match = url.match(/([a-f0-9]{40})/i);
    if (match) {
      const hash = match[1];
      const isOriginal = url.includes("/original/");
      const existing = uniqueHashes.get(hash);
      if (!existing || isOriginal) {
        uniqueHashes.set(hash, url);
      }
    } else {
      uniqueHashes.set(url, url);
    }
  }
  return Array.from(uniqueHashes.values());
}

async function matchSingleTopic(preliminary: TraeTopic) {
  const dc = getDataConnectDb();
  
  const noMatch = () => ({
    signupTopicId: null,
    signupAuthorName: null,
    matchMethod: "none",
    matchConfidence: 0,
    titleSimilarity: null,
    directionConsistencyScore: null,
    directionConsistencyComment: "暂未匹配到报名记录；这不代表未报名，可能是用户名或标题无法自动匹配。",
    mismatchRisk: "unknown"
  });

  const lookupSignups = async (username: string): Promise<TraeTopic[]> => {
    const refs = await findSignupRefsByUsername(username);
    const confirmed: TraeTopic[] = [];
    for (const ref of refs.slice(0, 3)) {
      try {
        const topic = await fetchTopic("signup", ref);
        const confirmsIdentity = !topic.authorUsername || normalizeUsername(topic.authorUsername) === normalizeUsername(username);
        if (!confirmsIdentity) continue;
        await upsertTopic(topic);
        confirmed.push(topic);
      } catch {
        // Skip
      }
    }
    return confirmed;
  };

  let best: any = noMatch();

  // 1. Try to find the author's username and search the forum directly
  const username = await resolveAuthorUsername(preliminary);
  if (username) {
    console.log(`Searching signup topics for forum author "${username}"...`);
    const confirmed = await lookupSignups(username);
    if (confirmed.length > 0) {
      console.log(`Found ${confirmed.length} confirmed signup(s) on the forum.`);
      for (const signup of confirmed) {
        const score = scoreConfirmedAuthorMatch(preliminary, signup);
        if (score.matchConfidence > best.matchConfidence) best = score;
      }
    }
  }

  // 2. If no confirmed signup was found via username search, fallback to database pool scanning
  if (!best.signupTopicId) {
    console.log("No confirmed signup found via username search. Falling back to database pool scanning...");
    const signups = await fetchAllTopicsBySourceType(dc, "SIGNUP");
    const signupPool = [...signups];
    for (const signup of signupPool) {
      const score = scoreTopicMatch(preliminary, signup);
      if (score.matchConfidence > best.matchConfidence) best = score;
    }
    if (best.matchConfidence < 35) {
      best = noMatch();
    }
  }

  const matchMethodMap = {
    same_author: "SAME_AUTHOR",
    title_similarity: "TITLE_SIMILARITY",
    manual: "MANUAL",
    none: "NONE"
  } as const;

  const mismatchRiskMap = {
    none: "NONE",
    low: "LOW",
    medium: "MEDIUM",
    high: "HIGH",
    unknown: "UNKNOWN"
  } as const;

  await withSqlRetry(() => upsertMatch(dc as any, {
    id: preliminary.id,
    preliminaryTopicId: preliminary.id,
    signupTopicId: best.signupTopicId,
    preliminaryAuthorName: preliminary.authorName,
    signupAuthorName: best.signupAuthorName,
    matchMethod: matchMethodMap[best.matchMethod as keyof typeof matchMethodMap],
    matchConfidence: best.matchConfidence,
    titleSimilarity: best.titleSimilarity ?? null,
    directionConsistencyScore: best.directionConsistencyScore ?? null,
    directionConsistencyComment: best.directionConsistencyComment ?? null,
    mismatchRisk: mismatchRiskMap[best.mismatchRisk as keyof typeof mismatchRiskMap]
  } as any));

  return best;
}

async function main() {
  const arg = process.argv[2] || "70321";
  let externalTopicId = arg;
  let url = `https://forum.trae.cn/t/topic/${externalTopicId}`;

  if (arg.startsWith("http://") || arg.startsWith("https://")) {
    try {
      const parsed = new URL(arg);
      if (parsed.hostname.includes("rateministere.com")) {
        const match = parsed.pathname.match(/\/project\/preliminary_(\d+)/);
        if (match) {
          externalTopicId = match[1];
          url = `https://forum.trae.cn/t/topic/${externalTopicId}`;
        }
      } else if (parsed.hostname.includes("forum.trae.cn")) {
        const match = parsed.pathname.match(/\/t\/[^/]+\/(\d+)/);
        if (match) {
          externalTopicId = match[1];
          url = arg;
        }
      }
    } catch (e: any) {
      console.error("Invalid URL argument:", e.message);
    }
  } else if (arg.includes("_")) {
    externalTopicId = arg.split("_")[1];
    url = `https://forum.trae.cn/t/topic/${externalTopicId}`;
  }

  const id = `preliminary_${externalTopicId}`;

  console.log(`Step 1: Scraping topic from URL: ${url}...`);
  const ref = {
    externalTopicId,
    slug: "topic",
    title: externalTopicId,
    url
  };

  const topic = await fetchTopic("preliminary", ref);
  console.log(`Scraped Title: "${topic.title}" by ${topic.authorName}`);

  // Deduplicate and filter images so we don't request dozens of vision calls
  topic.imageUrls = filterImageUrls(topic.imageUrls).slice(0, 4);
  if (topic.traeEvidence && Array.isArray(topic.traeEvidence.visualDemoImageUrls)) {
    topic.traeEvidence.visualDemoImageUrls = filterImageUrls(topic.traeEvidence.visualDemoImageUrls).slice(0, 4);
  }
  console.log(`Optimized image list count: ${topic.imageUrls.length}`);
  
  const upsertStatus = await upsertTopic(topic);
  console.log(`Upsert status in database: ${upsertStatus}`);

  console.log(`\nStep 2: Running matching specifically for this topic...`);
  const matchResult = await matchSingleTopic(topic);
  console.log(`Matching completed:`, JSON.stringify(matchResult, null, 2));

  console.log(`\nStep 3: Grading the topic using multi-evaluator judge (Vision Enabled)...`);
  const judgeResult = await rejudgeTopicById(id);
  
  if (judgeResult.status === "ok") {
    const evalResult = judgeResult.evaluation;
    console.log(`\n========================================`);
    console.log(`GRADING RESULTS FOR TOPIC ${externalTopicId}`);
    console.log(`========================================`);
    console.log(`Title: ${topic.title}`);
    console.log(`Author: ${topic.authorName}`);
    console.log(`Total Score: ${evalResult.totalScore}/100`);
    console.log(`- Innovation Score: ${evalResult.innovationScore}/30`);
    console.log(`- Practicality Score: ${evalResult.practicalityScore}/30`);
    console.log(`- Completion Score: ${evalResult.completionScore}/20`);
    console.log(`- Design Score: ${evalResult.designScore}/20`);
    console.log(`- Compliance Risk Score: ${evalResult.complianceRiskScore}/10`);
    console.log(`Confidence Score: ${evalResult.confidenceScore}/100`);
    console.log(`Competition Level: ${evalResult.competitionLevel}`);
    console.log(`Summary: ${evalResult.summary}`);
    console.log(`\nStrengths:`);
    evalResult.strengths.forEach(s => console.log(`  - ${s}`));
    console.log(`\nWeaknesses:`);
    evalResult.weaknesses.forEach(w => console.log(`  - ${w}`));
    console.log(`\nSuggestions:`);
    evalResult.suggestions.forEach(s => console.log(`  - ${s}`));
    console.log(`\nCompliance Risks:`);
    evalResult.complianceRisks.forEach(r => console.log(`  - ${r}`));
    console.log(`========================================`);
  } else {
    console.error(`Grading failed with status: ${judgeResult.status}`);
  }
}

main().catch(console.error);
