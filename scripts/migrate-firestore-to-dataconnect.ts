import nextEnv from "@next/env";
import { getFirestore } from "firebase-admin/firestore";
import { getDataConnectDb } from "../lib/trae/dataconnect.ts";
import {
  migrateTopic,
  migrateEvaluation,
  migrateMatch,
  migrateRun
} from "@trae-contest/dataconnect-generated";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

function toIsoString(val: any): string | null {
  if (!val) return null;
  if (typeof val.toDate === "function") {
    return val.toDate().toISOString();
  }
  if (val instanceof Date) {
    return val.toISOString();
  }
  if (typeof val === "string") {
    return new Date(val).toISOString();
  }
  return null;
}

// Mappings
function mapTopic(docData: any) {
  const scrapedAt = toIsoString(docData.scrapedAt) || new Date().toISOString();
  const updatedAt = toIsoString(docData.updatedAt) || new Date().toISOString();
  const createdAtExternal = toIsoString(docData.createdAtExternal);
  const lastActivityAtExternal = toIsoString(docData.lastActivityAtExternal);
  const evaluatedAt = toIsoString(docData.evaluatedAt);

  const statusMap = {
    scraped: "SCRAPED",
    needs_judging: "NEEDS_JUDGING",
    judged: "JUDGED",
    scrape_error: "SCRAPE_ERROR",
    judge_error: "JUDGE_ERROR"
  } as const;
  const status = statusMap[docData.status as keyof typeof statusMap] || "SCRAPED";

  const sourceTypeMap = {
    signup: "SIGNUP",
    preliminary: "PRELIMINARY"
  } as const;
  const sourceType = sourceTypeMap[docData.sourceType as keyof typeof sourceTypeMap] || "PRELIMINARY";

  const compLevelMap = {
    "极具竞争力": "HIGHLY_COMPETITIVE",
    "有竞争力": "COMPETITIVE",
    "竞争力一般": "AVERAGE",
    "较弱": "WEAK",
    "HIGHLY_COMPETITIVE": "HIGHLY_COMPETITIVE",
    "COMPETITIVE": "COMPETITIVE",
    "AVERAGE": "AVERAGE",
    "WEAK": "WEAK"
  } as const;
  const competitionLevel = docData.competitionLevel ? (compLevelMap[docData.competitionLevel as keyof typeof compLevelMap] || null) : null;

  return {
    id: docData.id,
    sourceType,
    externalTopicId: String(docData.externalTopicId || ""),
    slug: docData.slug || "",
    title: docData.title || "",
    url: docData.url || "",
    authorName: docData.authorName || "Unknown",
    authorAvatarUrl: docData.authorAvatarUrl || null,
    track: docData.track || null,
    tags: Array.isArray(docData.tags) ? docData.tags.filter((t: any) => typeof t === "string") : [],
    replyCount: typeof docData.replyCount === "number" ? docData.replyCount : null,
    viewCount: typeof docData.viewCount === "number" ? docData.viewCount : null,
    likeCount: typeof docData.likeCount === "number" ? docData.likeCount : null,
    createdAtExternal,
    lastActivityAtExternal,
    scrapedAt,
    updatedAt,
    contentText: docData.contentText || "",
    contentHtml: docData.contentHtml || null,
    excerpt: docData.excerpt || "",
    demoUrl: docData.demoUrl || null,
    attachmentUrls: Array.isArray(docData.attachmentUrls) ? docData.attachmentUrls.filter((t: any) => typeof t === "string") : [],
    imageUrls: Array.isArray(docData.imageUrls) ? docData.imageUrls.filter((t: any) => typeof t === "string") : [],
    sessionIds: Array.isArray(docData.sessionIds) ? docData.sessionIds.filter((t: any) => typeof t === "string") : [],
    traeEvidence: docData.traeEvidence || null,
    contentHash: docData.contentHash || "placeholder-hash",
    status,
    rawJson: docData.rawJson || null,
    rawHtml: docData.rawHtml || null,
    totalScore: typeof docData.totalScore === "number" ? docData.totalScore : null,
    innovationScore: typeof docData.innovationScore === "number" ? docData.innovationScore : null,
    practicalityScore: typeof docData.practicalityScore === "number" ? docData.practicalityScore : null,
    completionScore: typeof docData.completionScore === "number" ? docData.completionScore : null,
    designScore: typeof docData.designScore === "number" ? docData.designScore : null,
    complianceRiskScore: typeof docData.complianceRiskScore === "number" ? docData.complianceRiskScore : null,
    directionConsistencyScore: typeof docData.directionConsistencyScore === "number" ? docData.directionConsistencyScore : null,
    confidenceScore: typeof docData.confidenceScore === "number" ? docData.confidenceScore : null,
    competitionLevel,
    evaluatedAt
  };
}

function mapEvaluation(docData: any) {
  const createdAt = toIsoString(docData.createdAt) || new Date().toISOString();

  const providerMap = {
    nvidia: "NVIDIA",
    openrouter: "OPENROUTER"
  } as const;
  const provider = docData.provider ? (providerMap[docData.provider as keyof typeof providerMap] || null) : null;

  const compLevelMap = {
    "极具竞争力": "HIGHLY_COMPETITIVE",
    "有竞争力": "COMPETITIVE",
    "竞争力一般": "AVERAGE",
    "较弱": "WEAK",
    "HIGHLY_COMPETITIVE": "HIGHLY_COMPETITIVE",
    "COMPETITIVE": "COMPETITIVE",
    "AVERAGE": "AVERAGE",
    "WEAK": "WEAK"
  } as const;
  const competitionLevel = docData.competitionLevel ? (compLevelMap[docData.competitionLevel as keyof typeof compLevelMap] || "WEAK") : "WEAK";

  return {
    id: docData.id,
    topicId: docData.topicId,
    sourceType: docData.sourceType || "preliminary",
    provider,
    model: docData.model || "",
    promptVersion: String(docData.promptVersion || "1.0"),
    totalScore: typeof docData.totalScore === "number" ? docData.totalScore : 0,
    innovationScore: typeof docData.innovationScore === "number" ? docData.innovationScore : 0,
    practicalityScore: typeof docData.practicalityScore === "number" ? docData.practicalityScore : 0,
    completionScore: typeof docData.completionScore === "number" ? docData.completionScore : 0,
    designScore: typeof docData.designScore === "number" ? docData.designScore : 0,
    complianceRiskScore: typeof docData.complianceRiskScore === "number" ? docData.complianceRiskScore : 0,
    directionConsistencyScore: typeof docData.directionConsistencyScore === "number" ? docData.directionConsistencyScore : null,
    confidenceScore: typeof docData.confidenceScore === "number" ? docData.confidenceScore : 0,
    competitionLevel,
    summary: docData.summary || "",
    strengths: Array.isArray(docData.strengths) ? docData.strengths.filter((t: any) => typeof t === "string") : [],
    weaknesses: Array.isArray(docData.weaknesses) ? docData.weaknesses.filter((t: any) => typeof t === "string") : [],
    suggestions: Array.isArray(docData.suggestions) ? docData.suggestions.filter((t: any) => typeof t === "string") : [],
    complianceRisks: Array.isArray(docData.complianceRisks) ? docData.complianceRisks.filter((t: any) => typeof t === "string") : [],
    dimensionComments: docData.dimensionComments || null,
    matchComment: docData.matchComment || null,
    promptText: docData.promptText || null,
    systemPrompt: docData.systemPrompt || null,
    inputTokens: typeof docData.inputTokens === "number" ? docData.inputTokens : null,
    outputTokens: typeof docData.outputTokens === "number" ? docData.outputTokens : null,
    rawModelResponse: docData.rawModelResponse || "",
    llmCallLogs: Array.isArray(docData.llmCallLogs) ? docData.llmCallLogs : null,
    error: docData.error || null,
    createdAt
  };
}

function mapMatch(docData: any) {
  const createdAt = toIsoString(docData.createdAt) || new Date().toISOString();
  const updatedAt = toIsoString(docData.updatedAt) || new Date().toISOString();

  const matchMethodMap = {
    same_author: "SAME_AUTHOR",
    title_similarity: "TITLE_SIMILARITY",
    manual: "MANUAL",
    none: "NONE"
  } as const;
  const matchMethod = matchMethodMap[docData.matchMethod as keyof typeof matchMethodMap] || "NONE";

  const riskMap = {
    none: "NONE",
    low: "LOW",
    medium: "MEDIUM",
    high: "HIGH",
    unknown: "UNKNOWN"
  } as const;
  const mismatchRisk = riskMap[docData.mismatchRisk as keyof typeof riskMap] || "UNKNOWN";

  return {
    id: docData.id,
    preliminaryTopicId: docData.preliminaryTopicId || docData.id,
    signupTopicId: docData.signupTopicId || null,
    preliminaryAuthorName: docData.preliminaryAuthorName || "Unknown",
    signupAuthorName: docData.signupAuthorName || null,
    matchMethod,
    matchConfidence: typeof docData.matchConfidence === "number" ? docData.matchConfidence : 0,
    titleSimilarity: typeof docData.titleSimilarity === "number" ? docData.titleSimilarity : null,
    directionConsistencyScore: typeof docData.directionConsistencyScore === "number" ? docData.directionConsistencyScore : null,
    directionConsistencyComment: docData.directionConsistencyComment || null,
    mismatchRisk,
    createdAt,
    updatedAt
  };
}

function mapRun(docData: any) {
  const startedAt = toIsoString(docData.startedAt) || new Date().toISOString();
  const finishedAt = toIsoString(docData.finishedAt);

  const runTypeMap = {
    scrape: "SCRAPE",
    judge: "JUDGE",
    match: "MATCH"
  } as const;
  const type = runTypeMap[docData.type as keyof typeof runTypeMap] || "SCRAPE";

  const runStatusMap = {
    running: "RUNNING",
    success: "SUCCESS",
    partial: "PARTIAL",
    error: "ERROR"
  } as const;
  const status = runStatusMap[docData.status as keyof typeof runStatusMap] || "ERROR";

  const sourceTypeMap = {
    signup: "SIGNUP",
    preliminary: "PRELIMINARY"
  } as const;
  const sourceType = docData.sourceType ? (sourceTypeMap[docData.sourceType as keyof typeof sourceTypeMap] || null) : null;

  return {
    id: docData.id,
    type,
    sourceType,
    startedAt,
    finishedAt,
    status,
    pagesScanned: typeof docData.pagesScanned === "number" ? docData.pagesScanned : null,
    topicsFound: typeof docData.topicsFound === "number" ? docData.topicsFound : null,
    topicsCreated: typeof docData.topicsCreated === "number" ? docData.topicsCreated : null,
    topicsUpdated: typeof docData.topicsUpdated === "number" ? docData.topicsUpdated : null,
    evaluatedCount: typeof docData.evaluatedCount === "number" ? docData.evaluatedCount : null,
    failedCount: typeof docData.failedCount === "number" ? docData.failedCount : null,
    matchedCount: typeof docData.matchedCount === "number" ? docData.matchedCount : null,
    logs: Array.isArray(docData.logs) ? docData.logs.filter((t: any) => typeof t === "string") : [],
    error: docData.error || null
  };
}

async function migrateCollection(
  firestoreCollName: string,
  mapper: (data: any) => any,
  dataconnectMutation: (dc: any, vars: any) => Promise<any>,
  dc: any
) {
  console.log(`\n>>> Migrating collection "${firestoreCollName}"...`);
  const firestore = getFirestore();
  const snapshot = await firestore.collection(firestoreCollName).get();
  console.log(`Found ${snapshot.size} documents in "${firestoreCollName}"`);

  let count = 0;
  let errors = 0;

  for (const doc of snapshot.docs) {
    const docData = doc.data();
    // Use doc.id as id if not present in doc.data()
    if (!docData.id) {
      docData.id = doc.id;
    }
    const variables = mapper(docData);
    try {
      await dataconnectMutation(dc, variables);
      count++;
      if (count % 50 === 0) {
        console.log(`  Processed ${count}/${snapshot.size}...`);
      }
    } catch (err) {
      errors++;
      console.error(`  [ERROR] Failed to migrate doc "${doc.id}":`, err);
    }
  }

  console.log(`Finished "${firestoreCollName}". Successfully migrated: ${count}, Failed: ${errors}`);
}

async function main() {
  try {
    const dc = getDataConnectDb();
    console.log("Firebase App initialized and Data Connect client created.");

    // Migrate in order: Topics first (since evaluations, matches, etc. reference topics)
    await migrateCollection("trae_topics", mapTopic, migrateTopic as any, dc);
    await migrateCollection("trae_evaluations", mapEvaluation, migrateEvaluation as any, dc);
    await migrateCollection("trae_matches", mapMatch, migrateMatch as any, dc);
    await migrateCollection("trae_runs", mapRun, migrateRun as any, dc);

    console.log("\n>>> Migration completed successfully!");
  } catch (err) {
    console.error("FATAL: Migration failed:", err);
    process.exit(1);
  }
}

main().catch(console.error);
