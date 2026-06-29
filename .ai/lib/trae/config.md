# lib/trae/config.ts

> Last updated: 2026-06-29 | Protection: STANDARD

## Purpose

Reads and normalizes TRAE, OpenRouter, and worker environment configuration.

## What It Does

- Supplies defaults for model names, limits, rate limits, and forum URLs.
- Keeps secret access server-side.
- Parses numeric env vars defensively.

## Public API

| Name | Type | Description |
|------|------|-------------|
| `getTraeConfig` | function | Returns normalized configuration. |

## Dependencies

- Internal: none.

## Agent Decisions / Thoughts

- 2026-06-29 Codex: Store defaults in code for non-secret values only; secrets remain required at execution time.

## Important Notes / NEVER Change

- Never add hard-coded API keys, admin tokens, or service account JSON.

## Change History

| Date | Change | Author |
|------|--------|--------|
| 2026-06-29 | Planned config reader. | Codex |
