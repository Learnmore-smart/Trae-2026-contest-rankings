# app/ranking/page.tsx

> Last updated: 2026-06-30 | Protection: STANDARD

## Purpose

Defines the root-level ranking route at `/ranking`.

## What It Does

- Imports the shared contest client from `../contest-client`.
- Loads ranking-specific CSS.
- Passes `activeTab="ranking"` so refresh/bookmarks keep the ranking tab selected.

## Public API

| Name | Type | Description |
|------|------|-------------|
| `TraeContestRankingPage` | Next.js page | Server component for `/ranking`. |

## Dependencies

- Internal: `../contest-client`, `../contest.css`.

## Agent Decisions / Thoughts

- 2026-06-30 Codex: This route replaces the older `/trae-contest-2026/ranking` source path in the current workspace.

## Important Notes / NEVER Change

- Keep this page thin; ranking behavior belongs in `app/contest-client.tsx`.

## Change History

| Date | Change | Author |
|------|--------|--------|
| 2026-06-30 | Created route documentation after root-level route move. | Codex |
