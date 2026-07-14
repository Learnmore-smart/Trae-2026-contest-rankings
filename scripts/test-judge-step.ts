import nextEnv from "@next/env";
const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

import { fetchTopic } from "../lib/trae/scraper.ts";
import { getDataConnectDb } from "../lib/trae/dataconnect.ts";
import { getTopicDetail } from "@trae-contest/dataconnect-generated";
import { describeTopicImages, describeDemoScreenshot } from "../lib/trae/vision.ts";
import { auditDemoArtifact } from "../lib/trae/demo-audit.ts";
import { getTraeConfig } from "../lib/trae/config.ts";
import { buildEvaluatorJudgePrompt, parseEvaluationJson } from "../lib/trae/judge.ts";
import { callLLMWithFallback } from "../lib/trae/llm.ts";

function filterImageUrls(urls: string[]): string[] {
  if (!urls) return [];
  let filtered = urls.filter(url => !url.includes("/emoji/") && !url.includes("emoji/twitter"));
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

async function main() {
  const dc = getDataConnectDb();
  const config = getTraeConfig();
  const id = "preliminary_95423";
  
  console.log("1. Fetching topic from DB...");
  const res = await getTopicDetail(dc as any, { id });
  const dbTopic = res.data.topic;
  if (!dbTopic) {
    console.error("Topic not found!");
    return;
  }
  
  const topic: any = {
    ...dbTopic,
    sourceType: dbTopic.sourceType.toLowerCase(),
    status: dbTopic.status.toLowerCase(),
    competitionLevel: null,
    evaluatedAt: dbTopic.evaluatedAt ?? null,
    createdAtExternal: dbTopic.createdAtExternal ?? null,
    lastActivityAtExternal: dbTopic.lastActivityAtExternal ?? null
  };
  
  topic.imageUrls = filterImageUrls(topic.imageUrls).slice(0, 4);
  if (topic.traeEvidence && Array.isArray(topic.traeEvidence.visualDemoImageUrls)) {
    topic.traeEvidence.visualDemoImageUrls = filterImageUrls(topic.traeEvidence.visualDemoImageUrls).slice(0, 4);
  }

  const match: any = dbTopic.match_on_preliminaryTopic ? {
    ...dbTopic.match_on_preliminaryTopic,
    matchMethod: dbTopic.match_on_preliminaryTopic.matchMethod.toLowerCase(),
    mismatchRisk: dbTopic.match_on_preliminaryTopic.mismatchRisk.toLowerCase()
  } : null;

  console.log("2. Checking Playwright import...");
  const dynamicImport = new Function("specifier", "return import(specifier)") as (specifier: string) => Promise<any>;
  try {
    const pw = await dynamicImport("playwright");
    console.log("Playwright successfully imported! Chromium exists:", !!pw?.chromium);
  } catch (err) {
    console.log("Playwright not found, which is expected:", (err as Error).message);
  }

  console.log("3. Running describeTopicImages...");
  const t0 = Date.now();
  try {
    const imageEvidence = await describeTopicImages(topic, { config });
    console.log(`describeTopicImages finished in ${Date.now() - t0}ms:`, JSON.stringify(imageEvidence, null, 2));
  } catch (err) {
    console.error("Error in describeTopicImages:", err);
  }

  console.log("4. Running describeDemoScreenshot...");
  const t1 = Date.now();
  try {
    const demoEvidence = await describeDemoScreenshot(topic, { 
      config, 
      demoAuditFn: (candidate) => auditDemoArtifact(candidate, { config }) 
    });
    console.log(`describeDemoScreenshot finished in ${Date.now() - t1}ms:`, JSON.stringify(demoEvidence, null, 2));
  } catch (err) {
    console.error("Error in describeDemoScreenshot:", err);
  }

  console.log("5. Running evaluator team (just product evaluator)...");
  try {
    const profile = { id: "product", label: "Product value evaluator", focus: "Judge real user value, problem clarity, market/use-case fit, and whether the work is more than a thin static page." } as any;
    const prompt = buildEvaluatorJudgePrompt(topic, match, profile, null);
    const result = await callLLMWithFallback({
      config,
      messages: [
        { role: "system", content: "You return strict JSON only. Do not include Markdown fences or comments." },
        { role: "user", content: prompt }
      ],
      validateContent: parseEvaluationJson
    });
    console.log("Product evaluator output:", JSON.stringify(result.parsed, null, 2));
  } catch (err) {
    console.error("Error in evaluator call:", err);
    if (err && typeof err === "object" && "callLogs" in err) {
      console.error("Call logs on error:", JSON.stringify((err as any).callLogs, null, 2));
    }
  }
}

main().catch(error => {
  console.error("UNHANDLED REJECTION:", error);
});
