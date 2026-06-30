import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const appDir = join(process.cwd(), "app");
const landingPagePath = join(appDir, "page.tsx");
const rankingPagePath = join(appDir, "ranking/page.tsx");
const clientPath = join(appDir, "contest-client.tsx");
const runRoutePath = join(process.cwd(), "app/api/trae-contest/run/route.ts");
const dataConnectQueriesPath = join(process.cwd(), "dataconnect/connector/queries.gql");
const traeApiPath = join(process.cwd(), "lib/trae/api.ts");

const read = (path: string) => readFileSync(path, "utf8");

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

test("public run status reports bounded judging batch counts", () => {
  const route = read(runRoutePath);
  const client = read(clientPath);

  assert.match(route, /const judgeResult = await judgeChangedTraeTopics\(\{ mode: "unjudged" \}\);/);
  assert.match(route, /judgeResult\.evaluatedCount/);
  assert.match(route, /judgeResult\.failedCount/);
  assert.match(client, /cooldown \? t\.cooldown : status\?\.message \?\? phaseMessage\(phase, language\)/);
});
