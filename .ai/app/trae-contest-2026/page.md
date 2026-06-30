# app/trae-contest-2026/page.tsx

> Last updated: 2026-06-29 | Protection: STANDARD

## Purpose

Server entry for the public TRAE third-party AI ranking page.

## What It Does

- Renders metadata and the client experience with the landing tab active.
- Acts as the canonical `首页` route for the public contest page.
- Does not fetch secrets client-side.

## Public API

| Name | Type | Description |
|------|------|-------------|
| `TraeContestPage` | component | Public page component. |

## Dependencies

- Internal: `contest-client`.

## Agent Decisions / Thoughts

- 2026-06-29 Codex: Keep `/trae-contest-2026` as the home/landing URL and move the ranking view to `/trae-contest-2026/ranking`, so browser refresh restores the intended top-level page from the path.

## Change History

| Date | Change | Author |
|------|--------|--------|
| 2026-06-29 | Planned public ranking page shell. | Codex |
| 2026-06-29 | Planned landing route as the explicit home page for the route-backed tab split. | Codex |
