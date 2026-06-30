import nextEnv from "@next/env";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { getDataConnectDb, nowIso } from "../lib/trae/dataconnect.ts";
import { getTopicDetail, upsertEvaluation, updateTopicEvaluationState } from "@trae-contest/dataconnect-generated";
import { judgeOneTopic } from "../lib/trae/judge.ts";
import type { TraeEvaluation, TraeMatch, TraeTopic } from "../lib/trae/types.ts";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

const targetIds = ["52174", "52192"];

const providerMap = {
  nvidia: "NVIDIA",
  openrouter: "OPENROUTER"
} as const;

const competitionLevelMap = {
  "极具竞争力": "HIGHLY_COMPETITIVE",
  "有竞争力": "COMPETITIVE",
  "竞争力一般": "AVERAGE",
  "较弱": "WEAK"
} as const;

function toUpsertEvaluationVariables(evaluation: any) {
  return {
    id: evaluation.id,
    topicId: evaluation.topicId,
    sourceType: evaluation.sourceType,
    provider: evaluation.provider ? (providerMap[evaluation.provider as keyof typeof providerMap] ?? null) : null,
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
    competitionLevel: competitionLevelMap[evaluation.competitionLevel as keyof typeof competitionLevelMap] ?? "WEAK",
    summary: evaluation.summary,
    strengths: evaluation.strengths ?? [],
    weaknesses: evaluation.weaknesses ?? [],
    suggestions: evaluation.suggestions ?? [],
    complianceRisks: evaluation.complianceRisks ?? [],
    dimensionComments: evaluation.dimensionComments ?? null,
    matchComment: evaluation.matchComment ?? null,
    promptText: evaluation.promptText ?? null,
    systemPrompt: evaluation.systemPrompt ?? null,
    inputTokens: evaluation.inputTokens ?? null,
    outputTokens: evaluation.outputTokens ?? null,
    rawModelResponse: evaluation.rawModelResponse,
    llmCallLogs: evaluation.llmCallLogs ?? [],
    error: evaluation.error ?? null
  };
}

async function main() {
  const dc = getDataConnectDb();
  
  // Load local cache to sync updates
  const cachePath = path.join(process.cwd(), "lib", "trae", "topics-cache.json");
  let allCachedTopics: any[] = [];
  try {
    const content = await fs.readFile(cachePath, "utf8");
    allCachedTopics = JSON.parse(content);
  } catch (err) {
    console.warn("Could not load local topics cache, will skip writing cache.");
  }

  for (const id of targetIds) {
    console.log(`\n========================================`);
    console.log(`Re-judging topic ID: ${id}...`);
    
    // 1. Fetch live topic and match from DB
    const res = await getTopicDetail(dc as any, { id });
    const dbTopic = res.data.topic;
    if (!dbTopic) {
      console.error(`Topic ${id} not found in database!`);
      continue;
    }

    const mappedTopic: TraeTopic = {
      ...dbTopic,
      sourceType: dbTopic.sourceType.toLowerCase(),
      status: dbTopic.status.toLowerCase(),
      competitionLevel: null,
      evaluatedAt: dbTopic.evaluatedAt ?? null,
      createdAtExternal: dbTopic.createdAtExternal ?? null,
      lastActivityAtExternal: dbTopic.lastActivityAtExternal ?? null
    } as any;

    const mappedMatch: TraeMatch | null = dbTopic.match_on_preliminaryTopic ? {
      ...dbTopic.match_on_preliminaryTopic,
      matchMethod: dbTopic.match_on_preliminaryTopic.matchMethod.toLowerCase(),
      mismatchRisk: dbTopic.match_on_preliminaryTopic.mismatchRisk.toLowerCase()
    } as any : null;

    console.log(`Title: ${mappedTopic.title}`);
    console.log(`Session ID Count: ${mappedTopic.traeEvidence?.sessionIdCount ?? 0}`);
    console.log(`Screenshot Count: ${mappedTopic.traeEvidence?.screenshotCount ?? 0}`);

    // 2. Run LLM judge
    try {
      const evaluation = await judgeOneTopic(mappedTopic, mappedMatch);

      // 3. Save evaluation to DB
      console.log(`\nNew Evaluation Result:`);
      console.log(`- Total Score: ${evaluation.totalScore}`);
      console.log(`- Compliance Risks:`, evaluation.complianceRisks);
      console.log(`- Weaknesses:`, evaluation.weaknesses);

      await upsertEvaluation(dc as any, toUpsertEvaluationVariables(evaluation) as any);

      // 4. Update Topic evaluation state in DB
      await updateTopicEvaluationState(dc as any, {
        id,
        status: "JUDGED",
        totalScore: evaluation.totalScore,
        innovationScore: evaluation.innovationScore,
        practicalityScore: evaluation.practicalityScore,
        completionScore: evaluation.completionScore,
        designScore: evaluation.designScore,
        complianceRiskScore: evaluation.complianceRiskScore,
        directionConsistencyScore: evaluation.directionConsistencyScore ?? null,
        confidenceScore: evaluation.confidenceScore,
        competitionLevel: competitionLevelMap[evaluation.competitionLevel as keyof typeof competitionLevelMap] ?? "WEAK"
      } as any);

      // 5. Update local JSON cache
      if (allCachedTopics.length > 0) {
        const idx = allCachedTopics.findIndex(t => t.id === id);
        if (idx >= 0) {
          allCachedTopics[idx] = {
            ...allCachedTopics[idx],
            totalScore: evaluation.totalScore,
            status: "JUDGED",
            evaluations_on_topic: [evaluation]
          };
          console.log(`Updated cache entry for topic ${id}.`);
        }
      }
    } catch (err) {
      console.error(`Failed to judge topic ${id}:`, err);
    }
  }

  // Save cache back
  if (allCachedTopics.length > 0) {
    await fs.writeFile(cachePath, JSON.stringify(allCachedTopics, null, 2), "utf8");
    console.log(`\nSuccessfully updated local topics cache file.`);
  }
}

main().catch(console.error);
