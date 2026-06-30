# app/trae-contest-2026/ranking/page.tsx

> Last updated: 2026-06-29 | Protection: STANDARD

## Purpose

Server entry for the public TRAE contest `榜单` page.

## What It Does

- Renders the shared contest client with the ranking tab active.
- Gives `榜单` its own refreshable URL at `/trae-contest-2026/ranking`.
- Keeps data fetching inside the shared client and does not expose secrets.

## Public API

| Name | Type | Description |
|------|------|-------------|
| `TraeContestRankingPage` | component | Public ranking page component. |

## Dependencies

- Internal: `../contest-client`.

## Agent Decisions / Thoughts

- 2026-06-29 Codex: Use a route file instead of query params or local storage because the user specifically wants `首页` and `榜单` to be different pages and refreshable from the browser URL.

## Important Notes / NEVER Change

- Do not duplicate ranking UI here; this route should pass the active tab into the shared client.

## Bug Fixes

| Date | Bug | Cause | Fix |
|------|-----|-------|-----|
| 2026-06-29 | Refresh on the ranking view returned to the home view. | The ranking view did not have its own route. | Add `/trae-contest-2026/ranking` and render the shared client with ranking active. |

## Change History

| Date | Change | Author |
|------|--------|--------|
| 2026-06-29 | Planned refreshable ranking route. | Codex |
