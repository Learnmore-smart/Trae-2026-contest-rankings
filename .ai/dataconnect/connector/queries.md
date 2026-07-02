# dataconnect/connector/queries.gql

> Last updated: 2026-06-30 | Protection: STANDARD

## Purpose

Defines Firebase Data Connect read queries for public leaderboard data and pipeline internals.

## What It Does

- `GetBoardData` reads preliminary topics with latest evaluation and match data for board construction.
- `GetTopicDetail` reads one topic with full detail payload.
- `GetStats`, `GetOnlineCount`, `GetLatestRun`, `ListRuns`, `GetScrapeCursor`, and `GetTopicsBySourceType` support public stats and worker workflows.

## Public API

| Name | Type | Description |
|------|------|-------------|
| `GetBoardData` | query | Board topic read model. |
| `GetTopicsBySourceType` | query | Pipeline topic pool read by source type. |

## Dependencies

- Generated SDK under `lib/dataconnect-generated`.
- Server helpers under `lib/trae/*`.

## Agent Decisions / Thoughts

- 2026-06-30 Codex: The project scale is now expected to reach about 3000 preliminary topics. Hard-coded `limit: 1000` in board/pipeline queries is no longer valid for matching or judging coverage.
- 2026-07-01 Codex: Keep each nested board read bounded at or below 1000 rows, but add a generated `GetBoardPage(limit, offset)` operation so server code can assemble the full board in chunks instead of relying on a single capped query.
- 2026-07-01 Codex: Implemented `GetBoardPage($limit, $offset)` with the same light board fields as `GetBoardData`.

## Bug Fix Plan: Remove 1000-Row Workflow Truncation

- 2026-06-30 Codex: Owner observed stats at 1848 preliminary items and scoring stuck at 90. Evidence: `GetBoardData` and `GetTopicsBySourceType` both cap topics at 1000, and judge/matcher consume those queries. That truncates the worker candidate pool before `maxJudgePerRun` is applied.
- Fix strategy: raise the static topic query limit to a project-scale ceiling above the expected 3000 entries. Keep the query shape unchanged so generated TypeScript signatures remain compatible.
- Regression risk: larger query payloads increase memory and response size. This is acceptable as a short-term fix for the contest scale; a future durable fix should add paginated generated queries.
- Implemented: raised `GetBoardData` and `GetTopicsBySourceType` topic limits from 1000 to 5000.

## Bug Fix Plan: Revert Deadline-Prone Wide Queries

- 2026-06-30 Codex: The 5000-row nested `GetBoardData` query caused Data Connect `DEADLINE_EXCEEDED` after 300s in production. Root cause: this query joins topic rows with latest evaluation and match data, so widening it is not a safe way to cover the whole contest.
- Fix strategy: return the nested public board and pipeline pool queries to 1000-row bounded reads. Full 3000-topic coverage needs paged/lightweight worker queries, not a single wide nested board query.
- Regression risk: matching/judging still run in chunks until paged worker queries are added. This restores the public page instead of timing out.
- 2026-06-30 Codex: Implementation target is to revert both `GetBoardData` and `GetTopicsBySourceType` `topics(...)` limits from 5000 back to 1000.
- Implemented: reverted both nested topic query limits to 1000.

## Important Notes / NEVER Change

- Public queries must not expose secrets.
- Detail queries may include raw model payloads only for server-side route use.

## Bug Fixes

| Date | Bug | Cause | Fix |
|------|-----|-------|-----|
| 2026-06-30 | Matching/judging could not see beyond 1000 preliminary topics. | Data Connect queries had hard-coded 1000 topic limits. | Planned to raise the limits above current contest scale. |

## Change History

| Date | Change | Author |
|------|--------|--------|
| 2026-06-30 | Created query documentation and planned truncation fix. | Codex |
| 2026-06-30 | Planned deadline fix to revert wide nested query limits. | Codex |
| 2026-06-30 | Reverted deadline-prone 5000-row nested query limits to 1000. | Codex |
| 2026-07-01 | Planned paged board query for full public leaderboard pagination. | Codex |
| 2026-07-01 | Added paged board query for chunked public leaderboard reads. | Codex |
