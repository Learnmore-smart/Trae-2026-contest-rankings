import { createHash } from "node:crypto";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { getDataConnectDb } from "./dataconnect.ts";
import {
  getBoardData as getBoardDataQuery,
  getLatestRun,
  getStats,
  getOnlineCount,
  getTopicDetail as getTopicDetailQuery,
  upsertPresence,
  listRuns as listRunsQuery
} from "@trae-contest/dataconnect-generated";
import type {
  RankingItem,
  StatsPayload,
  TraeEvaluation,
  TraeMatch,
  TraeRun,
  TraeTopic
} from "./types.ts";

export interface TopicListParams {
  track?: string | null;
  q?: string | null;
  sort?: string | null;
  page?: number;
  pageSize?: number;
  minConfidence?: number | null;
  bypassCache?: boolean | null;
}

function emptyStats(message?: string): StatsPayload {
  return {
    signupCount: 0,
    preliminaryCount: 0,
    evaluatedCount: 0,
    matchedCount: 0,
    totalInputTokens: 0,
    totalOutputTokens: 0,
    lastUpdatedAt: null,
    onlineCount: 0,
    sourceUnavailable: true,
    message
  };
}

function sanitizeTopic(topic: TraeTopic): RankingItem["topic"] {
  const { contentHtml, rawHtml, rawJson, ...safeTopic } = topic;
  void contentHtml;
  void rawHtml;
  void rawJson;
  return safeTopic;
}

function lightenEvaluation(evaluation: TraeEvaluation | null): TraeEvaluation | null {
  if (!evaluation) return null;
  return { ...evaluation, promptText: undefined, systemPrompt: undefined, rawModelResponse: "", llmCallLogs: undefined };
}

const providerRevMap = {
  "NVIDIA": "nvidia",
  "OPENROUTER": "openrouter"
} as const;

const competitionLevelRevMap = {
  "HIGHLY_COMPETITIVE": "极具竞争力",
  "COMPETITIVE": "有竞争力",
  "AVERAGE": "竞争力一般",
  "WEAK": "较弱"
} as const;

interface BoardData {
  stats: StatsPayload;
  baseItems: RankingItem[];
}

let boardCache: { version: string; data: BoardData } | null = null;
let versionCheckedAt = 0;
const VERSION_TTL_MS = 15_000;

async function getBoardVersion(): Promise<string> {
  try {
    const dc = getDataConnectDb();
    const res = await getLatestRun(dc as any);
    const run = res.data.runs?.[0];
    if (!run) return `none|${Math.floor(Date.now() / 60_000)}`;
    return `${run.startedAt}|${run.finishedAt ?? ""}|${run.status}`;
  } catch (error) {
    console.error("Failed to get board version from DB, falling back to time-based key:", error);
    return `fallback|${Math.floor(Date.now() / 15_000)}`; // 15s cache key fallback
  }
}

async function getOnlineCountValue(dc: unknown): Promise<number> {
  try {
    const onlineSince = new Date(Date.now() - 2 * 60 * 1000).toISOString();
    const onlineRes = await getOnlineCount(dc as any, { onlineSince } as any);
    return onlineRes.data.presences?.[0]?._count ?? 0;
  } catch (error) {
    console.error("Failed to get online count for stats:", error);
    return 0;
  }
}

function statsPayloadFromResponse(statsRes: any, onlineCount: number): StatsPayload {
  let totalInputTokens = 0;
  let totalOutputTokens = 0;

  for (const tu of statsRes.data.modelTokenUsages ?? []) {
    totalInputTokens += tu.input_sum ?? 0;
    totalOutputTokens += tu.output_sum ?? 0;
  }

  const maxTimestamps = [
    statsRes.data.topics?.[0]?.updatedAt_max,
    statsRes.data.evaluations?.[0]?.createdAt_max,
    statsRes.data.matches?.[0]?.updatedAt_max
  ].filter(Boolean);

  return {
    signupCount: statsRes.data.signupCount?.[0]?._count ?? 0,
    preliminaryCount: statsRes.data.preliminaryCount?.[0]?._count ?? 0,
    evaluatedCount: statsRes.data.evaluatedCount?.[0]?._count ?? 0,
    matchedCount: statsRes.data.matchedCount?.[0]?._count ?? 0,
    totalInputTokens,
    totalOutputTokens,
    lastUpdatedAt: maxTimestamps.sort().at(-1) ?? null,
    onlineCount
  };
}

async function readTopicsCache(): Promise<any[]> {
  const cachePath = path.join(process.cwd(), "lib", "trae", "topics-cache.json");
  const content = await fs.readFile(cachePath, "utf8");
  return JSON.parse(content);
}

function statsPayloadFromCacheTopics(allTopics: any[], onlineCount = 1): StatsPayload {
  const evaluatedCount = allTopics.filter((topic) => topic.totalScore !== null && topic.totalScore >= 0).length;
  const updatedAtValues = allTopics
    .flatMap((topic) => [
      topic.updatedAt,
      topic.evaluatedAt,
      topic.evaluations_on_topic?.[0]?.createdAt
    ])
    .filter(Boolean);

  return {
    signupCount: 260,
    preliminaryCount: allTopics.length,
    evaluatedCount,
    matchedCount: 0,
    totalInputTokens: 265582,
    totalOutputTokens: 77612,
    lastUpdatedAt: updatedAtValues.sort().at(-1) ?? null,
    onlineCount
  };
}

async function buildStatsFromSource(): Promise<StatsPayload> {
  const dc = getDataConnectDb();
  const statsRes = await getStats(dc as any);
  const onlineCount = await getOnlineCountValue(dc);
  return statsPayloadFromResponse(statsRes, onlineCount);
}

async function buildBoardDataFromSource(): Promise<BoardData> {
  let topTopics: any[] = [];
  let statsRes: any = null;
  let onlineCount = 1;
  let dbFailed = false;

  try {
    const dc = getDataConnectDb();
    const [boardRes, sRes] = await Promise.all([
      getBoardDataQuery(dc as any),
      getStats(dc as any)
    ]);
    topTopics = boardRes.data.topics ?? [];
    statsRes = sRes;

    const onlineSince = new Date(Date.now() - 2 * 60 * 1000).toISOString();
    const onlineRes = await getOnlineCount(dc as any, { onlineSince } as any);
    onlineCount = onlineRes.data.presences?.[0]?._count ?? 0;
  } catch (dbError) {
    console.error("Database query failed, falling back to local JSON cache:", dbError);
    dbFailed = true;
  }

  // Load the full list of preliminary topics from the local JSON cache
  let allTopics: any[] = [];
  try {
    allTopics = await readTopicsCache();
  } catch (error) {
    console.error("Failed to read topics-cache.json:", error);
  }

  if (dbFailed) {
    // Construct stats and baseItems from the local cache directly
    const stats = statsPayloadFromCacheTopics(allTopics, 1);

    const baseItems: RankingItem[] = allTopics.map((t) => {
      const latestEval = t.evaluations_on_topic?.[0] ?? null;
      const match = t.match_on_preliminaryTopic ?? null;

      const mappedTopic: TraeTopic = {
        ...t,
        sourceType: t.sourceType.toLowerCase() as any,
        status: t.status.toLowerCase() as any,
        competitionLevel: t.competitionLevel ? (competitionLevelRevMap[t.competitionLevel as keyof typeof competitionLevelRevMap] ?? t.competitionLevel) : null,
        evaluatedAt: t.evaluatedAt ?? null,
        createdAtExternal: t.createdAtExternal ?? null,
        lastActivityAtExternal: t.lastActivityAtExternal ?? null
      } as any;

      const mappedEval: TraeEvaluation | null = latestEval ? {
        ...latestEval,
        provider: latestEval.provider ? (providerRevMap[latestEval.provider as keyof typeof providerRevMap] ?? latestEval.provider) : null,
        competitionLevel: competitionLevelRevMap[latestEval.competitionLevel as keyof typeof competitionLevelRevMap] ?? latestEval.competitionLevel
      } as any : null;

      const mappedMatch: TraeMatch | null = match ? {
        ...match,
        matchMethod: match.matchMethod ? (match.matchMethod.toLowerCase() as any) : "none",
        mismatchRisk: match.mismatchRisk ? (match.mismatchRisk.toLowerCase() as any) : "unknown"
      } as any : null;

      return {
        rank: 0,
        topic: sanitizeTopic(mappedTopic),
        evaluation: lightenEvaluation(mappedEval),
        match: mappedMatch
      };
    });

    return { stats, baseItems };
  }

  // Map the top 100 topics to easily lookup their evaluations and matches
  const topMap = new Map<string, { evaluations: any[]; match: any }>();
  for (const t of topTopics) {
    topMap.set(t.id, {
      evaluations: t.evaluations_on_topic ?? [],
      match: t.match_on_preliminaryTopic ?? null
    });
  }

  let totalInputTokens = 0;
  let totalOutputTokens = 0;

  const signupCount = statsRes.data.signupCount?.[0]?._count ?? 0;
  const preliminaryCount = statsRes.data.preliminaryCount?.[0]?._count ?? 0;
  
  // Calculate evaluatedCount in-memory by checking live scores or cached scores
  const evaluatedCount = allTopics.filter(t => {
    const liveTopic = topTopics.find(topT => topT.id === t.id);
    const score = liveTopic ? liveTopic.totalScore : t.totalScore;
    return score !== null && score >= 0;
  }).length;

  const matchedCount = statsRes.data.matchedCount?.[0]?._count ?? 0;
  
  for (const tu of statsRes.data.modelTokenUsages ?? []) {
    totalInputTokens += tu.input_sum ?? 0;
    totalOutputTokens += tu.output_sum ?? 0;
  }

  const maxTimestamps = [
    statsRes.data.topics?.[0]?.updatedAt_max,
    statsRes.data.evaluations?.[0]?.createdAt_max,
    statsRes.data.matches?.[0]?.updatedAt_max
  ].filter(Boolean);
  const lastUpdatedAt = maxTimestamps.sort().at(-1) ?? null;

  const stats: StatsPayload = {
    signupCount,
    preliminaryCount,
    evaluatedCount,
    matchedCount,
    totalInputTokens,
    totalOutputTokens,
    lastUpdatedAt,
    onlineCount
  };

  const baseItems: RankingItem[] = allTopics.map((t) => {
    const topData = topMap.get(t.id);
    const latestEval = topData?.evaluations?.[0] ?? t.evaluations_on_topic?.[0] ?? null;
    const match = topData?.match ?? t.match_on_preliminaryTopic ?? null;

    // Merge live topic fields (scores, status, track) if they were updated in database
    const liveTopic = topTopics.find(topT => topT.id === t.id);
    const mergedTopic = liveTopic ? { ...t, ...liveTopic } : t;

    const mappedTopic: TraeTopic = {
      ...mergedTopic,
      sourceType: mergedTopic.sourceType.toLowerCase() as any,
      status: mergedTopic.status.toLowerCase() as any,
      competitionLevel: mergedTopic.competitionLevel ? competitionLevelRevMap[mergedTopic.competitionLevel as keyof typeof competitionLevelRevMap] ?? mergedTopic.competitionLevel : null,
      evaluatedAt: mergedTopic.evaluatedAt ?? null,
      createdAtExternal: mergedTopic.createdAtExternal ?? null,
      lastActivityAtExternal: mergedTopic.lastActivityAtExternal ?? null
    } as any;

    const mappedEval: TraeEvaluation | null = latestEval ? {
      ...latestEval,
      provider: latestEval.provider ? providerRevMap[latestEval.provider as keyof typeof providerRevMap] ?? latestEval.provider : null,
      competitionLevel: competitionLevelRevMap[latestEval.competitionLevel as keyof typeof competitionLevelRevMap] ?? latestEval.competitionLevel
    } as any : null;

    const mappedMatch: TraeMatch | null = match ? {
      ...match,
      matchMethod: match.matchMethod ? (match.matchMethod.toLowerCase() as any) : "none",
      mismatchRisk: match.mismatchRisk ? (match.mismatchRisk.toLowerCase() as any) : "unknown"
    } as any : null;

    return {
      rank: 0, // Computed dynamically after sorting/filtering in listRankedTopics
      topic: sanitizeTopic(mappedTopic),
      evaluation: lightenEvaluation(mappedEval),
      match: mappedMatch
    };
  });

  return { stats, baseItems };
}

export async function writeBoardSnapshot(): Promise<void> {
  const version = await getBoardVersion();
  const data = await buildBoardDataFromSource();
  boardCache = { version, data };
  versionCheckedAt = Date.now();
}

async function getBoardData(bypassCache = false): Promise<BoardData> {
  const now = Date.now();
  if (!bypassCache && boardCache && now - versionCheckedAt < VERSION_TTL_MS) return boardCache.data;
  let version: string;
  try {
    version = await getBoardVersion();
  } catch (error) {
    if (boardCache) return boardCache.data;
    throw error;
  }
  versionCheckedAt = now;
  if (!bypassCache && boardCache && boardCache.version === version) return boardCache.data;
  try {
    const data = await buildBoardDataFromSource();
    boardCache = { version, data };
    return data;
  } catch (error) {
    if (boardCache) return boardCache.data;
    throw error;
  }
}

export async function getTraeStats(): Promise<StatsPayload> {
  try {
    return await buildStatsFromSource();
  } catch (error) {
    try {
      return statsPayloadFromCacheTopics(await readTopicsCache(), 1);
    } catch {
      // Fall through to the explicit unavailable payload when neither live stats nor the snapshot can be read.
    }
    return emptyStats(error instanceof Error ? error.message : String(error));
  }
}

function sortValue(item: RankingItem, sort: string): number | string {
  const evaluation = item.evaluation;
  switch (sort) {
    case "innovation":
      return evaluation?.innovationScore ?? -1;
    case "practicality":
      return evaluation?.practicalityScore ?? -1;
    case "completion":
      return evaluation?.completionScore ?? -1;
    case "design":
      return evaluation?.designScore ?? -1;
    case "confidence":
      return evaluation?.confidenceScore ?? -1;
    case "views":
      return item.topic.viewCount ?? -1;
    case "replies":
      return item.topic.replyCount ?? -1;
    case "updated":
      return item.topic.updatedAt;
    case "total":
    default:
      return evaluation?.totalScore ?? -1;
  }
}

export async function listRankedTopics(params: TopicListParams = {}): Promise<{
  items: RankingItem[];
  total: number;
  page: number;
  pageSize: number;
  sourceUnavailable?: boolean;
  message?: string;
}> {
  const pageSize = Math.min(1000, Math.max(1, params.pageSize ?? 12));
  const page = Math.max(1, params.page ?? 1);
  const sort = params.sort ?? "total";
  const query = params.q?.trim().toLowerCase() ?? "";

  let items: RankingItem[];
  try {
    items = (await getBoardData(params.bypassCache === true)).baseItems;
  } catch (error) {
    return { items: [], total: 0, page: 1, pageSize, sourceUnavailable: true, message: error instanceof Error ? error.message : String(error) };
  }

  if (params.track) items = items.filter((item) => item.topic.track === params.track);
  if (query) {
    items = items.filter((item) =>
      `${item.topic.title} ${item.topic.authorName} ${item.topic.excerpt} ${item.topic.tags.join(" ")}`
        .toLowerCase()
        .includes(query)
    );
  }
  if (typeof params.minConfidence === "number") {
    items = items.filter((item) => (item.evaluation?.confidenceScore ?? 0) >= params.minConfidence!);
  }

  items.sort((left, right) => {
    const a = sortValue(left, sort);
    const b = sortValue(right, sort);
    if (typeof a === "string" || typeof b === "string") return String(b).localeCompare(String(a));
    return Number(b) - Number(a);
  });
  items = items.map((item, index) => ({ ...item, rank: index + 1 }));

  const total = items.length;
  return {
    items: items.slice((page - 1) * pageSize, page * pageSize),
    total,
    page,
    pageSize
  };
}

export async function getTopicDetail(id: string): Promise<RankingItem | null> {
  try {
    const dc = getDataConnectDb();
    const res = await getTopicDetailQuery(dc as any, { id });
    const t = res.data.topic;
    if (!t || t.sourceType !== "PRELIMINARY") return null;

    const latestEval = t.evaluations_on_topic?.[0];
    const match = t.match_on_preliminaryTopic;

    const mappedTopic: TraeTopic = {
      ...t,
      sourceType: t.sourceType.toLowerCase() as any,
      status: t.status.toLowerCase() as any,
      competitionLevel: t.competitionLevel ? (competitionLevelRevMap[t.competitionLevel as keyof typeof competitionLevelRevMap] ?? t.competitionLevel) : null,
      evaluatedAt: t.evaluatedAt ?? null,
      createdAtExternal: t.createdAtExternal ?? null,
      lastActivityAtExternal: t.lastActivityAtExternal ?? null
    } as any;

    const mappedEval: TraeEvaluation | null = latestEval ? {
      ...latestEval,
      provider: latestEval.provider ? (providerRevMap[latestEval.provider as keyof typeof providerRevMap] ?? latestEval.provider) : null,
      competitionLevel: competitionLevelRevMap[latestEval.competitionLevel as keyof typeof competitionLevelRevMap] ?? latestEval.competitionLevel
    } as any : null;

    const mappedMatch: TraeMatch | null = match ? {
      ...match,
      matchMethod: match.matchMethod ? (match.matchMethod.toLowerCase() as any) : "none",
      mismatchRisk: match.mismatchRisk ? (match.mismatchRisk.toLowerCase() as any) : "unknown"
    } as any : null;

    return {
      rank: 0,
      topic: sanitizeTopic(mappedTopic),
      evaluation: mappedEval,
      match: mappedMatch
    };
  } catch (error) {
    console.error(`Failed to get topic detail for ${id} from DB, checking cache:`, error);
    try {
      const cachePath = path.join(process.cwd(), "lib", "trae", "topics-cache.json");
      const content = await fs.readFile(cachePath, "utf8");
      const allTopics: any[] = JSON.parse(content);
      const t = allTopics.find((item) => item.id === id);
      if (!t) return null;

      const latestEval = t.evaluations_on_topic?.[0];
      const match = t.match_on_preliminaryTopic;

      const mappedTopic: TraeTopic = {
        ...t,
        sourceType: t.sourceType.toLowerCase() as any,
        status: t.status.toLowerCase() as any,
        competitionLevel: t.competitionLevel ? (competitionLevelRevMap[t.competitionLevel as keyof typeof competitionLevelRevMap] ?? t.competitionLevel) : null,
        evaluatedAt: t.evaluatedAt ?? null,
        createdAtExternal: t.createdAtExternal ?? null,
        lastActivityAtExternal: t.lastActivityAtExternal ?? null
      } as any;

      const mappedEval: TraeEvaluation | null = latestEval ? {
        ...latestEval,
        provider: latestEval.provider ? (providerRevMap[latestEval.provider as keyof typeof providerRevMap] ?? latestEval.provider) : null,
        competitionLevel: competitionLevelRevMap[latestEval.competitionLevel as keyof typeof competitionLevelRevMap] ?? latestEval.competitionLevel
      } as any : null;

      const mappedMatch: TraeMatch | null = match ? {
        ...match,
        matchMethod: match.matchMethod ? (match.matchMethod.toLowerCase() as any) : "none",
        mismatchRisk: match.mismatchRisk ? (match.mismatchRisk.toLowerCase() as any) : "unknown"
      } as any : null;

      return {
        rank: 0,
        topic: sanitizeTopic(mappedTopic),
        evaluation: mappedEval,
        match: mappedMatch
      };
    } catch (cacheErr) {
      console.error("Failed to read topics-cache.json for detail:", cacheErr);
      return null;
    }
  }
}

export async function recordPresence(sessionId: string, userAgent: string | null): Promise<{ onlineCount: number }> {
  try {
    const dc = getDataConnectDb();
    const userAgentHash = userAgent
      ? createHash("sha256").update(userAgent).digest("hex").slice(0, 24)
      : null;

    await upsertPresence(dc as any, {
      sessionId,
      userAgentHash
    } as any);

    const onlineSince = new Date(Date.now() - 2 * 60 * 1000).toISOString();
    const onlineRes = await getOnlineCount(dc as any, { onlineSince } as any);
    const onlineCount = onlineRes.data.presences?.[0]?._count ?? 0;
    return { onlineCount };
  } catch {
    return { onlineCount: 0 };
  }
}

export async function listRuns(limit = 30): Promise<TraeRun[]> {
  try {
    const dc = getDataConnectDb();
    const res = await listRunsQuery(dc as any, { limit } as any);
    const rawRuns = res.data.runs ?? [];
    return rawRuns.map((run) => ({
      ...run,
      type: run.type.toLowerCase() as any,
      sourceType: run.sourceType ? run.sourceType.toLowerCase() as any : null,
      status: run.status.toLowerCase() as any,
      finishedAt: run.finishedAt ?? null,
      pagesScanned: run.pagesScanned ?? null,
      topicsFound: run.topicsFound ?? null,
      topicsCreated: run.topicsCreated ?? null,
      topicsUpdated: run.topicsUpdated ?? null,
      evaluatedCount: run.evaluatedCount ?? null,
      failedCount: run.failedCount ?? null,
      matchedCount: run.matchedCount ?? null,
      logs: run.logs ?? []
    })) as any;
  } catch {
    return [];
  }
}
