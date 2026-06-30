import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const appDir = join(process.cwd(), "app/trae-contest-2026");
const landingPagePath = join(appDir, "page.tsx");
const rankingPagePath = join(appDir, "ranking/page.tsx");
const clientPath = join(appDir, "contest-client.tsx");

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
  assert.match(client, /key: "landing" as const, label: t\.navLanding, href: "\/trae-contest-2026"/);
  assert.match(client, /key: "ranking" as const, label: t\.navRanking, href: "\/trae-contest-2026\/ranking"/);
  assert.match(client, /<Link key={item\.key} href={item\.href}/);
});
