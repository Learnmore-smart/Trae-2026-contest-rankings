# tests/contest-route-pages.test.ts

> Last updated: 2026-06-29 | Protection: STANDARD

## Purpose

Guards public contest routing and workflow safety invariants.

## What It Does

- Reads the relevant App Router page files and shared contest client source.
- Verifies `/` passes `activeTab="landing"`.
- Verifies `/ranking` passes `activeTab="ranking"`.
- Verifies the client uses `Link` navigation between the two URLs instead of client-only top-level tab state.
- Verifies ranking reloads preserve existing rows while loading.
- Verifies Data Connect nested topic query limits stay bounded enough to avoid 300s deadline failures.
- Verifies the public run route reports bounded judging batch counts and the client displays backend run messages.
- Verifies stats are loaded independently from the topic list.
- Verifies the board read path keeps Data Connect initialization inside fallback-safe code.
- Verifies client API requests default to the configured Next.js base path.
- Verifies stats fall back to local topic-cache counts when Data Connect is unavailable.
- Verifies fallback ranking rows are preliminary-only and expose only official track labels after normalization.
- Verifies the live Data Connect board path uses live query topics as the ranking base rather than the bundled JSON cache.
- Verifies `GetBoardPage` has a narrow `operation not found` fallback to the legacy deployed board query.
- Verifies public ranking and judge candidate reads call the shared duplicate-title filter server-side.
- Verifies the public project detail page does not expose raw AI scoring input/output records.
- Verifies the public user-topic submit route exists, validates TRAE links through the scraper helper, crawls as preliminary, refreshes the board, and is wired from the client form.

## Public API

| Name | Type | Description |
|------|------|-------------|
| `contest route page tests` | node test | Source-level regression guard for refreshable home/ranking URLs. |

## Dependencies

- Internal: `app/page.tsx`.
- Internal: `app/ranking/page.tsx`.
- Internal: `app/contest-client.tsx`.
- Internal: `app/api/trae-contest/run/route.ts`.
- Internal: `dataconnect/connector/queries.gql`.
- External: Node built-in `node:test` and `node:assert/strict`.

## Agent Decisions / Thoughts

- 2026-06-29 Codex: Use a source-level route guard because this repo's current tests are Node-based static checks rather than a React browser test harness.
- 2026-06-30 Codex: Extend the same static guard file for pipeline-scale regressions rather than adding a new test entry to `package.json`.
- 2026-06-30 Codex: The app route files are now root-level. Update the static guards to current file paths and current nav URLs before validating the Data Connect deadline fix.
- 2026-06-30 Codex: The query-scale guard now requires nested topic reads to stay at or below 1000 so a future 5000-row nested query regression fails locally before deployment.
- 2026-06-30 Codex: Add a static regression guard for the local JSON fallback because missing Data Connect credentials are common in local development and should not blank the public ranking.
- 2026-06-30 Codex: Add a static regression guard tying the client API prefix to `next.config.mjs` basePath, because wrong-prefix API calls surface as `榜单数据加载失败`.
- 2026-06-30 Codex: Add a runtime regression guard for stats fallback so the ranking header cannot show `0/0` while cached rows are visible.
- 2026-06-30 Codex: Add regression guards for official-track normalization and for avoiding the 424-row bundled snapshot as the live ranking base when Data Connect succeeds.
- 2026-06-30 Codex: Implemented the official-track fallback test, preliminary-only fallback stats assertion, and static live-board-source guard.
- 2026-07-01 Codex: Add pagination guards that fail if the client requests `pageSize=1000` again or if the Data Connect board read has no paged operation.
- 2026-07-01 Codex: Implemented pagination guards for client page size, previous/next controls, `GetBoardPage`, and `fetchBoardPages()`.
- 2026-07-02 Codex: Add a guard that pagination renders as an explicit `ranking-page-switch` with visible previous/next text, not just icon-only buttons.
- 2026-07-02 Codex: Implemented the visible page-switch guard and verified it fails before the client markup change, then passes after.
- 2026-07-02 Codex: Add fallback guards for deployed connectors that do not yet expose `GetBoardPage`.
- 2026-07-02 Codex: Add source-level guard for the public user-submitted topic crawl route and form wiring.
- 2026-07-02 Codex: Tighten the source guard so `/submit` must call `fetchTopic` with `requirePreliminaryCategory: true` and expose `GET` status for refresh-surviving background crawls.
- 2026-07-02 Codex: Implemented the guard for `__traeTopicSubmit`, `GET`, background `runSubmittedTopic`, strict fetch options, and client-side status `GET` polling.
- 2026-07-02 Codex: Add source-level guard requiring normalized-title dedupe to be wired into both public ranking and judge candidate selection.

## Important Notes / NEVER Change

- Keep this focused on route ownership and stable navigation intent, not decorative layout details.
- Keep selectable page-size and sort-direction assertions source-level unless a browser harness is introduced.

## Bug Fixes

| Date | Bug | Cause | Fix |
|------|-----|-------|-----|
| 2026-06-29 | Browser refresh on ranking returned to home. | Ranking was stored only in client state. | Planned route-backed App Router pages and link-based nav. |
| 2026-06-30 | Clicking scoring made rows appear to disappear temporarily. | Loading state replaced existing rows with skeletons. | Planned guard for initial-load-only skeleton rendering. |
| 2026-06-30 | Worker queries only saw 1000 topics. | Data Connect queries had hard-coded 1000 limits. | Planned guard requiring limits above current contest scale. |
| 2026-06-30 | Ranking rows disappeared locally when Data Connect credentials were absent. | `getDataConnectDb()` ran before the fallback `try` block. | Planned guard requiring DB initialization inside the guarded source-read block. |
| 2026-06-30 | Ranking page showed data-load failure under configured base path. | Client defaulted API prefix to empty string while Next served APIs under `/trae-contest-2026`. | Planned guard requiring a base-path fallback in `API_BASE`. |
| 2026-06-30 | Ranking header showed `已评分 0/0` while 424 cached works were visible. | `getTraeStats()` returned `emptyStats()` when Data Connect stats failed. | Planned guard requiring local cache-derived stats fallback. |

## Change History

| Date | Change | Author |
|------|--------|--------|
| 2026-06-29 | Planned contest route-page regression test. | Codex |
| 2026-06-30 | Planned workflow guardrails for reload preservation, query scale, and batch-count status. | Codex |
| 2026-06-30 | Implemented workflow guardrails for reload preservation, query scale, and batch-count status. | Codex |
| 2026-06-30 | Planned root-level route test path update for deadline regression work. | Codex |
| 2026-06-30 | Updated route paths and deadline regression expectations. | Codex |
| 2026-06-30 | Planned local cache fallback regression guard. | Codex |
| 2026-06-30 | Planned base-path API prefix regression guard. | Codex |
| 2026-06-30 | Planned stats local-cache fallback regression guard. | Codex |
| 2026-06-30 | Implemented stats local-cache fallback regression guard. | Codex |
| 2026-06-30 | Planned official-track and live-board-source regression guards. | Codex |
| 2026-06-30 | Implemented official-track and live-board-source regression guards. | Codex |
| 2026-07-01 | Planned detail-page basePath, error contrast, and AI I/O audit guards. | Codex |
| 2026-07-01 | Implemented detail-page basePath, error contrast, AI I/O, ranking error contrast, and pipeline error-detail guards. | Codex |
| 2026-07-01 | Planned public ranking pagination regression guards. | Codex |
| 2026-07-01 | Implemented public ranking pagination regression guards. | Codex |
| 2026-07-02 | Planned visible page-switch source guard. | Codex |
| 2026-07-02 | Implemented visible page-switch source guard. | Codex |
| 2026-07-02 | Implemented public user-topic submit route/client source guard. | Codex |
| 2026-07-02 | Planned preliminary-only and refresh-surviving submit route guard. | Codex |
| 2026-07-02 | Implemented preliminary-only and refresh-surviving submit route guard. | Codex |
| 2026-07-02 | Added duplicate-title server-side integration guard. | Codex |
| 2026-07-02 | Updated fallback count expectation to use unique titles after server-side dedupe. | Codex |
| 2026-07-02 | Planned deleted/empty suppression, selectable page size, and selectable sort direction guards. | Codex |
| 2026-07-02 | Implemented deleted/empty suppression, selectable page size, and selectable sort direction guards. | Codex |

## Planned Change: Public Run Workflow Guard

- 2026-07-01 Codex: Add a source-level guard that public run keeps `scrapeAllTraeSources()` and `runTraeMatching()`, starts a bounded unjudged judge batch before scrape completes, and runs a second bounded unjudged batch after match.
- Guard the public run optimistic client status so users see scoring started immediately.
- Implemented source-level assertions for public judge constants, scrape/match preservation, immediate and post-match judge calls, and optimistic judge status.

## Change Plan: Shared Judge Policy Guard

- 2026-07-01 Codex: Update the public route guard to reject route-local `12 / 3` constants and require shared `DEFAULT_JUDGE_BATCH_MAX` and `DEFAULT_JUDGE_CONCURRENCY` imports.
- Add a static guard for `lib/trae/judge-policy.ts` values `24` and `6`.
- Implemented in the public run workflow source-level test.
- 2026-07-01 Codex: Update the guard to expect `48 / 8`.
- 2026-07-01 Codex: Update the guard to expect `100 / 20`, and add a source guard that the judge worker also uses paged board reads rather than first-1000 `GetBoardData`.
- 2026-07-02 Codex: Update the guard to expect `100 / 100` so public runs can start 100 consensus evaluator teams concurrently.
- Implemented the `100 / 100` public route policy guard.
- 2026-07-02 Codex: Updated the guard to expect `4000 / 8` after enforcing the 40 rpm provider quota in the shared LLM client.
- 2026-07-02 Codex: Revise the paged-read guards so `GetBoardData` is allowed only as a fallback for `operation "GetBoardPage" not found`.

## Bug Fix Plan: Detail Page Must Work Under Base Path

- 2026-07-01 Codex: Owner reported every ranking row opens a detail page that says the work does not exist or is not a preliminary entry. Root cause: `app/project/project-detail-client.tsx` defaults `API_BASE` to an empty string, while this deployment is served under Next.js `basePath: "/trae-contest-2026"`. The browser fetches `/api/trae-contest/topics/...` instead of `/trae-contest-2026/api/trae-contest/topics/...`.
- Fix strategy: add a static guard requiring the detail client to use the same configured base-path fallback as the ranking client.
- 2026-07-01 Codex: Also guard the detail error panel contrast and AI input/output rendering so the user can read errors and audit scoring prompts.

## Change Plan: Remove Public AI Scoring Audit Guard

- 2026-07-01 Codex: Replace the existing source-level assertion that requires rendering `systemPrompt`, `promptText`, and `rawModelResponse` with a regression guard that rejects the public AI audit section and its `CodeBlock` rendering.
- Keep the test scoped to the detail client source because the current suite uses static route/component checks rather than a browser-rendered React harness.
- Implemented the negative source-level guard for public raw AI I/O exposure.
