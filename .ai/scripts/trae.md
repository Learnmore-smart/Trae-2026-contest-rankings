# scripts/trae.ts

> Last updated: 2026-06-29 | Protection: STANDARD

## Purpose

Provides local CLI entry points for TRAE worker operations.

## What It Does

- Supports `scrape signup`, `scrape preliminary`, `scrape all`, `match`, `judge`, `judge changed`, and `run-all`.
- Reuses the same library functions as API routes and Cloud Run Jobs.
- Runs through `node --experimental-strip-types scripts/trae.ts`.
- Loads local Next env files before worker execution.

## Public API

| Name | Type | Description |
|------|------|-------------|
| `scripts/trae.ts` | CLI | Worker command dispatcher. |

## Dependencies

- Internal: `lib/trae/scraper`, `matcher`, `judge`.
- External: `@next/env` for loading local `.env` files before worker execution.

## Agent Decisions / Thoughts

- 2026-06-29 Codex: `@next/env` resolves as CommonJS under Node type stripping in this workspace. Import the default package and destructure `loadEnvConfig`; named ESM import breaks every local worker command before scraping starts.
- 2026-06-29 Codex: Implemented the `@next/env` CommonJS interop fix and verified a limited preliminary scrape command completes.

## Important Notes / NEVER Change

- CLI output must not print secrets.

## Bug Fixes

| Date | Bug | Cause | Fix |
|------|-----|-------|-----|
| 2026-06-29 | Local worker CLI crashed before scrape commands ran. | Named ESM import from CommonJS `@next/env` fails under Node type stripping. | Import the default package and destructure `loadEnvConfig`. |

## Change History

| Date | Change | Author |
|------|--------|--------|
| 2026-06-29 | Planned worker CLI. | Codex |
| 2026-06-29 | Synced final Node type-strip execution mode. | Codex |
| 2026-06-29 | Planned `@next/env` CommonJS interop fix for local worker CLI. | Codex |
| 2026-06-29 | Implemented `@next/env` import fix for local worker CLI. | Codex |
