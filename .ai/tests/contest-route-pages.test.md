# tests/contest-route-pages.test.ts

> Last updated: 2026-06-29 | Protection: STANDARD

## Purpose

Guards public contest routing and workflow safety invariants.

## What It Does

- Reads the relevant App Router page files and shared contest client source.
- Verifies `/` passes `activeTab="landing"`.
- Verifies `/ranking` passes `activeTab="ranking"`.
- Verifies the client uses `Link` navigation between the two URLs instead of client-only top-level tab state.
- Verifies ranking reloads preserve existing rows while loading.
- Verifies Data Connect nested topic query limits stay bounded enough to avoid 300s deadline failures.
- Verifies the public run route reports bounded judging batch counts and the client displays backend run messages.
- Verifies stats are loaded independently from the topic list.

## Public API

| Name | Type | Description |
|------|------|-------------|
| `contest route page tests` | node test | Source-level regression guard for refreshable home/ranking URLs. |

## Dependencies

- Internal: `app/page.tsx`.
- Internal: `app/ranking/page.tsx`.
- Internal: `app/contest-client.tsx`.
- Internal: `app/api/trae-contest/run/route.ts`.
- Internal: `dataconnect/connector/queries.gql`.
- External: Node built-in `node:test` and `node:assert/strict`.

## Agent Decisions / Thoughts

- 2026-06-29 Codex: Use a source-level route guard because this repo's current tests are Node-based static checks rather than a React browser test harness.
- 2026-06-30 Codex: Extend the same static guard file for pipeline-scale regressions rather than adding a new test entry to `package.json`.
- 2026-06-30 Codex: The app route files are now root-level. Update the static guards to current file paths and current nav URLs before validating the Data Connect deadline fix.
- 2026-06-30 Codex: The query-scale guard now requires nested topic reads to stay at or below 1000 so a future 5000-row nested query regression fails locally before deployment.

## Important Notes / NEVER Change

- Keep this focused on route ownership and stable navigation intent, not decorative layout details.

## Bug Fixes

| Date | Bug | Cause | Fix |
|------|-----|-------|-----|
| 2026-06-29 | Browser refresh on ranking returned to home. | Ranking was stored only in client state. | Planned route-backed App Router pages and link-based nav. |
| 2026-06-30 | Clicking scoring made rows appear to disappear temporarily. | Loading state replaced existing rows with skeletons. | Planned guard for initial-load-only skeleton rendering. |
| 2026-06-30 | Worker queries only saw 1000 topics. | Data Connect queries had hard-coded 1000 limits. | Planned guard requiring limits above current contest scale. |

## Change History

| Date | Change | Author |
|------|--------|--------|
| 2026-06-29 | Planned contest route-page regression test. | Codex |
| 2026-06-30 | Planned workflow guardrails for reload preservation, query scale, and batch-count status. | Codex |
| 2026-06-30 | Implemented workflow guardrails for reload preservation, query scale, and batch-count status. | Codex |
| 2026-06-30 | Planned root-level route test path update for deadline regression work. | Codex |
| 2026-06-30 | Updated route paths and deadline regression expectations. | Codex |
