import nextEnv from "@next/env";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { getDataConnectDb } from "../lib/trae/dataconnect.ts";
import { getTopicDetail, upsertTopic, upsertEvaluation, updateTopicEvaluationState } from "@trae-contest/dataconnect-generated";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

const providerMap = {
  friend: "NVIDIA",
  nvidia: "NVIDIA"
} as const;

const competitionLevelMap = {
  "极具竞争力": "HIGHLY_COMPETITIVE",
  "有竞争力": "COMPETITIVE",
  "竞争力一般": "AVERAGE",
  "较弱": "WEAK"
} as const;

const competitionLevelRevMap = {
  "HIGHLY_COMPETITIVE": "极具竞争力",
  "COMPETITIVE": "有竞争力",
  "AVERAGE": "竞争力一般",
  "WEAK": "较弱"
} as const;

function cleanEvalVars(evaluation: any, newTopicId: string) {
  return {
    id: evaluation.id,
    topicId: newTopicId,
    sourceType: "PRELIMINARY",
    provider: evaluation.provider ? (providerMap[evaluation.provider as keyof typeof providerMap] ?? evaluation.provider) : null,
    model: evaluation.model,
    promptVersion: evaluation.promptVersion,
    totalScore: evaluation.totalScore,
    innovationScore: evaluation.innovationScore,
    practicalityScore: evaluation.practicalityScore,
    completionScore: evaluation.completionScore,
    designScore: evaluation.designScore,
    complianceRiskScore: evaluation.complianceRiskScore,
    directionConsistencyScore: evaluation.directionConsistencyScore ?? null,
    confidenceScore: evaluation.confidenceScore,
    competitionLevel: (competitionLevelMap[evaluation.competitionLevel as keyof typeof competitionLevelMap] ?? evaluation.competitionLevel) || "WEAK",
    summary: evaluation.summary,
    strengths: evaluation.strengths ?? [],
    weaknesses: evaluation.weaknesses ?? [],
    suggestions: evaluation.suggestions ?? [],
    complianceRisks: evaluation.complianceRisks ?? [],
    dimensionComments: evaluation.dimensionComments ?? null,
    matchComment: evaluation.matchComment ?? null,
    promptText: null, // Clear prompt
    systemPrompt: null, // Clear prompt
    inputTokens: evaluation.inputTokens ?? null,
    outputTokens: evaluation.outputTokens ?? null,
    rawModelResponse: evaluation.rawModelResponse,
    llmCallLogs: evaluation.llmCallLogs ?? [],
    error: evaluation.error ?? null
  };
}

function topicToUpsertVariables(topic: any, newId: string, newSourceType: "PRELIMINARY" | "SIGNUP") {
  return {
    id: newId,
    sourceType: newSourceType,
    externalTopicId: topic.externalTopicId,
    slug: topic.slug || "topic",
    title: topic.title,
    url: topic.url,
    authorName: topic.authorName || "Unknown",
    authorAvatarUrl: topic.authorAvatarUrl ?? null,
    track: topic.track ?? null,
    tags: topic.tags ?? [],
    replyCount: topic.replyCount ?? 0,
    viewCount: topic.viewCount ?? 0,
    likeCount: topic.likeCount ?? 0,
    createdAtExternal: topic.createdAtExternal ?? null,
    lastActivityAtExternal: topic.lastActivityAtExternal ?? null,
    contentText: topic.contentText ?? "",
    contentHtml: topic.contentHtml ?? null,
    excerpt: topic.excerpt ?? "",
    demoUrl: topic.demoUrl ?? null,
    attachmentUrls: topic.attachmentUrls ?? [],
    imageUrls: topic.imageUrls ?? [],
    sessionIds: topic.sessionIds ?? [],
    traeEvidence: topic.traeEvidence ?? null,
    contentHash: topic.contentHash ?? "placeholder-hash",
    status: topic.status ?? "NEEDS_JUDGING",
    rawJson: topic.rawJson ?? null,
    rawHtml: topic.rawHtml ?? null
  };
}

async function main() {
  try {
    const dc = getDataConnectDb();
    
    // Load local cache to get all topic IDs
    const cachePath = path.join(process.cwd(), "lib", "trae", "topics-cache.json");
    const content = await fs.readFile(cachePath, "utf8");
    const cachedTopics: any[] = JSON.parse(content);
    
    console.log(`Loaded ${cachedTopics.length} topic IDs from local cache.`);
    
    // Create pre-sized array for output items to keep order matching the cache
    const cleanCachedTopics = new Array(cachedTopics.length);
    
    let restoredCount = 0;
    let skippedCount = 0;

    const batchSize = 15;
    for (let i = 0; i < cachedTopics.length; i += batchSize) {
      const batch = cachedTopics.slice(i, i + batchSize);
      console.log(`Processing batch ${i} to ${Math.min(i + batchSize, cachedTopics.length)} of ${cachedTopics.length}...`);

      await Promise.all(batch.map(async (cachedTopic, indexInBatch) => {
        const globalIndex = i + indexInBatch;
        const rawId = cachedTopic.id.replace("preliminary_", "").replace("signup_", "");
        const prefixedId = `preliminary_${rawId}`;

        try {
          // 1. Fetch prefixed detail first
          const prefixedRes = await getTopicDetail(dc as any, { id: prefixedId });
          const prefixedTopic = prefixedRes.data.topic;
          let prefixedEvals = prefixedTopic?.evaluations_on_topic ?? [];

          let rawTopic = null;
          let rawEvals = [];

          // Only fetch raw ID if prefixed has no evaluation
          if (prefixedEvals.length === 0) {
            const rawRes = await getTopicDetail(dc as any, { id: rawId });
            rawTopic = rawRes.data.topic;
            rawEvals = rawTopic?.evaluations_on_topic ?? [];
          }

          const hasPrefixedEval = prefixedEvals.length > 0;
          const hasRawEval = rawEvals.length > 0;

          let sourceTopic = prefixedTopic || rawTopic;
          if (!sourceTopic) {
            sourceTopic = {
              ...cachedTopic,
              id: prefixedId,
              externalTopicId: rawId,
              sourceType: "PRELIMINARY",
              status: "NEEDS_JUDGING",
              totalScore: -1
            };
          }

          const cleanPrefixedVars = topicToUpsertVariables(sourceTopic, prefixedId, "PRELIMINARY");

          if (hasPrefixedEval || hasRawEval) {
            const latestEval = hasPrefixedEval ? prefixedEvals[0] : rawEvals[0];
            console.log(`- Found evaluation for "${sourceTopic.title}" (rawId: ${rawId}, Score: ${latestEval.totalScore})`);

            // Update topic row under prefixedId
            cleanPrefixedVars.status = "JUDGED";
            await upsertTopic(dc as any, cleanPrefixedVars as any);

            // Upsert clean evaluation (wipes prompts) linked to prefixedId
            const updatedEvalVars = cleanEvalVars(latestEval, prefixedId);
            await upsertEvaluation(dc as any, updatedEvalVars as any);

            // Update topic evaluation state
            const finalLevel = latestEval.competitionLevel ? (competitionLevelRevMap[latestEval.competitionLevel as keyof typeof competitionLevelRevMap] ?? latestEval.competitionLevel) : "较弱";
            await updateTopicEvaluationState(dc as any, {
              id: prefixedId,
              status: "JUDGED",
              totalScore: latestEval.totalScore,
              innovationScore: latestEval.innovationScore,
              practicalityScore: latestEval.practicalityScore,
              completionScore: latestEval.completionScore,
              designScore: latestEval.designScore,
              complianceRiskScore: latestEval.complianceRiskScore,
              directionConsistencyScore: latestEval.directionConsistencyScore ?? null,
              confidenceScore: latestEval.confidenceScore,
              competitionLevel: competitionLevelMap[finalLevel as keyof typeof competitionLevelMap] ?? "WEAK"
            } as any);

            cleanCachedTopics[globalIndex] = {
              ...sourceTopic,
              id: prefixedId,
              sourceType: "PRELIMINARY",
              status: "JUDGED",
              totalScore: latestEval.totalScore,
              evaluations_on_topic: [{
                ...latestEval,
                promptText: null,
                systemPrompt: null
              }],
              match_on_preliminaryTopic: prefixedTopic?.match_on_preliminaryTopic ?? rawTopic?.match_on_preliminaryTopic ?? null
            };
            restoredCount++;
          } else {
            // No evaluation, set to NEEDS_JUDGING with totalScore: -1 (avoids Postgres NULL-first sort)
            cleanPrefixedVars.status = "NEEDS_JUDGING";
            await upsertTopic(dc as any, cleanPrefixedVars as any);

            await updateTopicEvaluationState(dc as any, {
              id: prefixedId,
              status: "NEEDS_JUDGING",
              totalScore: -1,
              innovationScore: null,
              practicalityScore: null,
              completionScore: null,
              designScore: null,
              complianceRiskScore: null,
              directionConsistencyScore: null,
              confidenceScore: null,
              competitionLevel: null
            } as any);

            cleanCachedTopics[globalIndex] = {
              ...sourceTopic,
              id: prefixedId,
              sourceType: "PRELIMINARY",
              status: "NEEDS_JUDGING",
              totalScore: -1,
              evaluations_on_topic: [],
              match_on_preliminaryTopic: prefixedTopic?.match_on_preliminaryTopic ?? rawTopic?.match_on_preliminaryTopic ?? null
            };
            skippedCount++;
          }

          // Hide duplicate raw ID by setting sourceType to SIGNUP
          if (rawTopic) {
            const hideRawVars = topicToUpsertVariables(rawTopic, rawId, "SIGNUP");
            await upsertTopic(dc as any, hideRawVars as any);
          }
        } catch (err) {
          console.error(`Error processing topic ${rawId}:`, err);
          // Preserve the original cachedTopic to avoid writing nulls in cache
          cleanCachedTopics[globalIndex] = cachedTopic;
        }
      }));

      // Small throttle between batches
      await new Promise((resolve) => setTimeout(resolve, 80));
    }

    // Save correct cache back to topics-cache.json
    await fs.writeFile(cachePath, JSON.stringify(cleanCachedTopics, null, 2), "utf8");
    console.log(`\nFinished restore-and-cleanup.`);
    console.log(`- Restored prefixed evaluated topics: ${restoredCount}`);
    console.log(`- Unjudged prefixed topics set to totalScore=-1: ${skippedCount}`);
    console.log(`Successfully updated local topics cache file with prefixed IDs.`);
  } catch (globalErr) {
    console.error("FATAL ERROR in main loop:", globalErr);
    process.exit(1);
  }
}

main().catch(console.error);
