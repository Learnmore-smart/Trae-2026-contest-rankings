# lib/trae/runs.ts

> Last updated: 2026-06-29 | Protection: STANDARD

## Purpose

Creates and updates `trae_runs` records for scraper, matcher, and judge jobs.

## What It Does

- Starts a run document with status `running`.
- Appends bounded logs.
- Finishes runs as success, partial, or error.

## Public API

| Name | Type | Description |
|------|------|-------------|
| `startRun` | function | Creates a run document. |
| `finishRun` | function | Updates status and counters. |

## Dependencies

- Internal: `firestore`, `types`.

## Agent Decisions / Thoughts

- 2026-06-29 Codex: Keep run logging small to avoid oversized Firestore documents.

## Important Notes / NEVER Change

- Do not log secrets or full raw model payloads into run logs.

## Change History

| Date | Change | Author |
|------|--------|--------|
| 2026-06-29 | Planned run tracking helper. | Codex |
