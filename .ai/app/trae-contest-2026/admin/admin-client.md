# app/trae-contest-2026/admin/admin-client.tsx

> Last updated: 2026-06-29 | Protection: STANDARD

## Purpose

Implements the token-based admin panel for manual scraper, matcher, and judge actions.

## What It Does

- Stores admin token locally in component state/localStorage.
- Calls admin APIs with bearer token.
- Shows recent runs and error logs.

## Public API

| Name | Type | Description |
|------|------|-------------|
| `AdminClient` | component | Client-side admin console. |

## Dependencies

- Admin APIs under `/api/trae-contest/admin/*`.

## Important Notes / NEVER Change

- The token is passed only to server APIs; it must never be bundled from env into the client.

## Change History

| Date | Change | Author |
|------|--------|--------|
| 2026-06-29 | Planned admin client. | Codex |
