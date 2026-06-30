# scripts/trae-ops.ts

> Last updated: 2026-06-30 | Protection: STANDARD

## Purpose

Provides local operational commands for bounded scrape, match, judge, and cleanup workflows.

## What It Does

- Loads local Next env files.
- Runs scraper, matcher, and judge library functions.
- Resets scraper cursors through Data Connect for cleanup-like local recovery.

## Public API

| Name | Type | Description |
|------|------|-------------|
| `scripts/trae-ops.ts` | CLI | Local operations command dispatcher. |

## Dependencies

- Internal: `scraper`, `matcher`, `judge`, `dataconnect`.
- Generated SDK: `upsertScrapeCursor`.
- External: `@next/env`.

## Agent Decisions / Thoughts

- 2026-06-30 Codex: Remove direct Firestore collection deletes/sets. The current Data Connect connector has cursor upsert support but no delete-topic mutation, so cleanup should reset cursors and clearly report that topic deletion requires an explicit SQL mutation.
- 2026-06-30 Codex: Implemented cursor reset via Data Connect and verified scrape commands write through SQL.

## Important Notes / NEVER Change

- Do not add destructive SQL deletes unless the connector schema exposes explicit admin-only mutations and the operator intentionally runs them.

## Change History

| Date | Change | Author |
|------|--------|--------|
| 2026-06-30 | Planned SQL/Data Connect operations migration. | Codex |
| 2026-06-30 | Implemented SQL/Data Connect operations migration. | Codex |
