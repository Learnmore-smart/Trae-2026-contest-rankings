# lib/trae/api.ts

> Last updated: 2026-06-29 | Protection: STANDARD

## Purpose

Provides SQL/Data Connect read-model helpers used by public API routes and pages.

## What It Does

- Combines topic, latest evaluation, and match data.
- Computes stats cards and online presence counts.
- Applies public filters and sorting for preliminary-only listings.
- Filters duplicate public ranking rows by normalized topic title so repeated forum posts do not occupy multiple ranks.
- Sums token usage aggregate documents into public input/output totals.
- Caches the built board data in memory for a short TTL, supporting `bypassCache` to force rebuilds from Data Connect.
- Falls back from paged `GetBoardPage` reads to legacy `GetBoardData` when the deployed connector has not yet been updated with the new operation.

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
- 2026-07-01 Codex: Public board construction should page through bounded Data Connect board chunks and cache the assembled read model, so the browser gets small pages while filters/sorts still run against the full preliminary set.
- 2026-07-01 Codex: Implemented `fetchBoardPages()` using `GetBoardPage` chunks of 1000 rows based on the live preliminary count.
- 2026-07-02 Codex: Owner hit `operation "GetBoardPage" not found`; production connector can lag generated code. Add a narrow fallback to legacy `GetBoardData` only for that exact missing-operation case.
- 2026-07-02 Codex: Owner reported duplicate public ranking posts with the same title. Public sorting should happen first, then normalized-title dedupe should keep only the highest visible row for the active sort before ranks and pagination are assigned.
- 2026-07-02 Codex: Public ranking ordering must partition graded rows ahead of ungraded rows for every display direction, so low-to-high sorting never pulls pending items to the top.

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

## Bug Fix Plan: Topic Detail Must Fall Back To Cache Like The Board

- 2026-07-02 Codex: Owner reported every project — from a list click and from the detail page — showing `作品不存在或不是初赛作品` (404), while the ranking list still rendered works. Root cause: `getTopicDetail()` only consulted `topics-cache.json` inside its `catch` (i.e. when the Data Connect query *threw*). When Data Connect was reachable but returned no matching preliminary row (empty/partial DB, or only some operations deployed while the board fell back to the snapshot), `if (!t || t.sourceType !== "PRELIMINARY") return null` hard-404ed instead of checking the same snapshot the board serves from. Result: works listed from cache but none of them opened.
- Fix strategy: extract the snapshot lookup into `getTopicDetailFromCache(id)` (reusing `readTopicsCache()`), call it from both the "DB returned no preliminary" branch and the `catch`, and gate the cache path on a case-insensitive `preliminary` check so a signup id correctly resolves to "not a preliminary entry" rather than serving signup content.
- Regression risk: detail may show snapshot-lagged evaluation/match data when Data Connect is empty, but that is consistent with the rows the board is already displaying.
- Implemented: added `getTopicDetailFromCache()`, made both no-row and thrown paths fall back to it, and added a `contest-route-pages` regression test asserting a cached preliminary id resolves while signup/unknown ids stay null.

## Bug Fix Plan: Detail Fallback Must Cover The Whole Board, Not Just The Snapshot

- 2026-07-02 Codex: Owner reported `作品修改后再次在网页上查看显示不存在` — a work that lists on the board renders `作品不存在` on its detail page. Root cause: the board serves the full live Data Connect set (~3,097 preliminary works, of which ~2,700+ exist only in the DB), and its assembled read model stays warm in the in-memory `boardCache` even through a DB blip. But `getTopicDetail()`'s only recovery when its single `GetTopicDetail` lookup missed/threw was `getTopicDetailFromCache()`, i.e. the committed `topics-cache.json` — a 364-work snapshot. So the "listed ⇒ openable" invariant only held for those 364 works; for every DB-only work, a transient detail-query failure (most likely *during a submit/re-scrape*, when `upsertTopic` + `writeBoardSnapshot` are hammering Data Connect) dropped through to the snapshot, found nothing, and 404ed a still-listed work.
- Fix strategy: add `getTopicDetailFromBoard(id)` that resolves the id from the same `getBoardData()` the leaderboard serves (sharing its DB → legacy → snapshot chain and its warm cache), and try it *before* the static snapshot on both the missing/non-preliminary branch and the `catch`. The board's evaluation is lightened but keeps every field the detail page renders, so a fallback card is complete.
- Regression risk: none on the happy path — the board fallback only runs when the direct detail query misses or throws, and it reuses the cached board read model, so it adds no extra Data Connect load. A signup/unknown id still resolves to null because board `baseItems` are preliminary-only and the snapshot guard rejects non-preliminary rows.
- Implemented: added `getTopicDetailFromBoard()`, wired both recovery paths to `(await getTopicDetailFromBoard(id)) ?? (await getTopicDetailFromCache(id))`, and added a `contest-route-pages` regression test asserting the board-first fallback wiring in both branches.

## Important Notes / NEVER Change

- Public APIs must not return `rawHtml` or unrestricted raw model internals.
- Do not reintroduce one huge nested board query for all topics; use bounded page chunks.
- Board data must filter deleted/empty preliminary topics before public ranking rows are built.
- Sort direction changes display order only; rank numbers must remain canonical best-first leaderboard positions.
- Ungraded ranking rows must remain after all graded rows before pagination, even when the selected sort direction is low-to-high.
- `getTopicDetail()` must fall back to the warm board data (`getTopicDetailFromBoard`) and then `topics-cache.json` whenever Data Connect yields no matching preliminary — on an empty/non-preliminary result as well as a thrown error — so any work that lists on the board also opens in detail. The static snapshot alone is not enough: the board lists thousands of DB-only works absent from it.

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
| 2026-07-01 | Planned chunked full-board assembly for accurate server-side pagination. | Codex |
| 2026-07-01 | Implemented chunked board page assembly via generated `getBoardPage`. | Codex |
| 2026-07-02 | Implemented `GetBoardPage` missing-operation fallback to `GetBoardData`. | Codex |
| 2026-07-02 | Planned normalized-title dedupe for public ranking rows. | Codex |
| 2026-07-02 | Implemented public ranking dedupe after sorting and before rank pagination. | Codex |
| 2026-07-02 | Planned deleted/empty board filtering and selectable display sort direction. | Codex |
| 2026-07-02 | Implemented deleted/empty board filtering and `dir=asc|desc` display ordering. | Codex |
| 2026-07-02 | Fixed detail 404 for DB-only works by falling back to warm board data before the static snapshot. | Codex |
| 2026-07-02 | Planned graded-first public ranking order for all sort directions. | Codex |
| 2026-07-02 | Implemented graded-first ranking partitioning before rank assignment and pagination. | Codex |
| 2026-07-02 | Fixed topic detail 404s: `getTopicDetail()` now falls back to the local snapshot on empty/non-preliminary DB results, not only on thrown errors. | Codex |
## Change Plan: Provider Map Cleanup

- 2026-07-03 Codex: Remove REMOVED_PROVIDER from read-side provider reverse maps.
- Current Data Connect rows should normalize `NVIDIA` to `nvidia`; new Friend/NVIDIA calls both persist under that enum bucket.

