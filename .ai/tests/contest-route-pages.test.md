# tests/contest-route-pages.test.ts

> Last updated: 2026-06-29 | Protection: STANDARD

## Purpose

Guards that the public contest home and ranking views are separate route-backed pages.

## What It Does

- Reads the relevant App Router page files and shared contest client source.
- Verifies `/trae-contest-2026` passes `activeTab="landing"`.
- Verifies `/trae-contest-2026/ranking` passes `activeTab="ranking"`.
- Verifies the client uses `Link` navigation between the two URLs instead of client-only top-level tab state.

## Public API

| Name | Type | Description |
|------|------|-------------|
| `contest route page tests` | node test | Source-level regression guard for refreshable home/ranking URLs. |

## Dependencies

- Internal: `app/trae-contest-2026/page.tsx`.
- Internal: `app/trae-contest-2026/ranking/page.tsx`.
- Internal: `app/trae-contest-2026/contest-client.tsx`.
- External: Node built-in `node:test` and `node:assert/strict`.

## Agent Decisions / Thoughts

- 2026-06-29 Codex: Use a source-level route guard because this repo's current tests are Node-based static checks rather than a React browser test harness.

## Important Notes / NEVER Change

- Keep this focused on route ownership and stable navigation intent, not decorative layout details.

## Bug Fixes

| Date | Bug | Cause | Fix |
|------|-----|-------|-----|
| 2026-06-29 | Browser refresh on ranking returned to home. | Ranking was stored only in client state. | Planned route-backed App Router pages and link-based nav. |

## Change History

| Date | Change | Author |
|------|--------|--------|
| 2026-06-29 | Planned contest route-page regression test. | Codex |
