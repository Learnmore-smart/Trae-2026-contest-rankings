# app/admin/admin-client.tsx

> Last updated: 2026-07-01 | Protection: STANDARD

## Purpose

Implements the token-based admin panel for manual scraper, matcher, and judge actions.

## What It Does

- Stores the admin token in client state and localStorage.
- Calls admin APIs with bearer auth.
- Runs long judge actions through repeated bounded batches so each request has visible progress.

## Public API

| Name | Type | Description |
|------|------|-------------|
| `AdminClient` | component | Manual operator console. |

## Dependencies

- Internal: `/api/trae-contest/admin/*`.
- External: `next/link`, `lucide-react`, React state/effects.

## Agent Decisions / Thoughts

- 2026-07-01 Codex: Owner approved making manual judge runs faster with `max: 12` and `concurrency: 3`. Send those values from the client for judge actions; keep the existing loop so the admin page drains backlog across multiple bounded requests.

## Important Notes / NEVER Change

- The admin token must remain user-entered/client-stored only; never bundle server secrets into the client.

## Change History

| Date | Change | Author |
|------|--------|--------|
| 2026-07-01 | Created doc before updating judge batch settings. | Codex |
| 2026-07-01 | Updated all judge actions to request `batchMax: 12` and `concurrency: 3`, and send concurrency in the loop request body. | Codex |
