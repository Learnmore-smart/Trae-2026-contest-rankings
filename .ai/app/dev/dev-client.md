# app/dev/dev-client.tsx

> Last updated: 2026-06-29 | Protection: STANDARD

## Purpose

Client-side controls for the localhost-only `/dev` page.

## What It Does

- Renders buttons for local scrape, match, judge, and full-pipeline jobs.
- Calls `/api/trae-contest/dev/run`.
- Displays raw JSON output for quick debugging.

## Public API

| Name | Type | Description |
|------|------|-------------|
| `DevClient` | component | Local development job runner UI. |

## Dependencies

- Internal: `/api/trae-contest/dev/run`.
- External: `lucide-react`.

## Agent Decisions / Thoughts

- 2026-06-29 Codex: Keep this small and direct because it is a local operator tool, not a public dashboard.

## Important Notes / NEVER Change

- Do not add secret inputs or production-only controls here.

## Change History

| Date | Change | Author |
|------|--------|--------|
| 2026-06-29 | Created localhost-only dev client plan. | Codex |
| 2026-06-29 | Implemented local job runner controls. | Codex |
