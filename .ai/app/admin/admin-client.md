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
- 2026-07-01 Codex: Admin operations are wired to `/api/trae-contest/admin/*`, whose server handlers use Firebase Data Connect generated queries/mutations against the SQL backend. The client copy should say SQL/Data Connect, not Firestore, so operators do not think the admin page depends on Firestore.

## Important Notes / NEVER Change

- The admin token must remain user-entered/client-stored only; never bundle server secrets into the client.

## Change History

| Date | Change | Author |
|------|--------|--------|
| 2026-07-01 | Created doc before updating judge batch settings. | Codex |
| 2026-07-01 | Updated all judge actions to request `batchMax: 12` and `concurrency: 3`, and send concurrency in the loop request body. | Codex |
| 2026-07-01 | Planned admin run empty-state wording update from Firestore to SQL/Data Connect. | Codex |
| 2026-07-01 | Updated admin run empty-state wording to SQL/Data Connect. | Codex |

## Change Plan: Admin Theme Shell

- 2026-07-01 Codex: Admin UI must share the public `tech-shell` wrapper; otherwise theme-aware overrides from `theme.css`/`globals.css` do not apply consistently.
- Implement by adding `tech-shell` to the admin root `<main>` class list.
- Implemented root `score-grid tech-shell ...` class list.

## Change Plan: SQL/Data Connect Wording

- 2026-07-01 Codex: Replace the admin run empty-state reference to Firestore with SQL/Data Connect.
- Verify through `tests/admin-console.test.ts` so the UI does not regress back to Firestore wording.
- Implemented by replacing the empty-state storage label with `SQL/Data Connect`.
