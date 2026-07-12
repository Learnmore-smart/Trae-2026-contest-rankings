# app/contest-client.tsx

> Last updated: 2026-07-09 | Protection: STANDARD

## Purpose

Implements the public contest landing and ranking client now mounted at `/` and `/ranking`.

## What It Does

- Fetches public stats, topic rows, run status, and presence data from `/api/trae-contest/*`.
- Renders the landing page, ranking filters, phase switch, run button, and ranking rows/grid.
- Keeps existing ranking rows visible during background reloads.
- Uses route-backed top-level navigation via `/` and `/ranking`.

## Public API

| Name | Type | Description |
|------|------|-------------|
| `ContestClient` | component | Shared client UI for landing and ranking pages. |

## Dependencies

- Internal: `./i18n`, `./theme`, `@/lib/trae/types`.
- Public APIs: `/api/trae-contest/stats`, `/api/trae-contest/topics`, `/api/trae-contest/run`, `/api/trae-contest/presence`.

## Agent Decisions / Thoughts

- 2026-06-30 Codex: The app has been moved from `/trae-contest-2026` to root-level routes. Future source-level route tests must use `app/page.tsx`, `app/ranking/page.tsx`, and `app/contest-client.tsx`.
- 2026-07-01 Codex: The ranking page must request bounded pages instead of `pageSize=1000`; the public total should reflect the API total, and bottom controls should move between server-returned pages without clearing existing rows during refresh.
- 2026-07-01 Codex: Implemented `RANKING_PAGE_SIZE = 50`, page state in the query string, filter/sort/search reset to page 1, and icon-only previous/next controls in the ranking meta row.
- 2026-07-02 Codex: User screenshot showed the page switch was not visible. Replace the icon-only control with a named `ranking-page-switch` group that has visible previous/next text and a prominent page label.
- 2026-07-02 Codex: Add a compact `UserTopicSubmit` form. It should post to `${API_BASE}/api/trae-contest/submit`, show concise success/error feedback, and reload public stats/ranking data after a successful crawl.
- 2026-07-02 Codex: Implemented the visible page switch in the ranking metadata row. It keeps the existing page state/query behavior and only changes the control presentation.
- 2026-07-02 Codex: Implemented `UserTopicSubmit` on both the landing side rail and ranking page. It validates empty input client-side, surfaces server validation errors, clears on success, and calls `load()` so stats/ranking refresh after a crawl.
- 2026-07-02 Codex: Updated `UserTopicSubmit` to read `GET /api/trae-contest/submit` on mount and poll while `running`, so refreshing the page during a submitted-topic crawl still shows the crawler state.
- 2026-07-02 Codex: Add a rightmost navbar home anchor to `https://www.rateministere.com` using the existing compact `nav-control` visual style and a lucide `Home` icon only. Keep it after language/theme controls so it is the far-right control.
- 2026-07-02 Codex: Filter/sort/page-size query changes should show ranking skeleton rows while the replacement page loads, but same-query refreshes from run completion or submitted-topic reloads should keep current rows visible.
- 2026-07-03 Codex: User provided the official TRAE AI Creativity Contest banner at `public/Banner-Trae-contest-2026.jpg`. Add it as an actual landing hero banner image, using the existing `API_BASE` prefix so the asset works with the configured `/trae-contest-2026` base path.
- 2026-07-03 Codex: Implemented the official banner as a first child of `.landing-hero` using `next/image`, with intrinsic 3000x600 dimensions, priority loading, responsive sizes, and alt text. Existing scoring, ranking, run, and submission controls remain unchanged.

## Bug Fix Plan: Run Button Must Not Silently Reset (2026-07-09)

- Owner reported clicking 开始评分 "似乎没有用". On Cloud Run the status poll can land on a different instance than the click (in-memory pipeline state is per-process), so the first poll reported `running: false, phase: "idle"`; the client called `stopPolling()` and reset the button with zero feedback ~2s after the click.
- Fix strategy (client half; server half lives in `.ai/app/api/trae-contest/run/route.md`): add `RUN_START_GRACE_MS = 15_000`. `trigger()` stamps `graceUntilRef` before POST; the poll callback ignores `running: false` responses until the grace expires, giving the server-side run time to write its first RUNNING row into the runs table (which now backs GET status across instances).
- Regression risk: keep the exact `setStatus({ running: true, phase: "judge", ... message: t.judging ... })` trigger line and the message rendering asserted by `tests/contest-route-pages.test.ts`. The grace window must not swallow the POST response itself (error replies come through the POST path, not the poll path).

## Bug Fix Plan: Poll Immediately + Surface Idle No-Op (2026-07-10)

- Production POST can take 10–900s (self-invoke handoff or in-process fallback). Waiting for the POST body before `startPolling()` leaves the UI stuck on optimistic 运行中 with no GET/DB updates, and if the server returns silent `phase: "idle"` the button resets with no error.
- Fix strategy: in `trigger()`, call `startPolling()` immediately after optimistic `setStatus(running)`. When POST returns `!running && phase === "idle"`, map to `phase: "error"` with `t.failed` so the user can retry. Keep grace window for poll races.
- Regression risk: preserve optimistic `setStatus({ running: true, phase: "judge", ... t.judging })` and message rendering.

## Bug Fix Plan: Stats Request Must Survive Topic Deadline

- 2026-06-30 Codex: Owner reported `DEADLINE_EXCEEDED` plus the public page showing `0/0`. Root cause in the client: stats and topics are loaded with one `Promise.all`, so a deadline in the topic-list request prevents the already-light stats response from being applied.
- Fix strategy: start both fetches concurrently but await/apply the stats response independently before awaiting topics. Topic failure may show a list error, but it must not reset progress stats to null.
- Regression risk: stats and list can be briefly out of sync while the board cache rebuilds; this is acceptable and much better than displaying an empty contest.
- Implemented: `/stats` is started independently and applies `setStats` from its own promise; `/topics` failure no longer prevents the stats payload from being rendered.

## Bug Fix Plan: API Requests Must Respect Base Path

- 2026-06-30 Codex: Owner reported the ranking UI showing `榜单数据加载失败`. Root cause in local reproduction: `next.config.mjs` still sets `basePath: "/trae-contest-2026"`, but the client defaults `API_BASE` to an empty string unless `NEXT_PUBLIC_BASE_PATH` is manually set, so requests go to `/api/trae-contest/*` and return 404 under the configured base path.
- Fix strategy: make the client default API/image path prefix match the configured base path while preserving `NEXT_PUBLIC_BASE_PATH` as an override.
- Regression risk: if the app is later truly moved to root, `next.config.mjs` and this default must be changed together.

## Bug Fix Plan: Ranking Rows Must Not Show Legacy Track Labels

- 2026-06-30 Codex: Owner highlighted row metadata showing labels outside the five official contest tracks. Backend will normalize known legacy labels, but the client should also stop rendering an `Unknown track` placeholder as if it were a category.
- Fix strategy: render the track meta segment only when `item.topic.track` is present after backend normalization. The dropdown remains the fixed five official tracks plus "all".
- Regression risk: rows whose track cannot be recovered will have author/date metadata only until the source data is corrected.
- Implemented: `RankCard` now omits the track meta segment when the normalized API row has no official track.

## Bug Fix Plan: Error States Must Be Readable And Actionable

- 2026-07-01 Codex: Owner reported red-on-red errors and opaque "run interrupted" messages. The ranking client used translucent red backgrounds with red/light text, and `RunButton` ignored the backend `status.error` field.
- Fix strategy: use explicit light/dark contrast classes for ranking errors and render the backend error detail under the run status message when a pipeline run fails.
- Regression risk: backend error strings can be long; keep the detail constrained and wrapped/truncated inside the existing status surface.

## Important Notes / NEVER Change

- Keep the public disclaimer visible.
- Do not clear existing ranking rows during background reloads unless a successful payload replaces them.
- Query-changing filter/sort/page-size reloads are allowed to cover stale rows with skeletons so users do not read the old ordering as current.
- Ranking page size must default to 50 while allowing explicit user choices.
- Ranking sort direction must be user-selectable and must reset pagination to page 1 when changed.
- 2026-07-04 Codex: Add a GitHub icon link immediately before the existing RateMinistere home icon in the top-right navbar. Keep it icon-only and use the same compact nav control styling.

## Change History

| Date | Change | Author |
|------|--------|--------|
| 2026-06-30 | Created documentation for root-level contest client after route move. | Codex |
| 2026-06-30 | Implemented independent stats loading for Data Connect deadline recovery. | Codex |
| 2026-06-30 | Planned base-path-aware API request fix for ranking load failures. | Codex |
| 2026-06-30 | Planned client-side suppression of unknown/legacy row track labels. | Codex |
| 2026-06-30 | Implemented suppression of unknown row track labels. | Codex |
| 2026-07-01 | Planned readable ranking errors and visible backend pipeline error details. | Codex |
| 2026-07-01 | Implemented readable ranking error panel and surfaced backend pipeline error details. | Codex |
| 2026-07-01 | Planned server-backed ranking pagination controls. | Codex |
| 2026-07-01 | Implemented bounded ranking page requests and pagination controls. | Codex |
| 2026-07-02 | Planned visible text page-switch control for the ranking metadata row. | Codex |
| 2026-07-02 | Planned public user-submitted TRAE topic crawl form. | Codex |
| 2026-07-02 | Implemented explicit text page-switch controls. | Codex |
| 2026-07-02 | Implemented public user-submitted TRAE topic crawl form. | Codex |
| 2026-07-02 | Implemented refresh-surviving submitted-topic crawl status polling. | Codex |
| 2026-07-02 | Planned page-size and sort-direction controls for ranking. | Codex |
| 2026-07-02 | Implemented page-size and sort-direction dropdowns with query-string wiring. | Codex |
| 2026-07-02 | Planned rightmost RateMinistere home link in navbar with icon-only label. | Codex |
| 2026-07-02 | Implemented rightmost RateMinistere home link in navbar with icon-only label. | Codex |
| 2026-07-02 | Planned filter-change skeleton state while preserving same-query background row refreshes. | Codex |
| 2026-07-02 | Implemented last-loaded query tracking so filter/query changes show skeleton rows while same-query refreshes keep rows visible. | Codex |
| 2026-07-03 | Planned official contest banner image in the landing hero. | Codex |
| 2026-07-03 | Implemented official contest banner image above the hero command deck. | Codex |
| 2026-07-10 | Run button: poll on click; surface silent idle no-op as error (not cooldown). | Grok |
| 2026-07-12 | Removed cooldown logic (isCooldown, cooldown variable, t.cooldown copy) — the user wants immediate retry after a run finishes. | GLM |

## Change Plan: Public Run Starts Scoring Immediately

- 2026-07-01 Codex: The public button still triggers scrape/match, but the optimistic status should show scoring starts immediately while the backend continues to report authoritative phase updates.
- Implement by initializing `RunButton` to the `judge` phase and `t.judging` message after click.
- Implemented the optimistic `judge` status and dependency update.
