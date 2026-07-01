# lib/trae/api.ts

> Last updated: 2026-06-29 | Protection: STANDARD

## Purpose

Provides SQL/Data Connect read-model helpers used by public API routes and pages.

## What It Does

- Combines topic, latest evaluation, and match data.
- Computes stats cards and online presence counts.
- Applies public filters and sorting for preliminary-only listings.
- Sums token usage aggregate documents into public input/output totals.
- Caches the built board data in memory for a short TTL, supporting `bypassCache` to force rebuilds from Data Connect.

## Public API

| Name | Type | Description |
|------|------|-------------|
| `getTraeStats` | function | Returns public stats payload. |
| `listRankedTopics` | function | Returns preliminary ranking rows, supports `bypassCache` to load directly from source. |
| `getTopicDetail` | function | Returns detail page data by topic ID. |
| `writeBoardSnapshot` | function | Rebuilds the in-memory leaderboard cache from Data Connect. |

## Dependencies

- Internal: `dataconnect`, `types`.
- Generated SDK: board, stats, topic detail, presence, and run queries/mutations.

## Agent Decisions / Thoughts

- 2026-06-29 Codex: Use server-side in-memory joins for the first version to avoid complex Firestore composite indexes during launch.
- 2026-06-29 Codex: Expose only aggregate token totals in stats, not provider/model-level token records.
- 2026-06-30 Codex: SQL migration keeps the same public API shape while replacing Firestore collection reads with Data Connect generated queries.

## Planned Change: Lint And SQL Adapter Boundary

- 2026-06-30 Codex: Keep public payload sanitization and cache behavior, but treat generated Data Connect `Any` payloads and enum conversions as a server-only adapter boundary.
- Implemented: removed the stale write-side competition-level mapper and kept read paths on `dataconnect.ts`.

## Bug Fix Plan: Stats Must Not Depend On Board Query

- 2026-06-30 Codex: Owner reported `4 DEADLINE_EXCEEDED` and the public page showing `0/0`. Root cause: `getTraeStats()` calls `getBoardData()`, which rebuilds the full board via `GetBoardData`. After raising that nested query to 5000 topics, Data Connect hit its 300s deadline; because the client treated stats/topics as one all-or-nothing load, the first render fell back to null stats and showed `0/0`.
- Fix strategy: make `getTraeStats()` call the lightweight `GetStats` aggregation directly and fetch online count separately. Keep `listRankedTopics()` on board data, but let stats survive even when topic list loading fails.
- Regression risk: stats and list can be briefly out of sync during a pipeline run; that is better than showing an empty contest.
- 2026-06-30 Codex: Implementation target is a new `buildStatsFromSource()` helper used only by `getTraeStats()`, leaving board cache/list behavior unchanged.
- Implemented: added `buildStatsFromSource()` using `GetStats` plus online count, and changed `getTraeStats()` to avoid `getBoardData()`.

## Bug Fix Plan: Local Cache Fallback Must Survive Missing Data Connect Credentials

- 2026-06-30 Codex: Owner reported the public ranking screen showing a data-load failure / empty 0-row board. Root cause: `buildBoardDataFromSource()` calls `getDataConnectDb()` before its `try` block, so missing Firebase Data Connect credentials throw before the existing local `topics-cache.json` fallback can run.
- Fix strategy: move Data Connect initialization inside the guarded DB block, keep the existing cache load path, and assert that the board builder can still return cached rows when Data Connect is unavailable.
- Regression risk: fallback stats are approximate when DB is unavailable, but this is preferable to hiding the cached public contest rows.

## Bug Fix Plan: Stats Must Derive From Local Cache When Data Connect Is Unavailable

- 2026-06-30 Codex: Owner reported the ranking list now loads 424 works but the header still shows `已评分 0/0`. Root cause: `getTraeStats()` uses only the lightweight Data Connect stats query and returns `emptyStats()` on failure, while `listRankedTopics()` can already fall back to `topics-cache.json`.
- Fix strategy: add a local cache stats builder and use it as the `getTraeStats()` fallback when Data Connect stats fail. Keep the lightweight Data Connect path as the primary path to avoid reintroducing deadline-prone board reads.
- Regression risk: fallback `lastUpdatedAt` and counts come from the snapshot file and may lag behind live DB, but they are consistent with the rows the page is displaying.
- Implemented: extracted `readTopicsCache()` and `statsPayloadFromCacheTopics()`, reused the cache-derived stats in board fallback, and made `getTraeStats()` fall back to those counts before returning an unavailable 0/0 payload.

## Bug Fix Plan: Ranking Must Use Official Tracks And Live Board Source

- 2026-06-30 Codex: Owner reported ranking rows showing legacy categories such as `AI 应用` and `教育学习`, and the public board only showing 424 rows. Evidence: `topics-cache.json` contains 424 rows total, including 60 `SIGNUP` rows and legacy tracks; `buildBoardDataFromSource()` still used that file as the base item list even when Data Connect succeeded.
- Fix strategy: normalize returned topic tracks to the five official tracks (`生活娱乐`, `学习工作`, `社会服务`, `硬件交互`, `社会公益`) by exact title/content match plus legacy aliases, filter local fallback rows to preliminary topics, and use Data Connect `GetBoardData` topics as the live board base when DB reads succeed. Keep the JSON file only as a DB-unavailable fallback.
- Regression risk: local fallback remains limited by the bundled snapshot; live Data Connect is still capped by the query limit and needs a later pagination/snapshot-table change for true all-topic scale.
- Implemented: added official-track normalization, preliminary-only local fallback filtering, preliminary-only fallback stats, shared record mappers, and switched successful DB board builds to `topTopics` as the ranking base.

## Important Notes / NEVER Change

- Public APIs must not return `rawHtml` or unrestricted raw model internals.

## Change History

| Date | Change | Author |
|------|--------|--------|
| 2026-06-29 | Planned public read-model helpers. | Codex |
| 2026-06-29 | Implemented aggregate token totals on stats. | Codex |
| 2026-06-30 | Added board snapshot doc caching and listRankedTopics cache bypass. | Antigravity |
| 2026-06-30 | Planned Data Connect read-model verification and lint-boundary cleanup. | Codex |
| 2026-06-30 | Verified Data Connect read smoke test and removed stale mapper warning. | Codex |
| 2026-06-30 | Planned independent stats read path for Data Connect deadline recovery. | Codex |
| 2026-06-30 | Implemented independent stats read path for Data Connect deadline recovery. | Codex |
| 2026-06-30 | Planned local cache fallback fix for missing Data Connect credentials. | Codex |
| 2026-06-30 | Planned stats fallback from local topic cache for 0/0 header fix. | Codex |
| 2026-06-30 | Implemented stats fallback from local topic cache for 100/424 header recovery. | Codex |
| 2026-06-30 | Planned official-track normalization and live board source fix for 424-row fallback leakage. | Codex |
| 2026-06-30 | Implemented official-track normalization and live Data Connect board source usage. | Codex |
