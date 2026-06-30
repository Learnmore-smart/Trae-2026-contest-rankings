# lib/trae/runs.ts

> Last updated: 2026-06-29 | Protection: STANDARD

## Purpose

Creates and updates SQL `runs` records for scraper, matcher, and judge jobs.

## What It Does

- Starts a run row with status `running`.
- Appends bounded logs.
- Finishes runs as success, partial, or error.

## Public API

| Name | Type | Description |
|------|------|-------------|
| `startRun` | function | Creates a run document. |
| `finishRun` | function | Updates status and counters. |

## Dependencies

- Internal: `dataconnect`, `types`.
- Generated SDK: `upsertRun`, `finishRun`.

## Agent Decisions / Thoughts

- 2026-06-29 Codex: Keep run logging small to avoid oversized persistence payloads.
- 2026-06-30 Codex: Run tracking should use Data Connect mutations only.

## Planned Change: SQL Connect Runtime

- 2026-06-30 Codex: Replace legacy Firestore helper import with `dataconnect.ts` and let generated mutation variables carry SQL enum values.
- Implemented: run tracking imports `dataconnect.ts`.

## Important Notes / NEVER Change

- Do not log secrets or full raw model payloads into run logs.

## Change History

| Date | Change | Author |
|------|--------|--------|
| 2026-06-29 | Planned run tracking helper. | Codex |
| 2026-06-30 | Planned Data Connect run-tracking cleanup. | Codex |
| 2026-06-30 | Implemented Data Connect run-tracking import cleanup. | Codex |
