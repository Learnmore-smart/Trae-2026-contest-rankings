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

## Important Notes / NEVER Change

- Keep this focused on route ownership and stable navigation intent, not decorative layout details.

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
