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
