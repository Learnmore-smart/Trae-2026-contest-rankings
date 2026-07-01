import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";

const appDir = join(process.cwd(), "app");
const landingPagePath = join(appDir, "page.tsx");
const rankingPagePath = join(appDir, "ranking/page.tsx");
const clientPath = join(appDir, "contest-client.tsx");
const projectDetailClientPath = join(appDir, "project/project-detail-client.tsx");
const nextConfigPath = join(process.cwd(), "next.config.mjs");
const runRoutePath = join(process.cwd(), "app/api/trae-contest/run/route.ts");
const judgePolicyPath = join(process.cwd(), "lib/trae/judge-policy.ts");
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

  assert.match(client, /loading && items\.length === 0 \? \([\s\S]*?<LoadingGrid viewMode={viewMode} \/>/);
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

test("data connect nested topic reads stay below deadline-prone size", () => {
  const queries = read(dataConnectQueriesPath);
  const boardQuery = queries.match(/query GetBoardData[\s\S]*?\n}/)?.[0] ?? "";
  const topicsBySourceQuery = queries.match(/query GetTopicsBySourceType[\s\S]*?\n}/)?.[0] ?? "";
  const limits = [boardQuery, topicsBySourceQuery]
    .flatMap((section) => [...section.matchAll(/topics\([\s\S]*?limit:\s*(\d+)/g)].map((match) => Number(match[1])));

  assert.ok(limits.length >= 2, "expected board and topic-pool queries to declare limits");
  assert.ok(limits.every((limit) => limit <= 1000), `nested topic query limits should avoid 300s deadlines, got ${limits.join(", ")}`);
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

test("ranking fallback rows are preliminary-only and use official track labels", async () => {
  type CachedTopic = {
    sourceType?: string;
  };
  const cachedTopics = JSON.parse(read(topicsCachePath)) as CachedTopic[];
  const expectedPreliminaryCount = cachedTopics.filter((topic) => topic.sourceType === "PRELIMINARY").length;
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

  assert.match(traeApi, /const sourceTopics = dbFailed \? preliminaryCacheTopics\(allTopics\) : topTopics;/);
  assert.doesNotMatch(
    traeApi,
    /if \(dbFailed\) \{[\s\S]*?return \{ stats, baseItems \};[\s\S]*?const baseItems: RankingItem\[\] = allTopics\.map/
  );
});

test("public run status reports bounded judging batch counts", () => {
  const route = read(runRoutePath);
  const client = read(clientPath);
  const judgePolicy = read(judgePolicyPath);

  assert.match(judgePolicy, /export const DEFAULT_JUDGE_BATCH_MAX = 48;/);
  assert.match(judgePolicy, /export const DEFAULT_JUDGE_CONCURRENCY = 8;/);
  assert.match(route, /import \{ DEFAULT_JUDGE_BATCH_MAX, DEFAULT_JUDGE_CONCURRENCY \} from "@\/lib\/trae\/judge-policy";/);
  assert.doesNotMatch(route, /const PUBLIC_JUDGE_MAX =/);
  assert.doesNotMatch(route, /const PUBLIC_JUDGE_CONCURRENCY =/);
  assert.match(route, /await scrapeAllTraeSources\(\);/);
  assert.match(route, /await runTraeMatching\(\);/);
  assert.match(route, /return judgeChangedTraeTopics\(\{\s*mode: "unjudged",\s*max: DEFAULT_JUDGE_BATCH_MAX,\s*concurrency: DEFAULT_JUDGE_CONCURRENCY\s*\}\);/);
  assert.match(route, /const immediateJudge = judgeUnjudgedBatch\(\);/);
  assert.match(route, /const postMatchJudgeResult = await judgeUnjudgedBatch\(\);/);
  assert.match(route, /await Promise\.all\(\[scrapeAndMatch, immediateJudge\]\);/);
  assert.match(route, /judgeResult\.evaluatedCount/);
  assert.match(route, /judgeResult\.failedCount/);
  assert.match(client, /setStatus\(\{ running: true, phase: "judge", startedAt: null, finishedAt: null, message: t\.judging, error: null \}\);/);
  assert.match(client, /cooldown \? t\.cooldown : status\?\.message \?\? phaseMessage\(phase, language\)/);
  assert.match(client, /phase === "error" && status\?\.error/);
});
