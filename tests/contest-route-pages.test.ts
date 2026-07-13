import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";

import { dedupeByTopicTitle } from "../lib/trae/dedupe.ts";
import { isDeletedOrEmptyTopic } from "../lib/trae/extractors.ts";

const appDir = join(process.cwd(), "app");
const landingPagePath = join(appDir, "page.tsx");
const rankingPagePath = join(appDir, "ranking/page.tsx");
const clientPath = join(appDir, "contest-client.tsx");
const projectPagePath = join(appDir, "project/[id]/page.tsx");
const projectDetailClientPath = join(appDir, "project/project-detail-client.tsx");
const nextConfigPath = join(process.cwd(), "next.config.mjs");
const topicsRoutePath = join(process.cwd(), "app/api/trae-contest/topics/route.ts");
const topicDetailRoutePath = join(process.cwd(), "app/api/trae-contest/topics/[id]/route.ts");
const runRoutePath = join(process.cwd(), "app/api/trae-contest/run/route.ts");
const cronRoutePath = join(process.cwd(), "app/api/trae-contest/cron/[task]/route.ts");
const submitRoutePath = join(process.cwd(), "app/api/trae-contest/submit/route.ts");
const judgePolicyPath = join(process.cwd(), "lib/trae/judge-policy.ts");
const judgePath = join(process.cwd(), "lib/trae/judge.ts");
const topicRouteIdPath = join(process.cwd(), "lib/trae/topic-route-id.ts");
const dataConnectQueriesPath = join(process.cwd(), "dataconnect/connector/queries.gql");
const traeApiPath = join(process.cwd(), "lib/trae/api.ts");
const topicsCachePath = join(process.cwd(), "lib/trae/topics-cache.json");

const read = (path: string) => readFileSync(path, "utf8");
const officialTracks = new Set(["生活娱乐", "学习工作", "社会服务", "硬件交互", "社会公益"]);

test("contest home and ranking have separate app routes", () => {
  assert.ok(existsSync(landingPagePath), "landing route should exist");
  assert.ok(existsSync(rankingPagePath), "ranking route should exist");

  assert.match(read(landingPagePath), /<ContestClient activeTab="landing" \/>/);
  assert.match(read(rankingPagePath), /<ContestClient activeTab="ranking" \/>/);
});

test("contest top-level navigation uses refreshable links", () => {
  const client = read(clientPath);

  assert.doesNotMatch(client, /useState<MainTab>\("landing"\)/);
  assert.match(client, /key: "landing" as const, label: t\.navLanding, href: "\/"/);
  assert.match(client, /key: "ranking" as const, label: t\.navRanking, href: "\/ranking"/);
  assert.match(client, /<Link key={item\.key} href={item\.href}/);
});

test("ranking reload keeps existing rows visible while refreshing", () => {
  const client = read(clientPath);

  assert.match(client, /loading && items\.length === 0 \? \([\s\S]*?<LoadingGrid viewMode=\{viewMode\}[\s\S]*?\/>/);
});

test("ranking filter changes show skeleton rows while the replacement query loads", () => {
  const client = read(clientPath);

  assert.match(client, /const \[loadedQueryString, setLoadedQueryString\] = useState\(""\);/);
  assert.match(client, /setLoadedQueryString\(queryString\);/);
  assert.match(client, /const showQueryChangeSkeleton = loading && queryString !== loadedQueryString;/);
  assert.match(client, /loading && items\.length === 0 \? \([\s\S]*?<LoadingGrid viewMode=\{viewMode\}[\s\S]*?\/>[\s\S]*?\) : showQueryChangeSkeleton \? \(/);
});

test("client API requests default to configured Next base path", () => {
  const client = read(clientPath);
  const nextConfig = read(nextConfigPath);
  const basePath = nextConfig.match(/basePath:\s*"([^"]+)"/)?.[1];

  assert.equal(basePath, "/trae-contest-2026");
  assert.match(client, /const API_BASE = process\.env\.NEXT_PUBLIC_BASE_PATH \?\? "\/trae-contest-2026";/);
});

test("project detail API requests default to configured Next base path", () => {
  const detailClient = read(projectDetailClientPath);
  const nextConfig = read(nextConfigPath);
  const basePath = nextConfig.match(/basePath:\s*"([^"]+)"/)?.[1];

  assert.equal(basePath, "/trae-contest-2026");
  assert.match(detailClient, /const API_BASE = process\.env\.NEXT_PUBLIC_BASE_PATH \?\? "\/trae-contest-2026";/);
  assert.match(detailClient, /fetch\(`\$\{API_BASE\}\/api\/trae-contest\/topics\/\$\{encodeURIComponent\(id\)\}`/);
});

test("project detail route ids strip the RSC suffix from client navigations", async () => {
  const projectPage = read(projectPagePath);
  const topicDetailRoute = read(topicDetailRoutePath);
  const { normalizeTopicRouteId } = await import(pathToFileURL(topicRouteIdPath).href) as typeof import("../lib/trae/topic-route-id.ts");

  assert.equal(normalizeTopicRouteId("preliminary_28589.rsc"), "preliminary_28589");
  assert.equal(normalizeTopicRouteId("preliminary_28589"), "preliminary_28589");
  assert.equal(normalizeTopicRouteId("prefix.rsc.middle"), "prefix.rsc.middle");
  assert.match(projectPage, /import \{ normalizeTopicRouteId \} from "@\/lib\/trae\/topic-route-id";/);
  assert.match(projectPage, /<ProjectDetailClient id=\{normalizeTopicRouteId\(id\)\} \/>/);
  assert.match(topicDetailRoute, /import \{ normalizeTopicRouteId \} from "@\/lib\/trae\/topic-route-id";/);
  assert.match(topicDetailRoute, /getTopicDetail\(normalizeTopicRouteId\(decodeURIComponent\(id\)\)\)/);
});

test("project detail error panel is readable in light and dark themes", () => {
  const detailClient = read(projectDetailClientPath);

  assert.match(detailClient, /bg-white/);
  assert.match(detailClient, /text-rose-900/);
  assert.match(detailClient, /dark:bg-rose-400\/10/);
  assert.match(detailClient, /dark:text-rose-100/);
});

test("ranking error panel is readable in light and dark themes", () => {
  const client = read(clientPath);

  assert.match(client, /role="alert" className="rounded-md border border-rose-300 bg-white p-6 font-semibold text-rose-900 shadow-sm dark:border-rose-300\/25 dark:bg-rose-400\/10 dark:text-rose-100"/);
});

test("project detail does not expose saved AI scoring input and output", () => {
  const detailClient = read(projectDetailClientPath);

  assert.doesNotMatch(detailClient, /const hasInput = Boolean\(systemPrompt \|\| promptText\);/);
  assert.doesNotMatch(detailClient, /const hasIo = Boolean\(hasInput \|\| rawOutput\);/);
  assert.doesNotMatch(detailClient, /function CodeBlock/);
  assert.doesNotMatch(detailClient, /systemPromptLabel|userPromptLabel|rawOutputLabel|aiIoTitle/);
  assert.doesNotMatch(detailClient, /rawModelResponse/);
});

test("project detail re-score starts with a non-blocking toast", () => {
  const detailClient = read(projectDetailClientPath);

  assert.doesNotMatch(detailClient, /window\.confirm/);
  assert.doesNotMatch(detailClient, /rejudgeConfirm/);
  assert.match(detailClient, /rejudgeStarted: "评分已经开始，请耐心等待"/);
  assert.match(detailClient, /setRejudgeNotice\(\{ tone: "info", text: t\.rejudgeStarted \}\);/);
  assert.match(detailClient, /className=\{`fixed right-4 top-4 z-50/);
  // Success path must refresh detail after an awaited POST completes (done), not only via poll.
  assert.match(detailClient, /payload\?\.ok && \(payload\.done \|\| !payload\.started\)/);
  assert.match(detailClient, /await refreshTopicDetail\(\)/);
});

test("topic rejudge awaits scoring instead of fire-and-forget background work", () => {
  const rejudgeRoute = read(join(process.cwd(), "app/api/trae-contest/topics/[id]/rejudge/route.ts"));

  // Cloud Run throttles CPU after the response; void background rejudge is a no-op in production.
  assert.match(rejudgeRoute, /export const maxDuration = 900;/);
  assert.match(rejudgeRoute, /await rejudgeTopicById\(id\)/);
  assert.doesNotMatch(rejudgeRoute, /void runRejudgeInBackground/);
  assert.doesNotMatch(rejudgeRoute, /maxDuration = 60/);
  assert.match(rejudgeRoute, /done: true/);
});

test("data connect nested topic reads stay below deadline-prone size", () => {
  const queries = read(dataConnectQueriesPath);
  const boardQuery = queries.match(/query GetBoardData[\s\S]*?\n}/)?.[0] ?? "";
  const topicsBySourceQuery = queries.match(/query GetTopicsBySourceType[\s\S]*?\n}/)?.[0] ?? "";
  const limits = [boardQuery, topicsBySourceQuery]
    .flatMap((section) => [...section.matchAll(/topics\([\s\S]*?limit:\s*(\d+)/g)].map((match) => Number(match[1])));

  assert.ok(limits.length >= 2, "expected board and topic-pool queries to declare limits");
  assert.ok(limits.every((limit) => limit <= 1000), `nested topic query limits should avoid 300s deadlines, got ${limits.join(", ")}`);
});

test("public ranking uses bounded server pages instead of a 1000-row client page", () => {
  const client = read(clientPath);

  assert.match(client, /const DEFAULT_RANKING_PAGE_SIZE = 50;/);
  assert.match(client, /const \[page, setPage\] = useState\(1\);/);
  assert.match(client, /const \[pageSize, setPageSize\] = useState\(DEFAULT_RANKING_PAGE_SIZE\);/);
  assert.match(client, /new URLSearchParams\(\{ page: String\(page\), pageSize: String\(pageSize\), sort, dir: sortDir \}\)/);
  assert.doesNotMatch(client, /pageSize: "1000"/);
  assert.match(client, /aria-label=\{t\.previousPage\}/);
  assert.match(client, /aria-label=\{t\.nextPage\}/);
});

test("public ranking exposes selectable page size and sort direction", () => {
  const client = read(clientPath);
  const route = read(topicsRoutePath);

  assert.match(client, /const RANKING_PAGE_SIZE_OPTIONS = \[25, 50, 100, 200\] as const;/);
  assert.match(client, /type SortDirection = "desc" \| "asc";/);
  assert.match(client, /const \[sortDir, setSortDir\] = useState<SortDirection>\("desc"\);/);
  assert.match(client, /const pageSizeOptions = RANKING_PAGE_SIZE_OPTIONS\.map\(\(value\) => \(\{ value: String\(value\), label: `\$\{fmtInteger\(value, language\)\}` \}\)\);/);
  assert.match(client, /label=\{t\.pageSize\}/);
  assert.match(client, /label=\{t\.sortDirection\}/);
  assert.match(client, /onChange=\{\(value\) => \{\s*setPage\(1\);\s*setPageSize\(Number\(value\)\);\s*\}\}/);
  assert.match(client, /onChange=\{\(value\) => \{\s*setPage\(1\);\s*setSortDir\(value as SortDirection\);\s*\}\}/);
  assert.match(route, /dir: searchParams\.get\("dir"\),/);
});

test("public ranking page switch is visible text, not icon-only", () => {
  const client = read(clientPath);

  assert.match(client, /className="ranking-page-switch"/);
  assert.match(client, /className="ranking-page-switch__label" aria-live="polite"/);
  assert.match(client, /className="ranking-page-switch__text">\{t\.previousPage\}/);
  assert.match(client, /className="ranking-page-switch__text">\{t\.nextPage\}/);
});

test("Data Connect board reads can page beyond the first 1000 topics", () => {
  const queries = read(dataConnectQueriesPath);
  const traeApi = read(traeApiPath);

  assert.match(queries, /query GetBoardPage\(\$limit: Int!, \$offset: Int!\)/);
  assert.match(queries, /limit: \$limit/);
  assert.match(queries, /offset: \$offset/);
  assert.match(traeApi, /getBoardPage as getBoardPageQuery/);
  assert.match(traeApi, /getBoardData as getBoardDataQuery/);
  assert.match(traeApi, /const BOARD_PAGE_SIZE = 1000;/);
  assert.match(traeApi, /async function fetchBoardPages/);
  assert.match(traeApi, /getBoardPageQuery\(dc as any, \{ limit: BOARD_PAGE_SIZE, offset \}/);
  assert.match(traeApi, /isMissingDataConnectOperationError\(error, "GetBoardPage"\)/);
  assert.match(traeApi, /getBoardDataQuery\(dc as any\)/);
});

test("judge candidate reads can page beyond the first 1000 topics", () => {
  const judge = read(judgePath);

  assert.match(judge, /getBoardPage as getBoardPageQuery/);
  assert.match(judge, /getBoardData as getBoardDataQuery/);
  assert.match(judge, /const JUDGE_BOARD_PAGE_SIZE = 1000;/);
  assert.match(judge, /async function fetchJudgeBoardPages/);
  assert.match(judge, /getBoardPageQuery\(dc as any, \{ limit: JUDGE_BOARD_PAGE_SIZE, offset \}/);
  assert.match(judge, /isMissingDataConnectOperationError\(error, "GetBoardPage"\)/);
  assert.match(judge, /getBoardDataQuery\(dc as any\)/);
});

test("ranking and judge candidates filter duplicate topic titles server-side", () => {
  const traeApi = read(traeApiPath);
  const judge = read(judgePath);

  assert.match(traeApi, /import \{ dedupeByTopicTitle \} from "\.\/dedupe\.ts";/);
  assert.match(traeApi, /items = dedupeByTopicTitle\(items\);[\s\S]*?items = items\.map/);
  assert.match(judge, /import \{ dedupeByTopicTitle \} from "\.\/dedupe\.ts";/);
  assert.match(judge, /const filtered = dedupeByTopicTitle\(mapped\)[\s\S]*?\.filter/);
});

test("deleted or empty topics are hidden from ranking and skipped by judge", () => {
  const traeApi = read(traeApiPath);
  const judge = read(judgePath);

  assert.match(traeApi, /import \{ isDeletedOrEmptyTopic \} from "\.\/extractors\.ts";/);
  assert.match(traeApi, /const sourceTopics = \(dbFailed \? preliminaryCacheTopics\(allTopics\) : topTopics\)\.filter\(/);
  assert.match(traeApi, /!isDeletedOrEmptyTopic\(topic\)/);
  assert.match(judge, /import \{ isDeletedOrEmptyTopic \} from "\.\/extractors\.ts";/);
  assert.match(judge, /dedupeByTopicTitle\(mapped\)[\s\S]*?\.filter\(\(\{ topic \}\) => !isDeletedOrEmptyTopic\(topic\)\)/);
});

test("stats load path is independent from ranking topic list", () => {
  const client = read(clientPath);
  const traeApi = read(traeApiPath);

  assert.doesNotMatch(client, /Promise\.all\(\[\s*fetch\("\/api\/trae-contest\/stats"/);
  assert.match(client, /const statsRequest = fetch\(`\$\{API_BASE\}\/api\/trae-contest\/stats`/);
  assert.match(client, /setStats\(statsPayload\)/);
  assert.doesNotMatch(traeApi, /export async function getTraeStats\(\): Promise<StatsPayload> \{\s*try \{\s*return \(await getBoardData\(\)\)\.stats;/);
  assert.match(traeApi, /async function buildStatsFromSource\(\): Promise<StatsPayload>/);
});

test("ranking topics fall back to local cache when Data Connect is unconfigured", async () => {
  const envKeys = [
    "FIREBASE_SERVICE_ACCOUNT_KEY",
    "GOOGLE_APPLICATION_CREDENTIALS",
    "FIREBASE_CONFIG",
    "GCLOUD_PROJECT",
    "GOOGLE_CLOUD_PROJECT",
    "FIREBASE_PROJECT_ID"
  ];
  const previousEnv = new Map(envKeys.map((key) => [key, process.env[key]]));
  const originalConsoleError = console.error;
  for (const key of envKeys) delete process.env[key];

  try {
    console.error = () => undefined;
    const moduleUrl = `${pathToFileURL(traeApiPath).href}?fallback-test=${Date.now()}`;
    const { listRankedTopics } = await import(moduleUrl) as typeof import("../lib/trae/api.ts");
    const payload = await listRankedTopics({ page: 1, pageSize: 3, sort: "total", bypassCache: true });

    assert.equal(payload.sourceUnavailable, undefined);
    assert.ok(payload.total > 0, "expected cached topics to be available without Data Connect credentials");
    assert.ok(payload.items.length > 0, "expected first cached ranking page to include rows");
  } finally {
    for (const [key, value] of previousEnv) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    console.error = originalConsoleError;
  }
});

test("ranking ascending score order keeps ungraded rows after graded rows", async () => {
  const envKeys = [
    "FIREBASE_SERVICE_ACCOUNT_KEY",
    "GOOGLE_APPLICATION_CREDENTIALS",
    "FIREBASE_CONFIG",
    "GCLOUD_PROJECT",
    "GOOGLE_CLOUD_PROJECT",
    "FIREBASE_PROJECT_ID"
  ];
  const previousEnv = new Map(envKeys.map((key) => [key, process.env[key]]));
  const originalConsoleError = console.error;
  for (const key of envKeys) delete process.env[key];

  try {
    console.error = () => undefined;
    const moduleUrl = `${pathToFileURL(traeApiPath).href}?graded-first-asc-test=${Date.now()}`;
    const { listRankedTopics } = await import(moduleUrl) as typeof import("../lib/trae/api.ts");
    const payload = await listRankedTopics({ page: 1, pageSize: 1000, sort: "total", dir: "asc", bypassCache: true });
    const isGraded = (item: (typeof payload.items)[number]) => typeof item.evaluation?.totalScore === "number" && item.evaluation.totalScore >= 0;
    const firstUngradedIndex = payload.items.findIndex((item) => !isGraded(item));
    const lastGradedIndex = payload.items.findLastIndex(isGraded);

    assert.ok(lastGradedIndex >= 0, "expected ascending page to include graded rows before pending rows");
    assert.ok(firstUngradedIndex >= 0, "expected ascending page to include pending rows after graded rows");
    assert.ok(lastGradedIndex < firstUngradedIndex, "graded rows should come before ungraded rows even in ascending order");
  } finally {
    for (const [key, value] of previousEnv) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    console.error = originalConsoleError;
  }
});

test("ranking fallback rows are preliminary-only and use official track labels", async () => {
  type CachedTopic = {
    sourceType?: string;
    title?: string;
    contentText?: string | null;
    demoUrl?: string | null;
    imageUrls?: unknown;
    sessionIds?: unknown;
  };
  const cachedTopics = JSON.parse(read(topicsCachePath)) as CachedTopic[];
  const expectedPreliminaryCount = dedupeByTopicTitle(
    cachedTopics
      .filter((topic) => topic.sourceType === "PRELIMINARY")
      .filter((topic) => !isDeletedOrEmptyTopic(topic))
      .map((topic) => ({ topic: { title: topic.title ?? "" } }))
  ).length;
  const envKeys = [
    "FIREBASE_SERVICE_ACCOUNT_KEY",
    "GOOGLE_APPLICATION_CREDENTIALS",
    "FIREBASE_CONFIG",
    "GCLOUD_PROJECT",
    "GOOGLE_CLOUD_PROJECT",
    "FIREBASE_PROJECT_ID"
  ];
  const previousEnv = new Map(envKeys.map((key) => [key, process.env[key]]));
  const originalConsoleError = console.error;
  for (const key of envKeys) delete process.env[key];

  try {
    console.error = () => undefined;
    const moduleUrl = `${pathToFileURL(traeApiPath).href}?official-track-fallback-test=${Date.now()}`;
    const { listRankedTopics } = await import(moduleUrl) as typeof import("../lib/trae/api.ts");
    const payload = await listRankedTopics({ page: 1, pageSize: 1000, sort: "total", bypassCache: true });

    assert.equal(payload.total, expectedPreliminaryCount);
    assert.equal(payload.items.length, expectedPreliminaryCount);
    assert.deepEqual(
      payload.items
        .filter((item) => item.topic.sourceType !== "preliminary" || (item.topic.track !== null && !officialTracks.has(item.topic.track)))
        .map((item) => ({ id: item.topic.id, sourceType: item.topic.sourceType, track: item.topic.track })),
      []
    );
    assert.ok(payload.items.some((item) => item.topic.track === "学习工作"), "expected legacy education/work labels to normalize");
    assert.ok(payload.items.some((item) => item.topic.track === "社会公益"), "expected legacy public-good labels to normalize");
  } finally {
    for (const [key, value] of previousEnv) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    console.error = originalConsoleError;
  }
});

test("ranking stats fall back to local cache when Data Connect is unconfigured", async () => {
  type CachedTopic = {
    sourceType?: string;
    totalScore?: number | null;
  };
  const cachedTopics = JSON.parse(read(topicsCachePath)) as CachedTopic[];
  const expectedPreliminaryCount = cachedTopics.filter((topic) => topic.sourceType === "PRELIMINARY").length;
  const expectedEvaluatedCount = cachedTopics.filter((topic) => topic.sourceType === "PRELIMINARY" && typeof topic.totalScore === "number" && topic.totalScore >= 0).length;
  const envKeys = [
    "FIREBASE_SERVICE_ACCOUNT_KEY",
    "GOOGLE_APPLICATION_CREDENTIALS",
    "FIREBASE_CONFIG",
    "GCLOUD_PROJECT",
    "GOOGLE_CLOUD_PROJECT",
    "FIREBASE_PROJECT_ID"
  ];
  const previousEnv = new Map(envKeys.map((key) => [key, process.env[key]]));
  const originalConsoleError = console.error;
  for (const key of envKeys) delete process.env[key];

  try {
    console.error = () => undefined;
    const moduleUrl = `${pathToFileURL(traeApiPath).href}?stats-fallback-test=${Date.now()}`;
    const { getTraeStats } = await import(moduleUrl) as typeof import("../lib/trae/api.ts");
    const stats = await getTraeStats();

    assert.equal(stats.sourceUnavailable, undefined);
    assert.equal(stats.preliminaryCount, expectedPreliminaryCount);
    assert.equal(stats.evaluatedCount, expectedEvaluatedCount);
  } finally {
    for (const [key, value] of previousEnv) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    console.error = originalConsoleError;
  }
});

test("live board data uses Data Connect topics instead of bundled cache as base", () => {
  const traeApi = read(traeApiPath);

  assert.match(traeApi, /const sourceTopics = \(dbFailed \? preliminaryCacheTopics\(allTopics\) : topTopics\)\.filter\(/);
  assert.match(traeApi, /!isDeletedOrEmptyTopic\(topic\)/);
  assert.doesNotMatch(
    traeApi,
    /if \(dbFailed\) \{[\s\S]*?return \{ stats, baseItems \};[\s\S]*?const baseItems: RankingItem\[\] = allTopics\.map/
  );
});

test("public run status reports bounded judging batch counts", () => {
  const route = read(runRoutePath);
  const pipeline = read(join(process.cwd(), "lib/trae/pipeline.ts"));
  const client = read(clientPath);
  const judgePolicy = read(judgePolicyPath);

  assert.match(judgePolicy, /export const DEFAULT_JUDGE_BATCH_MAX = 4000;/);
  assert.match(judgePolicy, /export const DEFAULT_JUDGE_CONCURRENCY = 8;/);
  // Pipeline module owns the scrape/match/judge flow now; POST /run fire-and-forgets it.
  assert.match(route, /import \{ runFullPipeline \} from "@\/lib\/trae\/pipeline";/);
  assert.match(route, /startPipeline\(state\)/);
  assert.match(pipeline, /await scrapeAllTraeSources\(\);/);
  assert.match(pipeline, /await runTraeMatching\(MATCH_DEADLINE_MS\);/);
  assert.match(
    pipeline,
    /judgeChangedTraeTopics\(\{[\s\S]*?mode: "changed",[\s\S]*?deadlineMs: JUDGE_DEADLINE_MS[\s\S]*?\}\)/
  );
  assert.match(pipeline, /await Promise\.all\(\[scrapeAndMatch, firstJudge\]\);/);
  assert.match(pipeline, /evaluatedCount/);
  assert.match(pipeline, /failedCount/);
  assert.match(client, /setStatus\(\{ running: true, phase: "judge", startedAt: null, finishedAt: null, message: t\.judging, error: null \}\);/);
  assert.match(client, /status\?\.message \?\? phaseMessage\(phase, language\)/);
  assert.match(client, /phase === "error" && status\?\.error/);
});

test("public run button works across Cloud Run instances", () => {
  const route = read(runRoutePath);
  const client = read(clientPath);
  const runsHelper = read(join(process.cwd(), "lib/trae/runs.ts"));
  const cronRoute = read(cronRoutePath);
  const pipeline = read(join(process.cwd(), "lib/trae/pipeline.ts"));

  // POST fire-and-forgets runFullPipeline() directly — no HTTP self-invoke. Works on Cloud Run
  // because cpu-throttling=false keeps background work at full CPU after the response is sent.
  assert.match(route, /import \{ runFullPipeline \} from "@\/lib\/trae\/pipeline";/);
  assert.match(route, /startPipeline\(state\)/);
  assert.match(route, /void runFullPipeline\(\)/);
  // No self-invoke mechanism anymore — it was unreliable on loopback (basePath 404).
  assert.doesNotMatch(route, /buildCronRunAllUrl/);
  assert.doesNotMatch(route, /invokeCronRunAll/);
  assert.doesNotMatch(route, /127\.0\.0\.1/);

  // GET/POST must derive cross-instance status from fresh RUNNING rows only, and reclaim
  // zombie forever-RUNNING batches left by killed Cloud Run requests.
  assert.match(runsHelper, /export const STALE_RUNNING_RUN_MS = 15 \* 60 \* 1000;/);
  assert.match(runsHelper, /export function isFreshRunningRun/);
  assert.match(runsHelper, /export async function reclaimStaleRunningRuns/);
  assert.match(route, /isFreshRunningRun/);
  assert.match(route, /reclaimStaleRunningRuns/);
  assert.match(route, /statusFromRuns\(/);
  assert.match(route, /listRuns\(/);

  // POST must honor a run already in flight elsewhere (no double start). No cooldown.
  assert.match(route, /if \(dbStatus\?\.running\) \{\s*return NextResponse\.json\(dbStatus\);/);

  // Cron skip guard must reclaim zombies and only skip on fresh RUNNING judges.
  assert.match(cronRoute, /reclaimStaleRunningRuns/);
  assert.match(cronRoute, /isFreshRunningRun\(run\)/);

  // Pipeline must bound each judge pass (not the full 690s default × 2), and reclaimed
  // zombies surface as retryable timeout copy — not the raw reclaim string.
  assert.match(pipeline, /JUDGE_DEADLINE_MS = 300_000/);
  assert.match(pipeline, /deadlineMs: JUDGE_DEADLINE_MS/);
  assert.match(pipeline, /BUDGET_MS = 840_000/);
  assert.match(pipeline, /skipping second judge pass/);
  assert.match(route, /Reclaimed stale RUNNING run/);
  assert.match(route, /上一轮评分超时中断/);

  // The client keeps polling through the start-up window instead of settling on the first
  // "not running" poll before the run's first RUNNING row is visible.
  assert.match(client, /const RUN_START_GRACE_MS = 15_000;/);
  assert.match(client, /graceUntilRef\.current = Date\.now\(\) \+ RUN_START_GRACE_MS;/);
  assert.match(client, /if \(!next\.running && Date\.now\(\) < graceUntilRef\.current\) return;/);
  // Poll starts on click (not only after POST body); silent idle is surfaced as error.
  assert.match(client, /startPolling\(\);\s*try \{/);
  assert.match(client, /!next\.running && next\.phase === "idle"/);
});

test("cron judge tasks rejudge changed topics, not only unjudged topics", () => {
  const route = read(cronRoutePath);
  const pipeline = read(join(process.cwd(), "lib/trae/pipeline.ts"));

  assert.match(route, /task === "judge"[\s\S]*?judgeChangedTraeTopics\(\{ mode: "changed"/);
  // run-all delegates to runFullPipeline which internally uses mode: "changed".
  assert.match(route, /task === "run-all"[\s\S]*?runFullPipeline\(/);
  assert.match(pipeline, /judgeChangedTraeTopics\(\{[\s\S]*?mode: "changed"/);
  assert.doesNotMatch(route, /judgeChangedTraeTopics\(\{ mode: "unjudged" \}\)/);
  assert.doesNotMatch(pipeline, /mode: "unjudged"/);
});

test("topic detail falls back to local cache when Data Connect returns no row", async () => {
  type CachedTopic = { id?: string; sourceType?: string };
  const cachedTopics = JSON.parse(read(topicsCachePath)) as CachedTopic[];
  const preliminaryId = cachedTopics.find((topic) => topic.sourceType === "PRELIMINARY")?.id;
  const signupId = cachedTopics.find((topic) => topic.sourceType === "SIGNUP")?.id;
  assert.ok(preliminaryId, "expected a cached preliminary topic to exercise the fallback");
  assert.ok(signupId, "expected a cached signup topic to exercise the non-preliminary guard");

  const envKeys = [
    "FIREBASE_SERVICE_ACCOUNT_KEY",
    "GOOGLE_APPLICATION_CREDENTIALS",
    "FIREBASE_CONFIG",
    "GCLOUD_PROJECT",
    "GOOGLE_CLOUD_PROJECT",
    "FIREBASE_PROJECT_ID"
  ];
  const previousEnv = new Map(envKeys.map((key) => [key, process.env[key]]));
  const originalConsoleError = console.error;
  for (const key of envKeys) delete process.env[key];

  try {
    console.error = () => undefined;
    const moduleUrl = `${pathToFileURL(traeApiPath).href}?detail-fallback-test=${Date.now()}`;
    const { getTopicDetail } = await import(moduleUrl) as typeof import("../lib/trae/api.ts");

    const detail = await getTopicDetail(preliminaryId!);
    assert.ok(detail, "cached preliminary should resolve to a detail payload, not 404");
    assert.equal(detail!.topic.id, preliminaryId);
    assert.equal(detail!.topic.sourceType, "preliminary");

    assert.equal(await getTopicDetail(signupId!), null, "a signup id is not a preliminary entry");
    assert.equal(await getTopicDetail("does-not-exist"), null, "unknown ids stay 404");
  } finally {
    for (const [key, value] of previousEnv) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    console.error = originalConsoleError;
  }
});

test("topic detail resolves from the live board data before the static snapshot", () => {
  const traeApi = read(traeApiPath);

  // The board lists thousands of DB-only works that never made it into topics-cache.json.
  // If the detail query misses or the DB blips, we must reach for that same warm board data
  // (which shares the board's DB -> legacy -> snapshot chain) before the tiny static cache,
  // or a still-listed work renders as "不存在".
  assert.match(
    traeApi,
    /async function getTopicDetailFromBoard\(id: string\): Promise<RankingItem \| null> \{[\s\S]*?const \{ baseItems \} = await getBoardData\(\);[\s\S]*?baseItems\.find\(\(item\) => item\.topic\.id === id\)/,
    "getTopicDetailFromBoard should resolve an id from the board's in-memory baseItems"
  );
  // Both recovery paths (non-preliminary/missing row, and a thrown DB error) must try the
  // board first, then the snapshot.
  assert.match(
    traeApi,
    /if \(!t \|\| t\.sourceType !== "PRELIMINARY"\) \{\s*return \(await getTopicDetailFromBoard\(id\)\) \?\? \(await getTopicDetailFromCache\(id\)\);/,
    "the missing/non-preliminary branch should fall back to board data then cache"
  );
  assert.match(
    traeApi,
    /catch \(error\) \{[\s\S]*?return \(await getTopicDetailFromBoard\(id\)\) \?\? \(await getTopicDetailFromCache\(id\)\);\s*\}\s*\}/,
    "the DB-error catch should fall back to board data then cache"
  );
});

test("public user topic submit only accepts TRAE forum links and refreshes the board", () => {
  const client = read(clientPath);

  assert.ok(existsSync(submitRoutePath), "submit route should exist");
  const route = read(submitRoutePath);

  assert.match(route, /export function GET/);
  assert.match(route, /__traeTopicSubmit/);
  assert.match(route, /void runSubmittedTopic/);
  assert.match(route, /parseTraeForumTopicUrl/);
  assert.match(route, /fetchTopic\("preliminary", ref, \{ requirePreliminaryCategory: true \}\)/);
  assert.match(route, /upsertTopic\(topic\)/);
  assert.match(route, /writeBoardSnapshot\(\)/);
  assert.match(route, /status: 400/);

  assert.match(client, /function UserTopicSubmit/);
  assert.match(client, /fetch\(`\$\{API_BASE\}\/api\/trae-contest\/submit`, \{ cache: "no-store" \}\)/);
  assert.match(client, /fetch\(`\$\{API_BASE\}\/api\/trae-contest\/submit`/);
  assert.match(client, /<UserTopicSubmit language=\{language\} onSubmitted=\{load\} \/>/);
});
