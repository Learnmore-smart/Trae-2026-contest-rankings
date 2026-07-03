import { createHash } from "node:crypto";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { getDataConnectDb, isMissingDataConnectOperationError } from "./dataconnect.ts";
import {
  getBoardData as getBoardDataQuery,
  getBoardPage as getBoardPageQuery,
  getLatestRun,
  getStats,
  getOnlineCount,
  getTopicDetail as getTopicDetailQuery,
  upsertPresence,
  listRuns as listRunsQuery
} from "@trae-contest/dataconnect-generated";
import { dedupeByTopicTitle } from "./dedupe.ts";
import { isDeletedOrEmptyTopic } from "./extractors.ts";
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
  /** Display order for the chosen sort. "desc" (default) = best first; "asc" flips the list. Ranks stay true positions either way. */
  dir?: string | null;
  page?: number;
  pageSize?: number;
  minConfidence?: number | null;
  bypassCache?: boolean | null;
}

const OFFICIAL_TRACKS = ["生活娱乐", "学习工作", "社会服务", "硬件交互", "社会公益"] as const;

function sourceTypeValue(value: unknown): string {
  return typeof value === "string" ? value.toLowerCase() : "";
}

function preliminaryCacheTopics(allTopics: any[]): any[] {
  return allTopics.filter((topic) => sourceTypeValue(topic?.sourceType) === "preliminary");
}

function normalizeOfficialTrack(topic: {
  track?: string | null;
  title?: string | null;
  excerpt?: string | null;
  contentText?: string | null;
  tags?: string[] | null;
}): string | null {
  const tags = Array.isArray(topic.tags) ? topic.tags : [];
  const haystack = [topic.title, topic.excerpt, topic.contentText, topic.track, ...tags]
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    .join(" ");

  for (const track of OFFICIAL_TRACKS) {
    if (haystack.includes(track)) return track;
  }

  if (/教育学习|学习|工作/.test(haystack)) return "学习工作";
  if (/生活服务|社会服务|智慧助老|养老|老人/.test(haystack)) return "社会服务";
  if (/公益/.test(haystack)) return "社会公益";
  if (/硬件|传感器|机器人|设备/.test(haystack)) return "硬件交互";
  if (/创意娱乐|生活娱乐|游戏|娱乐|音乐|影视/.test(haystack)) return "生活娱乐";

  return null;
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
  return { ...safeTopic, track: normalizeOfficialTrack(topic) };
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

function mapTopicRecord(topic: any): TraeTopic {
  return {
    ...topic,
    sourceType: sourceTypeValue(topic.sourceType) as any,
    status: sourceTypeValue(topic.status) as any,
    track: normalizeOfficialTrack(topic),
    competitionLevel: topic.competitionLevel ? (competitionLevelRevMap[topic.competitionLevel as keyof typeof competitionLevelRevMap] ?? topic.competitionLevel) : null,
    evaluatedAt: topic.evaluatedAt ?? null,
    createdAtExternal: topic.createdAtExternal ?? null,
    lastActivityAtExternal: topic.lastActivityAtExternal ?? null
  } as any;
}

function mapEvaluationRecord(evaluation: any): TraeEvaluation | null {
  if (!evaluation) return null;
  return {
    ...evaluation,
    provider: evaluation.provider ? (providerRevMap[evaluation.provider as keyof typeof providerRevMap] ?? evaluation.provider) : null,
    competitionLevel: competitionLevelRevMap[evaluation.competitionLevel as keyof typeof competitionLevelRevMap] ?? evaluation.competitionLevel
  } as any;
}

function mapMatchRecord(match: any): TraeMatch | null {
  if (!match) return null;
  return {
    ...match,
    matchMethod: match.matchMethod ? (match.matchMethod.toLowerCase() as any) : "none",
    mismatchRisk: match.mismatchRisk ? (match.mismatchRisk.toLowerCase() as any) : "unknown"
  } as any;
}

function rankingItemFromRecord(topic: any, lighten = true): RankingItem {
  const evaluation = mapEvaluationRecord(topic.evaluations_on_topic?.[0] ?? null);
  return {
    rank: 0,
    topic: sanitizeTopic(mapTopicRecord(topic)),
    evaluation: lighten ? lightenEvaluation(evaluation) : evaluation,
    match: mapMatchRecord(topic.match_on_preliminaryTopic ?? null)
  };
}

interface BoardData {
  stats: StatsPayload;
  baseItems: RankingItem[];
}

let boardCache: { version: string; data: BoardData } | null = null;
let versionCheckedAt = 0;
const VERSION_TTL_MS = 15_000;
const BOARD_PAGE_SIZE = 1000;

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
  const preliminaryTopics = preliminaryCacheTopics(allTopics);
  const evaluatedCount = preliminaryTopics.filter((topic) => topic.totalScore !== null && topic.totalScore >= 0).length;
  const updatedAtValues = preliminaryTopics
    .flatMap((topic) => [
      topic.updatedAt,
      topic.evaluatedAt,
      topic.evaluations_on_topic?.[0]?.createdAt
    ])
    .filter(Boolean);

  return {
    signupCount: allTopics.filter((topic) => sourceTypeValue(topic?.sourceType) === "signup").length,
    preliminaryCount: preliminaryTopics.length,
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

async function fetchBoardPage(dc: unknown, offset: number): Promise<any[]> {
  const res = await getBoardPageQuery(dc as any, { limit: BOARD_PAGE_SIZE, offset } as any);
  return res.data.topics ?? [];
}

async function fetchLegacyBoardData(dc: unknown): Promise<any[]> {
  const res = await getBoardDataQuery(dc as any);
  return res.data.topics ?? [];
}

async function fetchBoardPages(dc: unknown, totalHint: number): Promise<any[]> {
  try {
    const firstPage = await fetchBoardPage(dc, 0);
    const targetTotal = Math.max(firstPage.length, Math.floor(totalHint));
    const pageCount = Math.max(1, Math.ceil(targetTotal / BOARD_PAGE_SIZE));
    const offsets = Array.from({ length: pageCount - 1 }, (_, index) => (index + 1) * BOARD_PAGE_SIZE);
    const remainingPages = await Promise.all(offsets.map((offset) => fetchBoardPage(dc, offset)));
    return [firstPage, ...remainingPages].flat();
  } catch (error) {
    if (isMissingDataConnectOperationError(error, "GetBoardPage")) {
      console.warn("Data Connect operation GetBoardPage is not deployed; falling back to legacy GetBoardData.");
      return fetchLegacyBoardData(dc);
    }
    throw error;
  }
}

async function buildBoardDataFromSource(): Promise<BoardData> {
  let topTopics: any[] = [];
  let statsRes: any = null;
  let onlineCount = 1;
  let dbFailed = false;

  try {
    const dc = getDataConnectDb();
    statsRes = await getStats(dc as any);
    const totalPreliminary = statsRes.data.preliminaryCount?.[0]?._count ?? 0;
    topTopics = await fetchBoardPages(dc, totalPreliminary);

    const onlineSince = new Date(Date.now() - 2 * 60 * 1000).toISOString();
    const onlineRes = await getOnlineCount(dc as any, { onlineSince } as any);
    onlineCount = onlineRes.data.presences?.[0]?._count ?? 0;
  } catch (dbError) {
    console.error("Database query failed, falling back to local JSON cache:", dbError);
    dbFailed = true;
  }

  let allTopics: any[] = [];
  if (dbFailed) {
    try {
      allTopics = await readTopicsCache();
    } catch (error) {
      console.error("Failed to read topics-cache.json:", error);
    }
  }

  // Hide deleted/empty posts (author removed the post -> re-scrape returns no content):
  // they should not appear on the board at all, graded or not.
  const sourceTopics = (dbFailed ? preliminaryCacheTopics(allTopics) : topTopics).filter(
    (topic) => !isDeletedOrEmptyTopic(topic)
  );
  const stats = dbFailed ? statsPayloadFromCacheTopics(allTopics, 1) : statsPayloadFromResponse(statsRes, onlineCount);
  const baseItems: RankingItem[] = sourceTopics.map((topic) => rankingItemFromRecord(topic));

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

function isGradedRankingItem(item: RankingItem): boolean {
  return typeof item.evaluation?.totalScore === "number" && item.evaluation.totalScore >= 0;
}

function compareSortValueDescending(left: RankingItem, right: RankingItem, sort: string): number {
  const a = sortValue(left, sort);
  const b = sortValue(right, sort);
  if (typeof a === "string" || typeof b === "string") return String(b).localeCompare(String(a));
  return Number(b) - Number(a);
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
  const dir = params.dir === "asc" ? "asc" : "desc";
  const query = params.q?.trim().toLowerCase() ?? "";

  let items: RankingItem[];
  try {
    items = (await getBoardData(params.bypassCache === true)).baseItems;
  } catch (error) {
    return { items: [], total: 0, page: 1, pageSize, sourceUnavailable: true, message: error instanceof Error ? error.message : String(error) };
  }

  if (params.track) items = items.filter((item) => item.topic.track === params.track);
  if (typeof params.minConfidence === "number") {
    items = items.filter((item) => (item.evaluation?.confidenceScore ?? 0) >= params.minConfidence!);
  }

  items.sort((left, right) => {
    const leftGraded = isGradedRankingItem(left);
    const rightGraded = isGradedRankingItem(right);
    if (leftGraded !== rightGraded) return leftGraded ? -1 : 1;
    return compareSortValueDescending(left, right, sort);
  });
  items = dedupeByTopicTitle(items);
  // Assign rank over the full (unsearched) leaderboard, then apply the search filter.
  // This keeps rank meaning true leaderboard position: a search narrows which rows are
  // shown without renumbering them, so a user can't fake a #1 by searching their own work.
  items = items.map((item, index) => ({ ...item, rank: index + 1 }));
  if (query) {
    items = items.filter((item) =>
      `${item.topic.title} ${item.topic.authorName} ${item.topic.excerpt} ${item.topic.tags.join(" ")}`
        .toLowerCase()
        .includes(query)
    );
  }
  if (dir === "asc") {
    const gradedItems = items.filter(isGradedRankingItem).reverse();
    const ungradedItems = items.filter((item) => !isGradedRankingItem(item)).reverse();
    items = [...gradedItems, ...ungradedItems];
  }

  const total = items.length;
  return {
    items: items.slice((page - 1) * pageSize, page * pageSize),
    total,
    page,
    pageSize
  };
}

/**
 * Resolve a preliminary's detail from the committed JSON snapshot. This is the same
 * source the board falls back to, so any work that lists on the board must also open
 * here. Records already carry uppercase enums (PRELIMINARY / NEEDS_JUDGING / ...), so
 * we lowercase them to match the DB-sourced shape. Returns null for unknown ids or
 * non-preliminary posts (a signup id ⇒ "not a preliminary entry").
 */
async function getTopicDetailFromCache(id: string): Promise<RankingItem | null> {
  try {
    const allTopics = await readTopicsCache();
    const t = allTopics.find((item) => item.id === id);
    if (!t || sourceTypeValue(t.sourceType) !== "preliminary") return null;

    const latestEval = t.evaluations_on_topic?.[0];
    const match = t.match_on_preliminaryTopic;

    const mappedTopic: TraeTopic = {
      ...t,
      sourceType: sourceTypeValue(t.sourceType) as any,
      status: sourceTypeValue(t.status) as any,
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

/**
 * Resolve a detail from the exact in-memory data the leaderboard is serving. The board's
 * source chain (live DB → legacy query → committed JSON snapshot) is far broader than the
 * detail query's single lookup, and it stays warm in `boardCache` even through a DB blip.
 * So whenever the direct detail query can't resolve an id, anything currently listed on the
 * board still opens here. This is what keeps "listed ⇒ openable" true for the thousands of
 * works that live only in the DB and never made it into the static snapshot — without it,
 * a transient DB failure (e.g. while a submit/re-scrape is hammering Data Connect) makes a
 * still-listed work render as "作品不存在". The board's evaluation is lightened, but it keeps
 * every field the detail page renders, so a fallback card is complete.
 */
async function getTopicDetailFromBoard(id: string): Promise<RankingItem | null> {
  try {
    const { baseItems } = await getBoardData();
    return baseItems.find((item) => item.topic.id === id) ?? null;
  } catch (error) {
    console.error(`Failed to resolve topic ${id} from board data:`, error);
    return null;
  }
}

export async function getTopicDetail(id: string): Promise<RankingItem | null> {
  try {
    const dc = getDataConnectDb();
    const res = await getTopicDetailQuery(dc as any, { id });
    const t = res.data.topic;
    // DB reachable but this id isn't a stored preliminary — e.g. Data Connect is empty
    // or only partially deployed while the board is served from the JSON snapshot. Try the
    // warm board data first (covers every listed DB-only work), then the snapshot, instead
    // of hard-404ing, so a listed work still opens.
    if (!t || t.sourceType !== "PRELIMINARY") {
      return (await getTopicDetailFromBoard(id)) ?? (await getTopicDetailFromCache(id));
    }

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
    console.error(`Failed to get topic detail for ${id} from DB, checking board data and cache:`, error);
    return (await getTopicDetailFromBoard(id)) ?? (await getTopicDetailFromCache(id));
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
