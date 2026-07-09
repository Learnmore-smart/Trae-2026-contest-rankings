import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const component = readFileSync(join(process.cwd(), "app/contest-client.tsx"), "utf8");
const globalCss = readFileSync(join(process.cwd(), "app/globals.css"), "utf8");
const contestCssPath = join(process.cwd(), "app/contest.css");
const contestCss = existsSync(contestCssPath) ? readFileSync(contestCssPath, "utf8") : "";
const css = `${globalCss}\n${contestCss}`;
const themePath = join(process.cwd(), "app/theme.css");
const theme = existsSync(themePath) ? readFileSync(themePath, "utf8") : "";

test("landing hero exposes the command-center layout hooks", () => {
  assert.match(component, /className="[^"]*\btech-shell\b[^"]*"/);
  assert.match(component, /className="contest-official-banner"/);
  assert.match(component, /src=\{`\$\{API_BASE\}\/Banner-Trae-contest-2026\.jpg`\}/);
  assert.match(component, /alt="TRAE AI Creativity Contest official banner"/);
  assert.match(component, /className="landing-hero-copy"/);
  assert.match(component, /className="landing-hero-title/);
  assert.match(component, /className="landing-hero-side"/);
  assert.match(component, /className="hero-command-deck"/);
  assert.match(component, /className="hero-signal-strip"/);
  assert.match(component, /className="telemetry-grid"/);
  assert.match(component, /className="hero-actions"/);
  assert.doesNotMatch(component, /className="purpose-progress"/);
  assert.match(component, /className="ranking-command-shell"/);
});

test("landing hero CSS renders a command deck with a right-side control rail", () => {
  assert.match(css, /\.landing-hero\s*{[\s\S]*?align-items:\s*start;/);
  assert.match(css, /\.contest-official-banner\s*{[\s\S]*?aspect-ratio:\s*5\s*\/\s*1;/);
  assert.match(css, /\.contest-official-banner img\s*{[\s\S]*?object-fit:\s*cover;/);
  assert.match(css, /\.hero-command-deck\s*{[\s\S]*?display:\s*grid;/);
  assert.match(css, /\.hero-signal-strip\s*{[\s\S]*?grid-template-columns:\s*repeat\(3, minmax\(0, 1fr\)\);/);
  assert.match(css, /\.landing-hero-side\s*{[\s\S]*?grid-column:\s*2;/);
  assert.match(css, /\.landing-hero-side\s*{[\s\S]*?align-self:\s*start;/);
  assert.match(css, /\.telemetry-grid\s*{[\s\S]*?grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\);/);
  assert.match(css, /\.hero-actions\s*{[\s\S]*?justify-content:\s*flex-start;/);
});

test("tech shell keeps a single-column mobile fallback", () => {
  assert.match(css, /@media \(max-width: 768px\)\s*{[\s\S]*?\.landing-hero-side\s*{[\s\S]*?grid-column:\s*1;/);
  assert.match(css, /@media \(max-width: 768px\)\s*{[\s\S]*?\.hero-signal-strip\s*{[\s\S]*?grid-template-columns:\s*1fr;/);
  assert.match(css, /@media \(max-width: 768px\)\s*{[\s\S]*?\.telemetry-grid\s*{[\s\S]*?grid-template-columns:\s*1fr;/);
});

test("mobile nav and hero rules prevent horizontal overflow", () => {
  assert.match(component, /className="nav-metrics__detail/);
  assert.match(css, /html,\s*body\s*{[\s\S]*?overflow-x:\s*hidden;/);
  assert.match(css, /@media \(max-width: 768px\)\s*{[\s\S]*?\.site-nav\s*{[\s\S]*?max-width:\s*100vw;[\s\S]*?overflow-x:\s*hidden;/);
  assert.match(css, /@media \(max-width: 768px\)\s*{[\s\S]*?\.brand-code\s*{[\s\S]*?display:\s*none;/);
  assert.match(css, /@media \(max-width: 768px\)\s*{[\s\S]*?\.nav-metrics__detail\s*{[\s\S]*?display:\s*inline;/);
  assert.match(css, /@media \(max-width: 768px\)\s*{[\s\S]*?\.landing-hero-title\s*{[\s\S]*?font-size:\s*clamp\(/);
  assert.match(css, /@media \(max-width: 768px\)\s*{[\s\S]*?\.landing-hero-title\s*{[\s\S]*?overflow-wrap:\s*anywhere;/);
  assert.match(css, /@media \(max-width: 768px\)\s*{[\s\S]*?\.hero-actions \.control-button\s*{[\s\S]*?width:\s*100%;/);
});

test("contest theme is split into a light-mode theme file", () => {
  assert.ok(existsSync(themePath), "app/theme.css should exist");
  assert.match(css, /@import "\.\/theme\.css";/);
  assert.match(theme, /color-scheme:\s*light;/);
  assert.match(theme, /--page-bg:/);
  assert.match(theme, /--ink:/);
});

test("ranking list uses row layout hooks and score stats", () => {
  assert.match(component, /function ScoreRing/);
  assert.match(component, /className="score-stat/);
  assert.match(component, /"ranking-list"/);
  assert.match(component, /className=\{`rank-row/);
  assert.match(component, /className="ranking-inline-meta"/);

  assert.match(css, /\.ranking-list\s*{[\s\S]*?display:\s*grid;/);
  assert.match(css, /\.rank-row\s*{[\s\S]*?grid-template-columns:/);
  assert.match(css, /\.score-stat\s*{[\s\S]*?display:\s*grid;/);
  assert.doesNotMatch(component, /className="ranking-result-strip"/);
});

test("ranking rows keep the text column from collapsing", () => {
  assert.match(css, /\.rank-row\s*{[\s\S]*?grid-template-columns:\s*minmax\(2\.6rem, max-content\) minmax\(18rem, 1fr\) minmax\(20rem, 30rem\) minmax\(9rem, auto\);/);
  assert.match(css, /\.rank-row__score-panel\s*{[\s\S]*?min-width:\s*0;/);
  assert.match(css, /\.rank-row__summary\s*{[\s\S]*?overflow-wrap:\s*anywhere;/);
});

test("ranking controls stay compact and cards open details directly", () => {
  assert.match(component, /function NavMenu/);
  assert.match(component, /ariaLabel=\{t\.chooseLanguage\}/);
  assert.match(component, /ariaLabel=\{t\.chooseTheme\}/);
  assert.match(component, /href="https:\/\/trae-2026-contest-rankings-494660453737\.asia-east1\.run\.app"/);
  assert.match(component, /href="https:\/\/trae-2026-contest-rankings-494660453737\.asia-east1\.run\.app"[\s\S]*className="nav-control focus-ring"[\s\S]*aria-label="Open RateMinistere home"[\s\S]*<Home className="h-4 w-4" \/>/);
  assert.match(component, /className="ranking-filters surface-panel"[\s\S]*<ViewToggle value=\{viewMode\} onChange=\{setViewMode\}/);
  assert.match(component, /const openDetail = \(\) => router\.push\(detailHref\);/);
  assert.match(component, /onClick=\{openDetail\}/);
  assert.match(component, /role="link"/);
  assert.match(component, /tabIndex=\{0\}/);
  assert.match(component, /event\.key === "Enter"/);

  assert.match(css, /\.main-tabs\s*{[\s\S]*?border-radius:\s*6px;/);
  assert.match(css, /\.ranking-filters\s*{[\s\S]*?display:\s*flex;/);
  assert.match(css, /\.ranking-filters\s*{[\s\S]*?flex-wrap:\s*wrap;/);
  assert.match(css, /\.rank-row\s*{[\s\S]*?border-bottom:\s*1px/);
  assert.match(css, /\.rank-row:hover\s*{[\s\S]*?background:/);
  assert.doesNotMatch(css, /\.rank-row:hover\s*{[\s\S]*?transform:/);
  assert.match(theme, /--shadow-card:/);

  // Assert details page theming and dropdowns
  const detailComponent = readFileSync(join(process.cwd(), "app/project/project-detail-client.tsx"), "utf8");
  assert.match(detailComponent, /className="[^"]*\btech-shell\b[^"]*"/);
  assert.match(detailComponent, /useContestTheme\(\)/);
  assert.match(detailComponent, /<NavMenu/);
});
