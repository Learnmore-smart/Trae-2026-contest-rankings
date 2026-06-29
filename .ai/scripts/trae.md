# scripts/trae.ts

> Last updated: 2026-06-29 | Protection: STANDARD

## Purpose

Provides local CLI entry points for TRAE worker operations.

## What It Does

- Supports `scrape signup`, `scrape preliminary`, `scrape all`, `match`, `judge`, `judge changed`, and `run-all`.
- Reuses the same library functions as API routes and Cloud Run Jobs.
- Runs through `node --experimental-strip-types scripts/trae.ts`.

## Public API

| Name | Type | Description |
|------|------|-------------|
| `scripts/trae.ts` | CLI | Worker command dispatcher. |

## Dependencies

- Internal: `lib/trae/scraper`, `matcher`, `judge`.

## Important Notes / NEVER Change

- CLI output must not print secrets.

## Change History

| Date | Change | Author |
|------|--------|--------|
| 2026-06-29 | Planned worker CLI. | Codex |
| 2026-06-29 | Synced final Node type-strip execution mode. | Codex |
